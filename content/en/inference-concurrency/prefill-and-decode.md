# 1. Prefill and Decode

Before any concurrency math makes sense, you need the right mental model for *what an inference server is doing per token*. LLM inference splits cleanly into two phases with two completely different bottlenecks. Mixing them up is the single most common reason concurrency estimates are wrong.

## The two phases

**Prefill**: The entire user input is fed into the model at once to compute the KV cache for all input tokens. This phase is **compute-bound** because all input tokens can be processed in parallel, making GPU compute the limiting factor.

**Decode (generation)**: Output tokens are generated one at a time. Each new token requires loading the entire model weights for a forward pass, but produces only one token. This phase is **memory-bandwidth-bound** because tens of gigabytes of weights must be transferred from VRAM to the compute units each time, while the actual computation is minimal.

This distinction leads to a key insight: **decode becomes more efficient with larger batches**, because the model weights are loaded once but produce one token for every request in the batch simultaneously.

## KV Cache (recap)

KV cache is one of the most significant VRAM consumers during LLM inference. We covered the why in [Chapter 7](../kv-cache); here we just need the per-token formula because it's the engine of every concurrency calculation in the rest of this chapter.

In the Transformer self-attention mechanism, generating each new token requires attending to all previous tokens. Recomputing the Key and Value vectors for all previous tokens every time would cause computation to grow quadratically with sequence length.

KV caching solves this by computing each token's K and V vectors once per layer, then storing them in VRAM for later reuse. This trades space (VRAM) for time (computation) and is standard practice in modern LLM inference.

**Per-token KV cache size depends on the model architecture:**

```
KV cache per token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                     ↑              ↑           ↑           ↑               ↑
                   K and V      KV head count  dim per head  precision    layer count
```

Where:
- `2` = one copy each for K and V
- `num_kv_heads` = number of KV heads (after GQA compression)
- `head_dim` = dimension of each attention head
- `bytes_per_element` = bytes per element (BF16=2, FP8=1)
- `num_layers` = number of model layers

## GQA (Grouped Query Attention)

In standard Multi-Head Attention (MHA), each Query head has its own independent K and V heads. With 24 attention heads, you need to store 24 sets of KV pairs.

GQA lets multiple Query heads share a single set of KV heads. For example, 24 Query heads sharing 4 KV heads (6:1 compression ratio) reduces the KV cache to 1/6 of the original size.

GQA benefits inference in two ways:
- **Saves VRAM**: Smaller KV cache means more tokens can be cached in the same memory, enabling longer contexts or higher concurrency
- **Saves bandwidth**: Less KV cache to read during decode means faster per-token generation

This is why `num_kv_heads` is one of the most critical architecture parameters for concurrency estimation.

## MLA (Multi-head Latent Attention)

MLA is the attention mechanism used in DeepSeek-V2/V3 and Kimi K2. It goes further than GQA by projecting the entire KV into a low-dimensional latent vector for storage, then decompressing during inference. KV cache compression ratios can exceed 10x.

The KV cache formula for MLA models is different:

```
KV cache per token = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

The worked example later in this chapter uses a GQA model (Qwen3.6-27B), so we use the GQA formula throughout.

## Memory bandwidth vs compute

| Metric | Meaning | Phase Affected |
|---|---|---|
| Memory bandwidth (GB/s) | How much data can be read from VRAM per second | Decode (primary bottleneck) |
| Compute (TFLOPS) | How many floating-point operations per second | Prefill (primary bottleneck) |

**Rough estimate for decode single-token latency:**

```
Single token latency ≈ model_weight_size(bytes) / total_memory_bandwidth(bytes/s)
```

This is because generating each token requires "scanning" through the entire model weights. Larger weights and lower bandwidth mean slower per-token generation.

**Throughput gains from batching:**

With batch size = N, the model weights are still loaded only once, but N requests each get one token generated simultaneously:

```
Total throughput ≈ N / single_token_latency    (until compute-bound)
```

Larger batches increase GPU compute utilization until the workload shifts from bandwidth-bound to compute-bound. This transition point is called the **arithmetic intensity saturation point**.

## Tensor Parallelism

When a model is too large to fit on a single GPU, it can be split across multiple GPUs. Each GPU handles a portion of the computation, with all-reduce communication for synchronization between layers.

TP benefits:
- Double the VRAM: 2 GPUs = 2x total VRAM
- Double the bandwidth: 2 GPUs = 2x total bandwidth, halving single-token latency

TP costs:
- Inter-GPU communication (all-reduce) is needed at every layer
- NVLink (900 GB/s) has minimal communication overhead; PCIe Gen4 (~32 GB/s) has significant overhead
- GPUs without NVLink (e.g., L20) are limited to PCIe, so TP communication adds noticeable latency

---

With these six pieces in hand — two phases, KV cache formula, GQA/MLA, bandwidth vs compute, and TP — we have everything needed to turn architecture parameters into a concurrency number. The next page lays out the five-step recipe.

Next: [Estimation Methodology](./estimation-method)
