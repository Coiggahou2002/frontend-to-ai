# 4. Prefix Caching：共享前缀的 KV Cache 复用

## 问题场景

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

## Prefix Caching 的机制

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

## 这完全是 KV cache 层面的优化

Prefix Caching 没有用到 KV cache 之外的任何机制。它的本质就是：

1. 计算完一段 token 的 KV cache 后，不立刻丢弃，而是按内容哈希索引缓存
2. 后续请求如果有相同的前缀，直接引用已有的 KV cache 页
3. 只对不同的部分（用户消息）计算新的 KV cache

在 vLLM 的 PagedAttention 中这特别自然——KV cache 本来就是分页存储的，共享前缀的多个请求可以指向同一组物理页，不需要复制。这类似操作系统中的 copy-on-write 机制。

## 三重收益

| 收益 | 原理 |
|---|---|
| 省计算 | 共享前缀只做一次 prefill，后续请求跳过 |
| 省显存 | 共享前缀的 KV cache 在内存中只存一份，多个请求引用同一组页 |
| 提高吞吐 | prefill 阶段更快，GPU 有更多时间做 decode |

## 各平台的实现

| 平台 | 名称 | 效果 | 触发方式 |
|---|---|---|---|
| Anthropic (Claude) | Prompt Caching | 缓存命中的 token 费用 **1 折**（省 90%），TTL 5 分钟 | API 中标记 cache_control |
| OpenAI | Prompt Caching | 缓存命中的 token 费用 **5 折**，自动触发 | 自动（前缀 ≥1024 tokens） |
| vLLM（自部署） | Automatic Prefix Caching | 省 GPU 算力和显存 | `--enable-prefix-caching` |
| SGLang | RadixAttention | 基于前缀树的更细粒度缓存 | 默认开启 |

## 自部署场景的实践

如果 batch 任务中大量请求共享同一个 system prompt，在 vLLM 启动命令中加一个参数即可生效：

```bash
--enable-prefix-caching
```

以 100 个请求共享 2K token system prompt 为例，这一个参数等于白送了 200K tokens 的 prefill 计算量——不花一分钱的纯收益。

下一节：[全景总结 →](./big-picture)
