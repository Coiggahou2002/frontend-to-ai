# KV Cache: From Theory to Engineering Optimization

## Why KV Cache Exists

### Starting from Transformer's Attention Mechanism

Modern large language models are almost universally built on the Transformer architecture. At the core of the Transformer is the self-attention mechanism: every time a new token is generated, it needs to compute attention against all previous tokens. This means the model must access the Key and Value vectors produced by each prior token at every layer.

If the model recomputed K and V for all previous tokens every time it generates a new one, computation would grow quadratically with sequence length — longer sequences get slower, and the work is entirely redundant.

The KV cache approach: compute each token's K and V vectors only once, cache them in GPU memory, and read directly from cache for subsequent tokens. This is a classic space-for-time tradeoff — using extra memory to eliminate redundant computation.

KV cache is not a feature invented by any particular framework, nor is it an optional protocol. It is an inherent dependency of Transformer-based inference — as long as you run inference with a Transformer, you must deal with KV cache.

### The Four-Layer Framework

Understanding KV cache requires distinguishing four layers, each solving a different problem:

| Layer | Who Owns It | What It Determines |
|---|---|---|
| Math definition | Transformer architecture | Inference must cache each token's K and V vectors |
| KV cache "shape" | Specific model architecture | How large is each token's KV cache (layers, KV heads, head dim) |
| KV cache compression | Attention mechanism variants | GQA, MLA, etc. reduce KV cache size at the architecture level |
| KV cache management | Inference framework | How to store, schedule, and reuse KV cache in GPU memory |

The first three layers are determined by the model; the last layer is determined by the inference framework. Together they determine the maximum context length and concurrency a deployment can support.

This chapter walks through all four:

1. [Model architecture](./model-architecture) — the formula and how attention variants (MHA, GQA, MLA) shrink per-token KV size
2. [Framework management](./framework-management) — contiguous pre-allocation vs. PagedAttention
3. [Precision optimization](./precision-optimization) — what `--kv-cache-dtype fp8` actually does
4. [Prefix caching](./prefix-caching) — reusing KV cache across requests with shared prefixes
5. [Big picture](./big-picture) — how the four layers stack

Next: [Model architecture →](./model-architecture)
