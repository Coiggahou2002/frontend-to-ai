# 2. How Inference Frameworks Manage KV Cache

Model architecture determines what the KV cache stores and how large each token's cache is. The inference framework determines how that data is laid out in GPU memory, scheduled, and reused.

## The Simple Approach: Contiguous Pre-allocation

Frameworks like HuggingFace Transformers use a straightforward method: pre-allocate a contiguous tensor of `max_length × kv_size` for each request.

Problems:
- If a request only uses 2K tokens but max_length is 4K, half the memory is wasted
- Different requests have different actual lengths, but pre-allocation uses the maximum — severe fragmentation
- Hard to support high concurrency

## PagedAttention: vLLM's Core Innovation

vLLM's PagedAttention borrows from the operating system's virtual memory paging mechanism:

1. Divide KV cache GPU memory into fixed-size "pages" (blocks)
2. Each request claims pages on demand — only allocate as many pages as tokens actually used
3. Release pages back to the free pool when a request completes
4. Pages from different requests can be scattered non-contiguously across GPU memory

Results:
- Memory utilization jumps from 60-70% (pre-allocation) to 95%+
- Dynamic concurrency — automatically packs more short requests, yields space when long requests arrive
- Same GPU memory supports far more concurrent requests

## Framework Comparison

| Framework | KV Cache Management | Characteristics |
|---|---|---|
| HuggingFace Transformers | Contiguous tensor pre-allocation | Simple, highly wasteful |
| vLLM | PagedAttention paged management | High utilization, dynamic concurrency |
| SGLang | RadixAttention | Paging + radix tree optimization |
| TensorRT-LLM | Paging + NVIDIA kernel fusion | High performance, NVIDIA-only |
| llama.cpp | Contiguous buffer | Lightweight, suited for single requests |

Paging fixes layout. The next layer down is precision — how many bytes each KV element actually takes.

Next: [Precision optimization →](./precision-optimization)
