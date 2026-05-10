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

---

## 模型架构如何决定 KV Cache 的大小

### 计算公式

每个 token 在模型中产生的 KV cache 大小由架构参数决定：

```
每 token KV cache = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                    ↑         ↑            ↑              ↑              ↑
                  K和V      KV 头数     每头维度     存储精度决定      模型层数
```

这些参数都可以在模型的 config.json 中找到。

### 不同注意力机制的影响

不同模型在架构层面使用不同的注意力机制来压缩 KV cache，效果差异巨大：

**标准多头注意力（MHA）**：每个 Query 头对应一个独立的 K 头和 V 头。24 个注意力头就需要存 24 组 KV。这是最原始的设计，KV cache 最大。

**分组查询注意力（GQA）**：让多个 Query 头共享一组 KV 头。例如 Qwen3.6-27B 用 24 个 Query 头共享 4 个 KV 头（6:1 压缩比），KV cache 缩小为 MHA 的 1/6。目前大多数开源模型采用这种方案。

**多头潜注意力（MLA）**：DeepSeek-V2/V3 和 Kimi K2 使用的方案。把整个 KV 投影到一个低维潜向量中存储，推理时再解压。压缩比可达 10 倍以上，代价是解压需要额外计算。MLA 的 KV cache 公式也不同：

```
每 token KV cache = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

### 具体模型对比

以下是几个代表性模型的每 token KV cache 大小（BF16 精度）：

| 模型 | 注意力机制 | 层数 | KV 头数 | 头维度 | 每 token KV (BF16) |
|---|---|---|---|---|---|
| Llama 3.1 70B | GQA | 80 | 8 | 128 | 327 KB |
| Qwen3.6-27B | GQA | 64 | 4 | 256 | 256 KB |
| DeepSeek-V3 | MLA | 61 | - | c_kv=512 | ~69 KB |
| Kimi K2.6 | MLA | 61 | - | c_kv=512 | ~69 KB |

MLA 模型的每 token KV cache 只有 GQA 模型的 1/4 到 1/5，这就是为什么 DeepSeek 和 Kimi 能用更少的显存支持更长的上下文。

---

## 推理框架如何管理 KV Cache

模型架构决定了 KV cache 存什么、每个 token 存多大。推理框架决定了这些数据怎么在显存中摆放、怎么调度、怎么复用。

### 简单方式：连续预分配

HuggingFace Transformers 等简单框架的做法：为每个请求预分配一个 `max_length × kv_size` 的连续张量。

问题：
- 如果请求实际只用了 2K token，但 max_length 是 4K，就浪费了一半显存
- 不同请求的实际长度不同，但预分配按最大长度算，碎片严重
- 难以支持高并发

### PagedAttention：vLLM 的核心创新

vLLM 提出的 PagedAttention 借鉴了操作系统的虚拟内存分页机制：

1. 把 KV cache 的显存切成固定大小的"页"（block）
2. 每个请求按需申请页——实际用了多少 token，就分配多少页
3. 请求完成后释放页，归还给空闲池
4. 不同请求的页可以不连续地散布在显存中

效果：
- 显存利用率从预分配方式的 60-70% 提升到 95%+
- 支持动态并发——短请求多时自动多塞，长请求来了自动让出空间
- 同一显存能支持更多并发请求

### 各框架对比

| 框架 | KV cache 管理方式 | 特点 |
|---|---|---|
| HuggingFace Transformers | 连续张量预分配 | 简单，浪费严重 |
| vLLM | PagedAttention 分页管理 | 高利用率，动态并发 |
| SGLang | RadixAttention | 类似分页 + 前缀树优化 |
| TensorRT-LLM | 分页 + NVIDIA 算子融合 | 高性能，NVIDIA 专用 |
| llama.cpp | 连续缓冲区 | 轻量，适合单请求 |

---

## KV Cache 精度优化

除了架构层面的压缩（GQA、MLA），推理框架还可以在存储精度上做文章。

### `--kv-cache-dtype fp8` 的效果

vLLM 支持将 KV cache 从默认的 BF16（每元素 2 bytes）量化到 FP8（每元素 1 byte）。

一个容易忽略的默认行为：**即使模型权重是 FP8，vLLM 的 KV cache 默认仍然用 BF16 存储。** 必须显式加 `--kv-cache-dtype fp8` 才能让 KV cache 也用 FP8。

效果是每 token 的 KV cache 直接减半，在同样的显存预算下并发翻倍：

| 指标 | BF16 KV（默认） | FP8 KV |
|---|---|---|
| 每 token KV (Qwen3.6-27B) | 256 KB | 128 KB |
| 可用 KV 显存 58GB 下的 token 预算 | ~24 万 | ~47 万 |
| 4K 请求最大并发 | ~57 | ~115 |

FP8 KV cache 的精度损失在绝大多数任务中可以忽略不计，是性价比最高的优化之一。

---

## Prefix Caching：共享前缀的 KV Cache 复用

### 问题场景

很多实际应用中，大量请求共享相同的前缀。最典型的就是 system prompt——发给 LLM 的每一个请求都带着同样的 system prompt，后面跟不同的 user message。

没有优化时，每个请求都要重新计算 system prompt 部分的 KV cache，重复了完全相同的计算：

```
请求 1:  [system prompt 2K tokens] + [user msg A 500 tokens]  → prefill 2500 tokens
请求 2:  [system prompt 2K tokens] + [user msg B 500 tokens]  → prefill 2500 tokens
...
请求 100: [system prompt 2K tokens] + [user msg Z 500 tokens]  → prefill 2500 tokens

总 prefill 计算量: 100 × 2500 = 250,000 tokens
其中 200,000 tokens 是完全重复的计算
```

### Prefix Caching 的机制

Prefix Caching（前缀缓存）的思路很直接：**相同前缀的 KV cache 只算一次，后续请求直接复用。**

```
请求 1:  [system prompt 2K] → 计算 KV cache，按 token 序列的哈希值索引存起来
         [user msg A 500]   → 只算这 500 tokens

请求 2:  [system prompt 2K] → 哈希命中，直接引用请求 1 的 KV cache 页（零计算）
         [user msg B 500]   → 只算这 500 tokens

...

总 prefill 计算量: 2000 + 100 × 500 = 52,000 tokens
```

从 250,000 降到 52,000，省了约 80% 的 prefill 计算量。

### 这完全是 KV cache 层面的优化

Prefix Caching 没有用到 KV cache 之外的任何机制。它的本质就是：

1. 计算完一段 token 的 KV cache 后，不立刻丢弃，而是按内容哈希索引缓存
2. 后续请求如果有相同的前缀，直接引用已有的 KV cache 页
3. 只对不同的部分（用户消息）计算新的 KV cache

在 vLLM 的 PagedAttention 中这特别自然——KV cache 本来就是分页存储的，共享前缀的多个请求可以指向同一组物理页，不需要复制。这类似操作系统中的 copy-on-write 机制。

### 三重收益

| 收益 | 原理 |
|---|---|
| 省计算 | 共享前缀只做一次 prefill，后续请求跳过 |
| 省显存 | 共享前缀的 KV cache 在内存中只存一份，多个请求引用同一组页 |
| 提高吞吐 | prefill 阶段更快，GPU 有更多时间做 decode |

### 各平台的实现

| 平台 | 名称 | 效果 | 触发方式 |
|---|---|---|---|
| Anthropic (Claude) | Prompt Caching | 缓存命中的 token 费用 **1 折**（省 90%），TTL 5 分钟 | API 中标记 cache_control |
| OpenAI | Prompt Caching | 缓存命中的 token 费用 **5 折**，自动触发 | 自动（前缀 ≥1024 tokens） |
| vLLM（自部署） | Automatic Prefix Caching | 省 GPU 算力和显存 | `--enable-prefix-caching` |
| SGLang | RadixAttention | 基于前缀树的更细粒度缓存 | 默认开启 |

### 自部署场景的实践

如果 batch 任务中大量请求共享同一个 system prompt，在 vLLM 启动命令中加一个参数即可生效：

```bash
--enable-prefix-caching
```

以 100 个请求共享 2K token system prompt 为例，这一个参数等于白送了 200K tokens 的 prefill 计算量——不花一分钱的纯收益。

---

## 全景总结

KV cache 贯穿了 LLM 推理的每一个层面。从模型架构到推理框架，所有优化都围绕同一个核心问题：**怎么在有限的显存中，更高效地存储和复用 KV cache。**

```
模型架构层:
  MHA → GQA → MLA                每 token 的 KV cache 越来越小

推理框架层:
  连续预分配 → PagedAttention      显存利用率越来越高

存储精度层:
  BF16 → FP8                      同样空间存两倍 token

复用策略层:
  无缓存 → Prefix Caching         相同前缀只算一次
```

这四个层面相互独立，可以叠加。一个使用 GQA 模型 + vLLM PagedAttention + FP8 KV cache + Prefix Caching 的部署，在每个层面都拿到了优化收益。
