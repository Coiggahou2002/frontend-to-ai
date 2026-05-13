# 1. 模型架构如何决定 KV Cache 的大小

第一个杠杆在模型本身。任何框架介入之前，架构就已经决定了每个 token 要花多少字节的 KV cache。

## 计算公式

每个 token 在模型中产生的 KV cache 大小由架构参数决定：

```
每 token KV cache = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                    ↑         ↑            ↑              ↑              ↑
                  K和V      KV 头数     每头维度     存储精度决定      模型层数
```

这些参数都可以在模型的 config.json 中找到。

## 不同注意力机制的影响

不同模型在架构层面使用不同的注意力机制来压缩 KV cache，效果差异巨大：

**标准多头注意力（MHA）**：每个 Query 头对应一个独立的 K 头和 V 头。24 个注意力头就需要存 24 组 KV。这是最原始的设计，KV cache 最大。

**分组查询注意力（GQA）**：让多个 Query 头共享一组 KV 头。例如 Qwen3.6-27B 用 24 个 Query 头共享 4 个 KV 头（6:1 压缩比），KV cache 缩小为 MHA 的 1/6。目前大多数开源模型采用这种方案。

**多头潜注意力（MLA）**：DeepSeek-V2/V3 和 Kimi K2 使用的方案。把整个 KV 投影到一个低维潜向量中存储，推理时再解压。压缩比可达 10 倍以上，代价是解压需要额外计算。MLA 的 KV cache 公式也不同：

```
每 token KV cache = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

## 具体模型对比

以下是几个代表性模型的每 token KV cache 大小（BF16 精度）：

| 模型 | 注意力机制 | 层数 | KV 头数 | 头维度 | 每 token KV (BF16) |
|---|---|---|---|---|---|
| Llama 3.1 70B | GQA | 80 | 8 | 128 | 327 KB |
| Qwen3.6-27B | GQA | 64 | 4 | 256 | 256 KB |
| DeepSeek-V3 | MLA | 61 | - | c_kv=512 | ~69 KB |
| Kimi K2.6 | MLA | 61 | - | c_kv=512 | ~69 KB |

MLA 模型的每 token KV cache 只有 GQA 模型的 1/4 到 1/5，这就是为什么 DeepSeek 和 Kimi 能用更少的显存支持更长的上下文。

架构定下了每 token KV 成本的下限。模型选定之后，下一个问题是推理框架怎么在显存中摆放这些数据。

下一节：[框架管理 →](./framework-management)
