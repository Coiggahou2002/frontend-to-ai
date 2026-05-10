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

---

## How Model Architecture Determines KV Cache Size

### The Formula

The KV cache size per token is determined by architectural parameters:

```
KV cache per token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                     ↑         ↑            ↑              ↑              ↑
                   K and V   KV heads   dim per head   storage precision   model layers
```

All these parameters can be found in a model's config.json.

### How Different Attention Mechanisms Affect Size

Different models use different attention mechanisms at the architecture level to compress KV cache, with dramatically different results:

**Multi-Head Attention (MHA)**: Each Query head has its own independent K head and V head. 24 attention heads means storing 24 sets of KV. This is the original design with the largest KV cache.

**Grouped-Query Attention (GQA)**: Multiple Query heads share one set of KV heads. For example, Qwen3.6-27B uses 24 Query heads sharing 4 KV heads (6:1 compression ratio), shrinking KV cache to 1/6 of MHA. Most current open-source models use this approach.

**Multi-head Latent Attention (MLA)**: The approach used by DeepSeek-V2/V3 and Kimi K2. It projects the entire KV into a low-dimensional latent vector for storage, decompressing at inference time. Compression ratios can exceed 10x, at the cost of extra computation for decompression. MLA uses a different KV cache formula:

```
KV cache per token = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

### Model Comparison

Here are KV cache sizes per token for several representative models (BF16 precision):

| Model | Attention Type | Layers | KV Heads | Head Dim | KV per Token (BF16) |
|---|---|---|---|---|---|
| Llama 3.1 70B | GQA | 80 | 8 | 128 | 327 KB |
| Qwen3.6-27B | GQA | 64 | 4 | 256 | 256 KB |
| DeepSeek-V3 | MLA | 61 | - | c_kv=512 | ~69 KB |
| Kimi K2.6 | MLA | 61 | - | c_kv=512 | ~69 KB |

MLA models have only 1/4 to 1/5 the per-token KV cache of GQA models — this is why DeepSeek and Kimi can support longer contexts with less GPU memory.

---

## How Inference Frameworks Manage KV Cache

Model architecture determines what the KV cache stores and how large each token's cache is. The inference framework determines how that data is laid out in GPU memory, scheduled, and reused.

### The Simple Approach: Contiguous Pre-allocation

Frameworks like HuggingFace Transformers use a straightforward method: pre-allocate a contiguous tensor of `max_length × kv_size` for each request.

Problems:
- If a request only uses 2K tokens but max_length is 4K, half the memory is wasted
- Different requests have different actual lengths, but pre-allocation uses the maximum — severe fragmentation
- Hard to support high concurrency

### PagedAttention: vLLM's Core Innovation

vLLM's PagedAttention borrows from the operating system's virtual memory paging mechanism:

1. Divide KV cache GPU memory into fixed-size "pages" (blocks)
2. Each request claims pages on demand — only allocate as many pages as tokens actually used
3. Release pages back to the free pool when a request completes
4. Pages from different requests can be scattered non-contiguously across GPU memory

Results:
- Memory utilization jumps from 60-70% (pre-allocation) to 95%+
- Dynamic concurrency — automatically packs more short requests, yields space when long requests arrive
- Same GPU memory supports far more concurrent requests

### Framework Comparison

| Framework | KV Cache Management | Characteristics |
|---|---|---|
| HuggingFace Transformers | Contiguous tensor pre-allocation | Simple, highly wasteful |
| vLLM | PagedAttention paged management | High utilization, dynamic concurrency |
| SGLang | RadixAttention | Paging + radix tree optimization |
| TensorRT-LLM | Paging + NVIDIA kernel fusion | High performance, NVIDIA-only |
| llama.cpp | Contiguous buffer | Lightweight, suited for single requests |

---

## KV Cache Precision Optimization

Beyond architecture-level compression (GQA, MLA), inference frameworks can also optimize at the storage precision level.

### The Effect of `--kv-cache-dtype fp8`

vLLM supports quantizing KV cache from the default BF16 (2 bytes per element) down to FP8 (1 byte per element).

An easily overlooked default behavior: **even if model weights are FP8, vLLM's KV cache still defaults to BF16 storage.** You must explicitly add `--kv-cache-dtype fp8` to make the KV cache use FP8 as well.

The effect is that per-token KV cache is cut in half, doubling concurrency under the same memory budget:

| Metric | BF16 KV (default) | FP8 KV |
|---|---|---|
| KV per token (Qwen3.6-27B) | 256 KB | 128 KB |
| Token budget with 58GB KV memory | ~240K | ~470K |
| Max concurrency at 4K tokens/request | ~57 | ~115 |

FP8 KV cache precision loss is negligible for the vast majority of tasks — it is one of the highest-ROI optimizations available.

---

## Prefix Caching: Reusing KV Cache for Shared Prefixes

### The Problem

In many real-world applications, large numbers of requests share the same prefix. The most typical case is the system prompt — every request sent to an LLM carries the same system prompt, followed by a different user message.

Without optimization, every request recomputes the system prompt's KV cache, repeating identical computation:

```
Request 1:   [system prompt 2K tokens] + [user msg A 500 tokens]  → prefill 2500 tokens
Request 2:   [system prompt 2K tokens] + [user msg B 500 tokens]  → prefill 2500 tokens
...
Request 100: [system prompt 2K tokens] + [user msg Z 500 tokens]  → prefill 2500 tokens

Total prefill computation: 100 × 2500 = 250,000 tokens
Of which 200,000 tokens are entirely redundant computation
```

### How Prefix Caching Works

The idea behind Prefix Caching is straightforward: **compute the KV cache for a shared prefix only once, and reuse it for subsequent requests.**

```
Request 1:  [system prompt 2K] → Compute KV cache, index by token sequence hash
            [user msg A 500]   → Only compute these 500 tokens

Request 2:  [system prompt 2K] → Hash hit, directly reference Request 1's KV cache pages (zero computation)
            [user msg B 500]   → Only compute these 500 tokens

...

Total prefill computation: 2000 + 100 × 500 = 52,000 tokens
```

Down from 250,000 to 52,000 — roughly 80% savings in prefill computation.

### This Is Purely a KV Cache Optimization

Prefix Caching uses no mechanism outside of KV cache. Its essence is:

1. After computing a segment's KV cache, instead of discarding it immediately, cache it indexed by content hash
2. If a subsequent request has the same prefix, directly reference the existing KV cache pages
3. Only compute new KV cache for the differing parts (user messages)

In vLLM's PagedAttention this is particularly natural — KV cache is already stored in pages, so multiple requests sharing a prefix can point to the same physical pages without copying. This is analogous to the copy-on-write mechanism in operating systems.

### Triple Benefits

| Benefit | Mechanism |
|---|---|
| Save computation | Shared prefix is prefilled only once; subsequent requests skip it |
| Save memory | Shared prefix KV cache is stored once in memory; multiple requests reference the same pages |
| Increase throughput | Faster prefill phase frees more GPU time for decode |

### Platform Implementations

| Platform | Feature Name | Effect | How to Trigger |
|---|---|---|---|
| Anthropic (Claude) | Prompt Caching | Cached tokens cost **90% less**, 5-minute TTL | Mark `cache_control` in API |
| OpenAI | Prompt Caching | Cached tokens cost **50% less**, automatic | Automatic (prefix >= 1024 tokens) |
| vLLM (self-hosted) | Automatic Prefix Caching | Saves GPU compute and memory | `--enable-prefix-caching` |
| SGLang | RadixAttention | Finer-grained caching via radix tree | Enabled by default |

### Self-Hosting in Practice

If a batch workload has many requests sharing the same system prompt, adding a single parameter to the vLLM launch command enables prefix caching:

```bash
--enable-prefix-caching
```

For example, with 100 requests sharing a 2K-token system prompt, this one flag effectively gives 200K tokens of prefill computation for free — pure savings at zero cost.

---

## Big Picture Summary

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
