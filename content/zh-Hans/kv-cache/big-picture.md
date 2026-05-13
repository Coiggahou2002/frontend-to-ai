# 5. 全景总结

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

KV cache 是单个请求的显存账。下一章把视角拉到部署层面：在固定的显存预算和固定的每 token KV 成本下，到底能跑多少并发请求？这些请求会经历什么样的延迟？

下一节：[推理并发 →](../inference-concurrency)
