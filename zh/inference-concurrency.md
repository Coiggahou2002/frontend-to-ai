# LLM 推理并发估算：原理、方法与实战

## 核心概念

### 1. 推理过程的两个阶段

LLM 推理分为两个截然不同的阶段，它们的瓶颈完全不同：

**Prefill（预填充）**：把用户的整个输入一次性送入模型，计算所有 token 的 KV cache。这个阶段是**计算瓶颈（compute-bound）**，因为所有输入 token 可以并行计算，GPU 的算力是限制因素。

**Decode（解码/生成）**：逐个生成输出 token。每生成一个 token，需要加载整个模型的权重做一次前向传播，但只产出一个 token。这个阶段是**带宽瓶颈（memory-bandwidth-bound）**，因为每次都要把数十 GB 的权重从显存搬到计算单元，但计算量很小。

这个区别决定了一个关键事实：**decode 阶段是 batch 越大越划算的**，因为模型权重只加载一次，就能同时给 batch 中所有请求各生成一个 token。

### 2. KV Cache

KV cache 是 LLM 推理中最核心的显存消耗项之一。

在 Transformer 的自注意力机制中，每生成一个新 token，都需要和之前所有 token 做注意力计算。如果每次都重新计算之前所有 token 的 Key 和 Value 向量，计算量会随序列长度平方增长。

KV cache 的做法是：把每个 token 在每一层的 K 和 V 向量计算一次后缓存在显存中，后续直接读取。这用空间（显存）换时间（计算），是现代 LLM 推理的标配。

**每个 token 的 KV cache 大小取决于模型架构：**

```
每 token KV cache = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                    ↑              ↑           ↑           ↑               ↑
                  K和V两个     KV 头的数量   每个头的维度   精度决定      模型层数
```

其中：
- `2` = K 和 V 各存一份
- `num_kv_heads` = KV 头的数量（GQA 压缩后的）
- `head_dim` = 每个注意力头的维度
- `bytes_per_element` = 每个元素的字节数（BF16=2, FP8=1）
- `num_layers` = 模型的层数

### 3. GQA（Grouped Query Attention）

标准多头注意力（MHA）中，每个 Query 头对应一个独立的 K 头和 V 头。如果有 24 个注意力头，就需要存 24 组 KV。

GQA 的思路是让多个 Query 头共享一组 KV 头。例如 24 个 Query 头共享 4 个 KV 头（压缩比 6:1），KV cache 直接缩小为原来的 1/6。

GQA 对推理的影响是双重的：
- **省显存**：KV cache 更小，同样的显存能缓存更多 token → 支持更长上下文或更多并发
- **省带宽**：decode 时读取的 KV cache 更少 → 每个 token 的生成更快

这就是为什么 `num_kv_heads` 是并发估算中最关键的架构参数之一。

### 4. MLA（Multi-head Latent Attention）

MLA 是 DeepSeek-V2/V3 系列和 Kimi K2 使用的注意力机制，比 GQA 更进一步：把整个 KV 投影到一个低维的潜向量中存储，推理时再解压。KV cache 压缩比可达 10 倍以上。

MLA 模型的 KV cache 公式不同：

```
每 token KV cache = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

本文后续的实战案例使用的是 GQA 模型（Qwen3.6-27B），所以用 GQA 公式。

### 5. 显存带宽 vs 计算算力

| 指标 | 意义 | 影响的阶段 |
|---|---|---|
| 显存带宽（GB/s） | 每秒能从显存读取多少数据 | Decode（主要瓶颈） |
| 计算算力（TFLOPS） | 每秒能做多少浮点运算 | Prefill（主要瓶颈） |

**Decode 单 token 延迟的粗估公式：**

```
单 token 延迟 ≈ 模型权重大小(bytes) / 总显存带宽(bytes/s)
```

这是因为生成每个 token 都需要把模型权重"扫"一遍。权重越大、带宽越低，单 token 就越慢。

**Batch 带来的吞吐提升：**

当 batch size = N 时，模型权重仍然只加载一次，但同时给 N 个请求各生成一个 token。所以：

```
总吞吐 ≈ N / 单 token 延迟    （直到 compute-bound 为止）
```

Batch 越大，GPU 的算力利用率越高，直到从 bandwidth-bound 转为 compute-bound。这个转折点叫做 **arithmetic intensity 饱和点**。

### 6. Tensor Parallelism（张量并行）

当模型太大、一张卡装不下时，可以把模型切分到多张卡上。每张卡负责一部分计算，中间通过 all-reduce 通信同步。

TP 的收益：
- 显存翻倍：2 卡 = 2 倍显存
- 带宽翻倍：2 卡 = 2 倍总带宽 → 单 token 延迟减半

TP 的代价：
- 每一层都需要卡间通信（all-reduce）
- NVLink（900 GB/s）通信开销很小，PCIe Gen4（~32 GB/s）开销显著
- 没有 NVLink 的 GPU（如 L20）只能用 PCIe，TP 通信会增加延迟

---

## 并发估算方法论

### Step 1: 计算模型权重占用

```
权重显存 = 总参数量 × bytes_per_param
```

常见精度：
| 精度 | bytes_per_param |
|---|---|
| BF16 / FP16 | 2 |
| FP8 | 1 |
| INT4 | 0.5 |

注意：MoE 模型的总参数量远大于激活参数量，权重占用按**总参数**计算。

### Step 2: 计算每 token 的 KV cache 大小

```
kv_per_token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
```

其中 `bytes_per_element` 取决于 KV cache 的存储精度：
- 默认与模型精度相同（BF16 = 2 bytes）
- vLLM 支持 `--kv-cache-dtype fp8` 将 KV cache 量化到 FP8（1 byte），显存减半，精度损失极小

### Step 3: 计算可用 KV cache 显存

```
可用 KV 显存 = 总显存 × gpu_memory_utilization - 权重显存 - 开销
```

- `gpu_memory_utilization`：vLLM 默认 0.9，即只用 90% 显存，留 10% 给 CUDA 上下文和碎片
- `开销`：激活值、临时缓冲区等，通常 1-3 GB

### Step 4: 计算最大并发

```
KV token 总预算 = 可用 KV 显存 / kv_per_token
最大并发请求数 = KV token 总预算 / 每请求平均 token 数
```

**每请求的 token 数 = 输入 token + 输出 token**，两者都占 KV cache。

注意：这是**理论上限**。实际运行中，vLLM 的 PagedAttention 会有一定的内存碎片，实际可用通常是理论值的 85-95%。

### Step 5: 估算吞吐量

**Decode 吞吐（bandwidth-bound 区域）：**

```
单 token 延迟 = 权重大小(bytes) / 总带宽(bytes/s) + TP通信延迟
decode 吞吐 = batch_size / 单 token 延迟
```

**Prefill 吞吐（compute-bound 区域）：**

```
prefill 吞吐 ≈ 总算力(FLOPS) / (2 × 模型参数量)   （tokens/s）
```

粗估因子 `2` 来自每个参数在前向传播中大约做 2 次浮点运算（乘加各一次）。

**实际吞吐**是 prefill 和 decode 的混合，取决于请求的输入/输出比例。Batch 推理（输入长、输出短）以 prefill 为主；对话场景（输入短、输出长）以 decode 为主。

---

## vLLM 的自动并发管理

### 并发数不需要手动设定

vLLM 使用 **continuous batching（连续批处理）** 和 **PagedAttention（分页注意力）**，并发数是动态自适应的。

工作方式：

1. 启动时，vLLM 根据配置参数（显存利用率、KV cache 精度等）自动算出 KV cache 总预算
2. 请求进来时，调度器检查"还有没有 KV cache 空间"：
   - 有空间 → 立刻接入，和现有请求一起 batch 处理
   - 没空间 → 排队等待，直到某个请求完成、释放 KV cache
3. 短请求多的时候，自动并发高；长请求多的时候，自动并发低

不需要计算"该设并发数为 115 还是 57"然后填进配置里。vLLM 在运行时会做动态调度。

### 并发的本质是一个反比例函数

```
最大并发 = 可用 KV 显存 / (每 token KV 大小 × 每请求 token 数)
         = 常数 K / X
```

- X 轴：每个请求的上下文 token 长度（输入+输出）
- Y 轴：最大能支持的并发数
- 关系：纯粹的 Y = K/X

前面所有的概念讲解和计算步骤，都是在确定那个常数 K 的值。K 由硬件（显存大小、显存利用率）和模型架构（层数、KV 头数、头维度、KV cache 精度）共同决定。

### max-model-len 是"门槛"，不是"预留"

`max-model-len` 不会给每个请求预留那么多显存。PagedAttention 是**按需分配**的——一个实际只用 2K token 的请求，无论 `max-model-len` 设的是 4096 还是 262144，它都只占 2K × 128KB = 256 MB 的 KV cache。

```
max-model-len = 262144, 实际请求 2K token → KV 占用 256 MB
max-model-len = 4096,   实际请求 2K token → KV 占用 256 MB   ← 一模一样
```

`max-model-len` 的唯一作用是设定"允许进入的最大请求长度"。超过这个长度的请求会被拒绝。

启动时 vLLM 会校验：可用 KV 显存能不能装得下至少一个 max-model-len 长度的请求。只要通过校验，设多大都不影响短请求的并发。

### 混合负载场景

一个 vLLM 实例可以同时处理长请求和短请求：

**全是短请求时：**
```
KV 总预算 ≈ 47 万 tokens
每请求 2K tokens → 同时跑 ~230 个请求
```

**来了一个 64K 长请求 + 短请求混合时：**
```
长请求占用:   64K × 128KB = 8.2 GB
剩余 KV:     58 - 8.2 = ~50 GB
短请求并发:   50 GB / (2K × 128KB) ≈ 200 个
```

**来了 3 个 64K 长请求 + 短请求混合时：**
```
3 个长请求:   3 × 8.2 GB = 24.6 GB
剩余 KV:     58 - 24.6 = ~33 GB
短请求并发:   33 GB / (2K × 128KB) ≈ 134 个
```

vLLM 的调度器每一步都在做这个动态计算。长请求在跑的时候，短请求的并发自动降低；长请求跑完释放 KV cache 后，短请求的并发自动恢复。

---

## 实战案例：Qwen3.6-27B FP8 on 2x L20

### 硬件参数

| 参数 | 值 |
|---|---|
| GPU | 2x NVIDIA L20 |
| 每卡显存 | 48 GB GDDR6 |
| 总显存 | 96 GB |
| 每卡带宽 | 864 GB/s |
| 总带宽 (TP=2) | 1,728 GB/s |
| 每卡 FP16 算力 | ~120 TFLOPS |
| 卡间互联 | PCIe Gen4 x16 (~32 GB/s) |

### 模型架构参数

| 参数 | 值 |
|---|---|
| 模型 | Qwen3.6-27B |
| 架构 | Dense（非 MoE） |
| 精度 | FP8 |
| 总参数量 | ~27B |
| num_hidden_layers | 64 |
| num_attention_heads | 24 |
| num_key_value_heads | 4 |
| head_dim | 256 |
| hidden_size | 5120 |
| max_position_embeddings | 262,144 |
| 权重大小 (FP8) | ~28 GB |

### 计算过程

#### 1) 每 token 的 KV cache 大小

```
BF16 KV cache:
  = 2 × 4 × 256 × 2 bytes × 64 layers
  = 2 × 4 × 256 × 2 × 64
  = 262,144 bytes
  = 256 KB / token

FP8 KV cache:
  = 2 × 4 × 256 × 1 byte × 64 layers
  = 131,072 bytes
  = 128 KB / token
```

#### 2) 可用 KV cache 显存

```
总显存:       96 GB
权重 (FP8):  -28 GB
vLLM 保留:   -96 × 0.08 ≈ -7.7 GB    (gpu_memory_utilization=0.92)
激活开销:    -2 GB
─────────────────────
可用 KV:     ≈ 58 GB
```

#### 3) KV token 预算和最大并发

**使用 FP8 KV cache（128 KB/token）：**

```
KV token 预算 = 58 GB / 128 KB = 474,317 tokens ≈ 47 万 tokens
```

| 场景 | 每请求 token 数 (输入+输出) | 最大并发 | 适用场景 |
|---|---|---|---|
| 短文本分类 | 512 | **925** | 情感分析、标签分类 |
| 一般问答 | 2,048 | **231** | 知识问答、简短生成 |
| 中等对话 | 4,096 | **115** | 多轮对话、文本改写 |
| 长文档处理 | 8,192 | **57** | 摘要、翻译 |
| 代码生成 | 16,384 | **28** | 复杂代码生成（含 thinking） |
| 长上下文 | 32,768 | **14** | 长文档分析 |

**使用 BF16 KV cache（256 KB/token，默认精度）：**

```
KV token 预算 = 58 GB / 256 KB = 237,158 tokens ≈ 24 万 tokens
```

| 场景 | 每请求 token 数 | 最大并发 |
|---|---|---|
| 短文本分类 | 512 | **462** |
| 一般问答 | 2,048 | **115** |
| 中等对话 | 4,096 | **57** |
| 长文档处理 | 8,192 | **28** |
| 代码生成 | 16,384 | **14** |
| 长上下文 | 32,768 | **7** |

#### 4) 吞吐量估算

**单 token decode 延迟（TP=2）：**

```
权重读取:    28 GB / 1,728 GB/s = 16.2 ms
TP 通信:     每层 2 次 all-reduce，64 层
             估算 ~5-8 ms 总通信开销（PCIe 瓶颈）
─────────────────────────
单 token ≈  22-24 ms
单请求生成速度 ≈ 42-45 tokens/s
```

**Batch 吞吐（decode 阶段）：**

| Batch size | 总吞吐 (tokens/s) | 说明 |
|---|---|---|
| 1 | ~43 | 单请求，bandwidth-bound |
| 8 | ~340 | 接近线性提升 |
| 32 | ~1,200 | 开始接近 compute-bound |
| 64 | ~1,800 | 接近饱和 |
| 128 | ~2,200 | 接近 L20 算力上限 |

这些是 decode 阶段的粗估。实际吞吐还取决于 prefill 占比——如果批量任务输入很长（比如几千 token 输入 + 几百 token 输出），prefill 阶段可能占大部分时间，而 prefill 的并行效率更高。

---

## vLLM 关键参数优化

### 核心优化参数

以下三个 vLLM 参数对推理并发和延迟影响最大：

```bash
vllm serve <model_path> \
  --kv-cache-dtype fp8 \
  --max-model-len 65536 \
  --enable-chunked-prefill
```

### 参数详解

**参数 1：`--kv-cache-dtype fp8` → 并发翻倍**

这是影响最大的一个参数。

一个关键的默认行为：即使模型权重是 FP8，vLLM 的 KV cache 默认仍然用 BF16 存储。加了 `--kv-cache-dtype fp8` 后，KV cache 从 BF16（256 KB/token）变成 FP8（128 KB/token），同样的显存能存两倍的 token，并发直接翻倍。

| 每请求 token 数 | 原始（BF16 KV） | 加 FP8 KV 后 | 变化 |
|---|---|---|---|
| 2K | ~115 | **~230** | **x2** |
| 4K | ~57 | **~115** | **x2** |
| 8K | ~28 | **~57** | **x2** |
| 16K | ~14 | **~28** | **x2** |

FP8 KV cache 的精度损失在绝大多数任务中可以忽略不计。

**参数 2：`--max-model-len 65536` → 请求长度保护**

不改变并发数（前面已经解释过，这是门槛不是预留）。作用是：
- 允许长上下文任务进入（最长 64K token）
- 拒绝意外的超长请求，防止单个请求吃掉大量 KV cache
- 根据实际需要设定，可以是 32768、65536、131072 或 262144

**参数 3：`--enable-chunked-prefill` → 混合负载下的延迟改善**

不改变并发数，改善响应延迟。

```
不开:  一个 32K token 的长输入进来 → 独占 GPU 做 prefill → 其他请求全部等着
开了:  长输入被切成小块 → 每块之间穿插处理其他请求的 decode → 短请求不会被饿死
```

对同时处理长请求和短请求的混合场景特别有用。

### 优化前后对比

| 指标 | 默认配置 | 加三个参数后 | 改善幅度 |
|---|---|---|---|
| 最大并发 (4K 请求) | ~57 | **~115** | **x2** |
| 最大并发 (2K 请求) | ~115 | **~230** | **x2** |
| 长请求 prefill 时短请求延迟 | 高（被阻塞） | 低（交错处理） | 显著改善 |
| 超长请求保护 | 无（接受 262K） | 有（超 64K 拒绝） | 防止意外 |

核心收益来自 `--kv-cache-dtype fp8`，并发直接翻倍。另外两个是锦上添花。

### 其他常用参数

| 参数 | 值 | 说明 |
|---|---|---|
| `--tensor-parallel-size` | GPU 数量 | 多张卡时张量并行 |
| `--gpu-memory-utilization` | 0.9 | 用 90% 的显存。想更激进可以设 0.92-0.95 |
| `--max-num-seqs` | 默认 256 | 最大并发序列数上限。默认值足够大，一般不需要改 |
| `--max-num-batched-tokens` | 默认自动 | 每个调度 step 最多处理的 token 数。默认值对大多数场景够用 |

### 关闭 thinking mode

一些支持 thinking 的模型（如 Qwen3.6）默认开启深度思考，输出会非常长（32K-81K tokens）。对于不需要深度推理链的任务，可以在请求的 system prompt 中加入：

```
/no_think
```

或者在 chat template 中配置 `enable_thinking=False`。这会大幅减少输出 token 数，从而减少每个请求的 KV cache 占用，显著提高并发。

### max-model-len 选择建议

根据实际最长请求长度设定 max-model-len：

| 最长任务的上下文长度 | 建议 max-model-len | 校验（x128KB < 58GB?） |
|---|---|---|
| ~8K | 8192 | 1 GB |
| ~32K | 32768 | 4.2 GB |
| ~64K | 65536 | 8.4 GB |
| ~128K | 131072 | 16.8 GB |
| ~262K（模型上限） | 262144 | 33.6 GB |

所有值都通过校验（小于可用 KV 显存 58 GB），所以都可以设。设成真正会用到的最长长度即可。短请求不受影响。

---

## 附录：快速估算清单

给定任意模型和硬件，按以下步骤估算并发：

```
1. 查模型 config.json，记录:
   - num_hidden_layers (L)
   - num_key_value_heads (H_kv)
   - head_dim (D)
   - 总参数量 (P)

2. 算权重显存:
   W = P × bytes_per_param
   (FP8: ×1, BF16: ×2, INT4: ×0.5)

3. 算每 token KV cache:
   KV_token = 2 × H_kv × D × bytes_per_element × L
   (FP8 KV: bytes=1, BF16 KV: bytes=2)

4. 算可用 KV 显存:
   KV_mem = GPU总显存 × utilization - W - overhead(≈2GB)

5. 算最大并发:
   max_concurrent = KV_mem / (KV_token × tokens_per_request)

6. 算 decode 吞吐:
   latency_per_token = W / bandwidth
   throughput = batch_size / latency_per_token
```
