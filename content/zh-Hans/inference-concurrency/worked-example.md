# 4. 实战案例：Qwen3.6-27B FP8 on 2x L20

是时候把所有公式落到具体数字上。这是我们前面一直在引用的部署——Qwen3.6-27B FP8 跑在 2 张 L20 上——从头到尾算一遍。把你自己的模型和 GPU 套进同一个模板里，就能得到对应的结果。

## 硬件参数

| 参数 | 值 |
|---|---|
| GPU | 2x NVIDIA L20 |
| 每卡显存 | 48 GB GDDR6 |
| 总显存 | 96 GB |
| 每卡带宽 | 864 GB/s |
| 总带宽 (TP=2) | 1,728 GB/s |
| 每卡 FP16 算力 | ~120 TFLOPS |
| 卡间互联 | PCIe Gen4 x16 (~32 GB/s) |

## 模型架构参数

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

## 计算过程

### 1) 每 token 的 KV cache 大小

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

### 2) 可用 KV cache 显存

```
总显存:       96 GB
权重 (FP8):  -28 GB
vLLM 保留:   -96 × 0.08 ≈ -7.7 GB    (gpu_memory_utilization=0.92)
激活开销:    -2 GB
─────────────────────
可用 KV:     ≈ 58 GB
```

### 3) KV token 预算和最大并发

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

### 4) 吞吐量估算

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

注意上表中 FP8 与 BF16 KV cache 这一对，差距正好是干净的 2 倍。这不是巧合——它是 vLLM CLI 里你能拉到的最大杠杆，下一节就讲该开哪些参数。

下一节：[vLLM 调参](./vllm-tuning-parameters)
