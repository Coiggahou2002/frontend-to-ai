# 1. Prefill 与 Decode

在做任何并发数学之前，你需要先建立一个正确的心智模型——*推理服务在每个 token 上到底在做什么*。LLM 推理可以非常清晰地切分成两个阶段，两个阶段的瓶颈完全不同。把这两者混淆，是并发估算最常见的错因。

## 推理过程的两个阶段

**Prefill（预填充）**：把用户的整个输入一次性送入模型，计算所有 token 的 KV cache。这个阶段是**计算瓶颈（compute-bound）**，因为所有输入 token 可以并行计算，GPU 的算力是限制因素。

**Decode（解码/生成）**：逐个生成输出 token。每生成一个 token，需要加载整个模型的权重做一次前向传播，但只产出一个 token。这个阶段是**带宽瓶颈（memory-bandwidth-bound）**，因为每次都要把数十 GB 的权重从显存搬到计算单元，但计算量很小。

这个区别决定了一个关键事实：**decode 阶段是 batch 越大越划算的**，因为模型权重只加载一次，就能同时给 batch 中所有请求各生成一个 token。

## KV Cache（回顾）

KV cache 是 LLM 推理中最核心的显存消耗项之一。背景在 [第 7 章](../kv-cache) 已经讲过；这里我们只需要每 token 的公式，因为它是后续所有并发计算的引擎。

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

## GQA（Grouped Query Attention）

标准多头注意力（MHA）中，每个 Query 头对应一个独立的 K 头和 V 头。如果有 24 个注意力头，就需要存 24 组 KV。

GQA 的思路是让多个 Query 头共享一组 KV 头。例如 24 个 Query 头共享 4 个 KV 头（压缩比 6:1），KV cache 直接缩小为原来的 1/6。

GQA 对推理的影响是双重的：
- **省显存**：KV cache 更小，同样的显存能缓存更多 token，支持更长上下文或更多并发
- **省带宽**：decode 时读取的 KV cache 更少，每个 token 的生成更快

这就是为什么 `num_kv_heads` 是并发估算中最关键的架构参数之一。

## MLA（Multi-head Latent Attention）

MLA 是 DeepSeek-V2/V3 系列和 Kimi K2 使用的注意力机制，比 GQA 更进一步：把整个 KV 投影到一个低维的潜向量中存储，推理时再解压。KV cache 压缩比可达 10 倍以上。

MLA 模型的 KV cache 公式不同：

```
每 token KV cache = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

本章后面的实战案例使用的是 GQA 模型（Qwen3.6-27B），所以全程用 GQA 公式。

## 显存带宽 vs 计算算力

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

## Tensor Parallelism（张量并行）

当模型太大、一张卡装不下时，可以把模型切分到多张卡上。每张卡负责一部分计算，中间通过 all-reduce 通信同步。

TP 的收益：
- 显存翻倍：2 卡 = 2 倍显存
- 带宽翻倍：2 卡 = 2 倍总带宽，单 token 延迟减半

TP 的代价：
- 每一层都需要卡间通信（all-reduce）
- NVLink（900 GB/s）通信开销很小，PCIe Gen4（~32 GB/s）开销显著
- 没有 NVLink 的 GPU（如 L20）只能用 PCIe，TP 通信会增加延迟

---

有了这六块拼图——两个阶段、KV cache 公式、GQA/MLA、带宽 vs 算力、TP——我们已经具备了把架构参数转换成并发数所需的全部工具。下一节就是这套五步流程。

下一节：[估算方法论](./estimation-method)
