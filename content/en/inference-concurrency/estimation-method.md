# 2. Estimation Methodology

The previous page gave you the moving parts. This page is the recipe: five steps, in order, that turn `config.json` and a GPU spec sheet into a concurrency number. Memorize this loop — every concurrency question you'll be asked at work is some variation of it.

## Step 1: Calculate Model Weight Memory

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

## Step 2: Calculate Per-Token KV Cache Size

```
kv_per_token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
```

Where `bytes_per_element` depends on KV cache storage precision:
- Defaults to the same as model precision (BF16 = 2 bytes)
- vLLM supports `--kv-cache-dtype fp8` to quantize the KV cache to FP8 (1 byte), halving VRAM usage with negligible quality loss

## Step 3: Calculate Available KV Cache VRAM

```
Available KV VRAM = total_VRAM × gpu_memory_utilization - weight_VRAM - overhead
```

- `gpu_memory_utilization`: vLLM defaults to 0.9, using 90% of VRAM and reserving 10% for CUDA context and fragmentation
- `overhead`: Activations, temporary buffers, etc. — typically 1-3 GB

## Step 4: Calculate Maximum Concurrency

```
KV token budget = available_KV_VRAM / kv_per_token
Max concurrent requests = KV_token_budget / average_tokens_per_request
```

**Tokens per request = input tokens + output tokens** — both consume KV cache.

Note: This is the **theoretical upper bound**. In practice, vLLM's PagedAttention has some memory fragmentation, so actual capacity is typically 85-95% of the theoretical value.

## Step 5: Estimate Throughput

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

That's the math. Before we apply it to a real example, there's one more piece of context you need: vLLM is doing most of this scheduling for you at runtime, and the next page explains exactly what's automatic and what's manual.

Next: [vLLM Automatic Concurrency](./vllm-auto-concurrency)
