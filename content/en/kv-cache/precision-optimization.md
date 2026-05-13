# 3. KV Cache Precision Optimization

Beyond architecture-level compression (GQA, MLA), inference frameworks can also optimize at the storage precision level.

## The Effect of `--kv-cache-dtype fp8`

vLLM supports quantizing KV cache from the default BF16 (2 bytes per element) down to FP8 (1 byte per element).

An easily overlooked default behavior: **even if model weights are FP8, vLLM's KV cache still defaults to BF16 storage.** You must explicitly add `--kv-cache-dtype fp8` to make the KV cache use FP8 as well.

The effect is that per-token KV cache is cut in half, doubling concurrency under the same memory budget:

| Metric | BF16 KV (default) | FP8 KV |
|---|---|---|
| KV per token (Qwen3.6-27B) | 256 KB | 128 KB |
| Token budget with 58GB KV memory | ~240K | ~470K |
| Max concurrency at 4K tokens/request | ~57 | ~115 |

FP8 KV cache precision loss is negligible for the vast majority of tasks — it is one of the highest-ROI optimizations available.

Architecture, layout, and precision all attack the same problem from different angles: making each request's KV footprint smaller. The fourth lever is different — instead of shrinking one request's cache, it eliminates duplicate caches across requests.

Next: [Prefix caching →](./prefix-caching)
