# KV Cache：从原理到工程优化

## 为什么会有 KV Cache

### 从 Transformer 的注意力机制说起

现代大模型几乎都基于 Transformer 架构。Transformer 的核心是自注意力机制（Self-Attention）：每生成一个新 token，都需要和之前所有 token 做注意力计算。这意味着模型需要访问之前每个 token 在每一层产生的 Key 和 Value 向量。

如果每次生成新 token 都重新计算之前所有 token 的 K 和 V，计算量会随序列长度平方增长——序列越长越慢，而且重复计算完全相同的东西。

KV cache 的做法是：每个 token 的 K 和 V 向量只计算一次，算完后缓存在显存中，后续直接读取。这是一个经典的空间换时间策略，用额外的显存消耗来消除重复计算。

KV cache 不是某个框架发明的功能，也不是某种可选的协议。它是 Transformer 架构在推理时的必然依赖——只要你用 Transformer 做推理，就必须处理 KV cache。

### 四层分工

理解 KV cache 需要区分四个层面，它们各自解决不同的问题：

| 层面 | 谁负责 | 决定了什么 |
|---|---|---|
| 数学定义 | Transformer 架构 | 推理必须缓存每个 token 的 K 和 V 向量 |
| KV cache 的"形状" | 具体模型的架构设计 | 每个 token 的 KV cache 有多大（层数、KV 头数、头维度） |
| KV cache 的压缩 | 模型的注意力机制变体 | GQA、MLA 等技术在架构层面减小 KV cache 体积 |
| KV cache 的管理 | 推理框架 | 怎么在显存中存储、调度、复用 KV cache |

前三层由模型决定，最后一层由推理框架决定。两者共同决定了能跑多长的上下文、支持多少并发。

本章按这四层依次展开：

1. [模型架构](./model-architecture)——计算公式，以及 MHA、GQA、MLA 等注意力变体如何缩小每 token 的 KV
2. [框架管理](./framework-management)——连续预分配 vs. PagedAttention
3. [精度优化](./precision-optimization)——`--kv-cache-dtype fp8` 到底做了什么
4. [Prefix caching](./prefix-caching)——共享前缀的请求间复用 KV cache
5. [全景总结](./big-picture)——四层如何叠加

下一节：[模型架构 →](./model-architecture)
