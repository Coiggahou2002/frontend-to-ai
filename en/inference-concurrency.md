# LLM Inference Concurrency Estimation: Theory, Methods, and Practice

## Core Concepts

### 1. Two Phases of Inference

LLM inference consists of two fundamentally different phases, each with a different bottleneck:

**Prefill**: The entire user input is fed into the model at once to compute the KV cache for all input tokens. This phase is **compute-bound** because all input tokens can be processed in parallel, making GPU compute the limiting factor.

**Decode (generation)**: Output tokens are generated one at a time. Each new token requires loading the entire model weights for a forward pass, but produces only one token. This phase is **memory-bandwidth-bound** because tens of gigabytes of weights must be transferred from VRAM to the compute units each time, while the actual computation is minimal.

This distinction leads to a key insight: **decode becomes more efficient with larger batches**, because the model weights are loaded once but produce one token for every request in the batch simultaneously.

### 2. KV Cache

KV cache is one of the most significant VRAM consumers during LLM inference.

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

### 3. GQA (Grouped Query Attention)

In standard Multi-Head Attention (MHA), each Query head has its own independent K and V heads. With 24 attention heads, you need to store 24 sets of KV pairs.

GQA lets multiple Query heads share a single set of KV heads. For example, 24 Query heads sharing 4 KV heads (6:1 compression ratio) reduces the KV cache to 1/6 of the original size.

GQA benefits inference in two ways:
- **Saves VRAM**: Smaller KV cache means more tokens can be cached in the same memory, enabling longer contexts or higher concurrency
- **Saves bandwidth**: Less KV cache to read during decode means faster per-token generation

This is why `num_kv_heads` is one of the most critical architecture parameters for concurrency estimation.

### 4. MLA (Multi-head Latent Attention)

MLA is the attention mechanism used in DeepSeek-V2/V3 and Kimi K2. It goes further than GQA by projecting the entire KV into a low-dimensional latent vector for storage, then decompressing during inference. KV cache compression ratios can exceed 10x.

The KV cache formula for MLA models is different:

```
KV cache per token = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

The worked example later in this guide uses a GQA model (Qwen3.6-27B), so we use the GQA formula.

### 5. Memory Bandwidth vs Compute

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

### 6. Tensor Parallelism

When a model is too large to fit on a single GPU, it can be split across multiple GPUs. Each GPU handles a portion of the computation, with all-reduce communication for synchronization between layers.

TP benefits:
- Double the VRAM: 2 GPUs = 2x total VRAM
- Double the bandwidth: 2 GPUs = 2x total bandwidth, halving single-token latency

TP costs:
- Inter-GPU communication (all-reduce) is needed at every layer
- NVLink (900 GB/s) has minimal communication overhead; PCIe Gen4 (~32 GB/s) has significant overhead
- GPUs without NVLink (e.g., L20) are limited to PCIe, so TP communication adds noticeable latency

---

## Estimation Methodology

### Step 1: Calculate Model Weight Memory

```
Weight VRAM = total_parameters × bytes_per_param
```

Common precisions:
| Precision | bytes_per_param |
|---|---|
| BF16 / FP16 | 2 |
| FP8 | 1 |
| INT4 | 0.5 |

Note: For MoE models, total parameter count is much larger than the active parameter count. Weight memory is calculated using **total parameters**.

### Step 2: Calculate Per-Token KV Cache Size

```
kv_per_token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
```

Where `bytes_per_element` depends on KV cache storage precision:
- Defaults to the same as model precision (BF16 = 2 bytes)
- vLLM supports `--kv-cache-dtype fp8` to quantize the KV cache to FP8 (1 byte), halving VRAM usage with negligible quality loss

### Step 3: Calculate Available KV Cache VRAM

```
Available KV VRAM = total_VRAM × gpu_memory_utilization - weight_VRAM - overhead
```

- `gpu_memory_utilization`: vLLM defaults to 0.9, using 90% of VRAM and reserving 10% for CUDA context and fragmentation
- `overhead`: Activations, temporary buffers, etc. — typically 1-3 GB

### Step 4: Calculate Maximum Concurrency

```
KV token budget = available_KV_VRAM / kv_per_token
Max concurrent requests = KV_token_budget / average_tokens_per_request
```

**Tokens per request = input tokens + output tokens** — both consume KV cache.

Note: This is the **theoretical upper bound**. In practice, vLLM's PagedAttention has some memory fragmentation, so actual capacity is typically 85-95% of the theoretical value.

### Step 5: Estimate Throughput

**Decode throughput (bandwidth-bound region):**

```
Single token latency = weight_size(bytes) / total_bandwidth(bytes/s) + TP_communication_latency
Decode throughput = batch_size / single_token_latency
```

**Prefill throughput (compute-bound region):**

```
Prefill throughput ≈ total_compute(FLOPS) / (2 × model_parameters)   (tokens/s)
```

The factor of `2` comes from each parameter requiring approximately 2 floating-point operations during forward pass (one multiply, one add).

**Actual throughput** is a mix of prefill and decode, depending on the input/output ratio of requests. Batch inference (long input, short output) is prefill-dominated; conversational scenarios (short input, long output) are decode-dominated.

---

## vLLM's Automatic Concurrency Management

### Concurrency Does Not Need Manual Configuration

vLLM uses **continuous batching** and **PagedAttention**, making concurrency dynamically adaptive.

How it works:

1. At startup, vLLM calculates the total KV cache budget based on configuration parameters (memory utilization, KV cache precision, etc.)
2. When requests arrive, the scheduler checks "is there KV cache space available?":
   - Space available: immediately admitted, batched with existing requests
   - No space: queued until a running request completes and frees its KV cache
3. With many short requests, concurrency is automatically high; with many long requests, concurrency is automatically low

There is no need to calculate "should I set concurrency to 115 or 57" and put it in a config file. vLLM handles this dynamic scheduling at runtime.

### Concurrency Is Fundamentally an Inverse Function

```
Max concurrency = available_KV_VRAM / (KV_size_per_token × tokens_per_request)
                = constant K / X
```

- X-axis: context token length per request (input + output)
- Y-axis: maximum supported concurrency
- Relationship: pure Y = K/X

All the concepts and calculation steps covered earlier are about determining that constant K. K is jointly determined by hardware (VRAM size, memory utilization) and model architecture (layer count, KV head count, head dimension, KV cache precision).

### max-model-len Is a "Gate", Not a "Reservation"

`max-model-len` does not pre-allocate that much VRAM per request. PagedAttention allocates **on demand** — a request that actually uses 2K tokens occupies 2K x 128KB = 256 MB of KV cache regardless of whether `max-model-len` is set to 4096 or 262144.

```
max-model-len = 262144, actual request 2K tokens → KV usage 256 MB
max-model-len = 4096,   actual request 2K tokens → KV usage 256 MB   ← identical
```

The only purpose of `max-model-len` is to set the maximum allowed request length. Requests exceeding this length are rejected.

At startup, vLLM validates that the available KV VRAM can accommodate at least one request of max-model-len length. As long as this check passes, the setting has no impact on short request concurrency.

### Mixed Workload Scenarios

A single vLLM instance can handle both long and short requests simultaneously:

**All short requests:**
```
KV total budget ≈ 470K tokens
2K tokens per request → ~230 concurrent requests
```

**One 64K long request + short requests:**
```
Long request:      64K × 128KB = 8.2 GB
Remaining KV:      58 - 8.2 = ~50 GB
Short concurrency: 50 GB / (2K × 128KB) ≈ 200 requests
```

**Three 64K long requests + short requests:**
```
3 long requests:   3 × 8.2 GB = 24.6 GB
Remaining KV:      58 - 24.6 = ~33 GB
Short concurrency: 33 GB / (2K × 128KB) ≈ 134 requests
```

vLLM's scheduler performs this dynamic calculation at every step. While long requests are running, short request concurrency automatically decreases; when long requests finish and release their KV cache, short request concurrency automatically recovers.

---

## Worked Example: Qwen3.6-27B FP8 on 2x L20

### Hardware Specifications

| Parameter | Value |
|---|---|
| GPU | 2x NVIDIA L20 |
| VRAM per GPU | 48 GB GDDR6 |
| Total VRAM | 96 GB |
| Bandwidth per GPU | 864 GB/s |
| Total bandwidth (TP=2) | 1,728 GB/s |
| FP16 compute per GPU | ~120 TFLOPS |
| Inter-GPU link | PCIe Gen4 x16 (~32 GB/s) |

### Model Architecture Parameters

| Parameter | Value |
|---|---|
| Model | Qwen3.6-27B |
| Architecture | Dense (not MoE) |
| Precision | FP8 |
| Total parameters | ~27B |
| num_hidden_layers | 64 |
| num_attention_heads | 24 |
| num_key_value_heads | 4 |
| head_dim | 256 |
| hidden_size | 5120 |
| max_position_embeddings | 262,144 |
| Weight size (FP8) | ~28 GB |

### Calculation Walkthrough

#### 1) Per-Token KV Cache Size

```
BF16 KV cache:
  = 2 × 4 × 256 × 2 bytes × 64 layers
  = 2 × 4 × 256 × 2 × 64
  = 262,144 bytes
  = 256 KB / token

FP8 KV cache:
  = 2 × 4 × 256 × 1 byte × 64 layers
  = 131,072 bytes
  = 128 KB / token
```

#### 2) Available KV Cache VRAM

```
Total VRAM:       96 GB
Weights (FP8):   -28 GB
vLLM reserved:   -96 × 0.08 ≈ -7.7 GB    (gpu_memory_utilization=0.92)
Activation overhead: -2 GB
─────────────────────
Available KV:    ≈ 58 GB
```

#### 3) KV Token Budget and Maximum Concurrency

**With FP8 KV cache (128 KB/token):**

```
KV token budget = 58 GB / 128 KB = 474,317 tokens ≈ 470K tokens
```

| Scenario | Tokens per request (input+output) | Max concurrency | Use case |
|---|---|---|---|
| Short text classification | 512 | **925** | Sentiment analysis, labeling |
| General Q&A | 2,048 | **231** | Knowledge Q&A, short generation |
| Medium conversation | 4,096 | **115** | Multi-turn dialog, text rewriting |
| Long document processing | 8,192 | **57** | Summarization, translation |
| Code generation | 16,384 | **28** | Complex code generation (with thinking) |
| Long context | 32,768 | **14** | Long document analysis |

**With BF16 KV cache (256 KB/token, default precision):**

```
KV token budget = 58 GB / 256 KB = 237,158 tokens ≈ 240K tokens
```

| Scenario | Tokens per request | Max concurrency |
|---|---|---|
| Short text classification | 512 | **462** |
| General Q&A | 2,048 | **115** |
| Medium conversation | 4,096 | **57** |
| Long document processing | 8,192 | **28** |
| Code generation | 16,384 | **14** |
| Long context | 32,768 | **7** |

#### 4) Throughput Estimation

**Single token decode latency (TP=2):**

```
Weight loading:  28 GB / 1,728 GB/s = 16.2 ms
TP communication: 2 all-reduce ops per layer, 64 layers
                  Estimated ~5-8 ms total communication overhead (PCIe bottleneck)
─────────────────────────
Single token ≈  22-24 ms
Single request generation speed ≈ 42-45 tokens/s
```

**Batch throughput (decode phase):**

| Batch size | Total throughput (tokens/s) | Notes |
|---|---|---|
| 1 | ~43 | Single request, bandwidth-bound |
| 8 | ~340 | Near-linear scaling |
| 32 | ~1,200 | Approaching compute-bound |
| 64 | ~1,800 | Near saturation |
| 128 | ~2,200 | Approaching L20 compute ceiling |

These are rough estimates for the decode phase. Actual throughput also depends on the prefill ratio — if batch tasks have long inputs (e.g., thousands of input tokens + hundreds of output tokens), the prefill phase may dominate, and prefill has higher parallelism efficiency.

---

## Key vLLM Parameters for Optimization

### Core Optimization Parameters

These three vLLM parameters have the greatest impact on inference concurrency and latency:

```bash
vllm serve <model_path> \
  --kv-cache-dtype fp8 \
  --max-model-len 65536 \
  --enable-chunked-prefill
```

### Parameter Details

**Parameter 1: `--kv-cache-dtype fp8` — Doubles concurrency**

This is the highest-impact parameter.

A key default behavior: even when model weights are FP8, vLLM's KV cache defaults to BF16 storage. Adding `--kv-cache-dtype fp8` changes the KV cache from BF16 (256 KB/token) to FP8 (128 KB/token). The same VRAM can store twice the tokens, directly doubling concurrency.

| Tokens per request | Original (BF16 KV) | With FP8 KV | Change |
|---|---|---|---|
| 2K | ~115 | **~230** | **x2** |
| 4K | ~57 | **~115** | **x2** |
| 8K | ~28 | **~57** | **x2** |
| 16K | ~14 | **~28** | **x2** |

FP8 KV cache quality loss is negligible for the vast majority of tasks.

**Parameter 2: `--max-model-len 65536` — Request length protection**

Does not change concurrency (as explained earlier, this is a gate, not a reservation). Its purpose:
- Allow long-context tasks up to 64K tokens
- Reject unexpectedly long requests that would consume excessive KV cache
- Set according to actual needs — can be 32768, 65536, 131072, or 262144

**Parameter 3: `--enable-chunked-prefill` — Latency improvement for mixed workloads**

Does not change concurrency; improves response latency.

```
Off:  A 32K-token long input arrives → monopolizes GPU for prefill → all other requests wait
On:   Long input is split into chunks → decode for other requests is interleaved between chunks → short requests are not starved
```

Especially useful for mixed scenarios with both long and short requests being processed simultaneously.

### Before vs After Comparison

| Metric | Default config | With three parameters | Improvement |
|---|---|---|---|
| Max concurrency (4K requests) | ~57 | **~115** | **x2** |
| Max concurrency (2K requests) | ~115 | **~230** | **x2** |
| Short request latency during long prefill | High (blocked) | Low (interleaved) | Significant |
| Overlong request protection | None (accepts 262K) | Yes (rejects >64K) | Prevents accidents |

The core benefit comes from `--kv-cache-dtype fp8`, which directly doubles concurrency. The other two parameters are complementary improvements.

### Other Common Parameters

| Parameter | Value | Description |
|---|---|---|
| `--tensor-parallel-size` | GPU count | Tensor parallelism across multiple GPUs |
| `--gpu-memory-utilization` | 0.9 | Use 90% of VRAM. For more aggressive usage, set to 0.92-0.95 |
| `--max-num-seqs` | Default 256 | Upper limit on concurrent sequences. Default is large enough for most cases |
| `--max-num-batched-tokens` | Default auto | Max tokens processed per scheduling step. Default works for most scenarios |

### Disabling Thinking Mode

Some models with thinking capability (e.g., Qwen3.6) have deep thinking enabled by default, producing very long outputs (32K-81K tokens). For tasks that don't require deep reasoning chains, add this to the system prompt in your request:

```
/no_think
```

Or configure `enable_thinking=False` in the chat template. This dramatically reduces output token count, which in turn reduces KV cache usage per request and significantly improves concurrency.

### max-model-len Selection Guide

Set max-model-len based on the longest requests you actually need to handle:

| Longest task context length | Recommended max-model-len | Validation (x128KB < 58GB?) |
|---|---|---|
| ~8K | 8192 | 1 GB |
| ~32K | 32768 | 4.2 GB |
| ~64K | 65536 | 8.4 GB |
| ~128K | 131072 | 16.8 GB |
| ~262K (model maximum) | 262144 | 33.6 GB |

All values pass validation (less than the 58 GB available KV VRAM), so any can be used. Set it to the longest length you actually need. Short requests are unaffected.

---

## Appendix: Quick Estimation Checklist

Given any model and hardware, estimate concurrency with these steps:

```
1. Check the model's config.json and note:
   - num_hidden_layers (L)
   - num_key_value_heads (H_kv)
   - head_dim (D)
   - Total parameters (P)

2. Calculate weight VRAM:
   W = P × bytes_per_param
   (FP8: ×1, BF16: ×2, INT4: ×0.5)

3. Calculate per-token KV cache:
   KV_token = 2 × H_kv × D × bytes_per_element × L
   (FP8 KV: bytes=1, BF16 KV: bytes=2)

4. Calculate available KV VRAM:
   KV_mem = total_GPU_VRAM × utilization - W - overhead(≈2GB)

5. Calculate max concurrency:
   max_concurrent = KV_mem / (KV_token × tokens_per_request)

6. Calculate decode throughput:
   latency_per_token = W / bandwidth
   throughput = batch_size / latency_per_token
```
