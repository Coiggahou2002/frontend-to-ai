# 4. Worked Example: Qwen3.6-27B FP8 on 2x L20

Time to ground all of the formulas in concrete numbers. This is the deployment we keep referencing — Qwen3.6-27B in FP8 on a 2x L20 box — walked through end to end. Plug your own model and your own GPUs into the same template and you'll get the corresponding answer.

## Hardware Specifications

| Parameter | Value |
|---|---|
| GPU | 2x NVIDIA L20 |
| VRAM per GPU | 48 GB GDDR6 |
| Total VRAM | 96 GB |
| Bandwidth per GPU | 864 GB/s |
| Total bandwidth (TP=2) | 1,728 GB/s |
| FP16 compute per GPU | ~120 TFLOPS |
| Inter-GPU link | PCIe Gen4 x16 (~32 GB/s) |

## Model Architecture Parameters

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

## Calculation Walkthrough

### 1) Per-Token KV Cache Size

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

### 2) Available KV Cache VRAM

```
Total VRAM:       96 GB
Weights (FP8):   -28 GB
vLLM reserved:   -96 × 0.08 ≈ -7.7 GB    (gpu_memory_utilization=0.92)
Activation overhead: -2 GB
─────────────────────
Available KV:    ≈ 58 GB
```

### 3) KV Token Budget and Maximum Concurrency

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

### 4) Throughput Estimation

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

Notice that the FP8-vs-BF16 KV cache row in the table above is a clean 2x. That's not coincidence — it's the single biggest lever you have in the vLLM CLI, and the next page is about which flags to actually set.

Next: [vLLM Tuning Parameters](./vllm-tuning-parameters)
