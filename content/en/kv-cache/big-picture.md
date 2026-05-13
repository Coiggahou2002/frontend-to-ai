# 5. Big Picture

KV cache touches every layer of LLM inference. From model architecture to inference framework, all optimizations revolve around the same core question: **how to store and reuse KV cache more efficiently within limited GPU memory.**

```
Model architecture layer:
  MHA → GQA → MLA                KV cache per token gets smaller

Inference framework layer:
  Contiguous pre-alloc → PagedAttention    Memory utilization gets higher

Storage precision layer:
  BF16 → FP8                     Same space stores twice the tokens

Reuse strategy layer:
  No caching → Prefix Caching    Shared prefixes computed only once
```

These four layers are independent and stackable. A deployment using a GQA model + vLLM PagedAttention + FP8 KV cache + Prefix Caching captures optimization gains at every layer.

KV cache is the per-request memory cost. The next chapter zooms out to the deployment level: given a fixed amount of GPU memory and a fixed per-token KV cost, how many concurrent requests can you actually run, and what governs the latency they experience?

Next: [Inference concurrency →](../inference-concurrency)
