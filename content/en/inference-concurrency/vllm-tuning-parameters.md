# 5. vLLM Tuning Parameters

The previous page showed *what's possible* on this hardware. This page is *how to actually get there* with vLLM CLI flags. Three parameters do almost all the work; the rest are minor adjustments.

## Core Optimization Parameters

These three vLLM parameters have the greatest impact on inference concurrency and latency:

```bash
vllm serve <model_path> \
  --kv-cache-dtype fp8 \
  --max-model-len 65536 \
  --enable-chunked-prefill
```

## Parameter Details

### Parameter 1: `--kv-cache-dtype fp8` — Doubles concurrency

This is the highest-impact parameter.

A key default behavior: even when model weights are FP8, vLLM's KV cache defaults to BF16 storage. Adding `--kv-cache-dtype fp8` changes the KV cache from BF16 (256 KB/token) to FP8 (128 KB/token). The same VRAM can store twice the tokens, directly doubling concurrency.

| Tokens per request | Original (BF16 KV) | With FP8 KV | Change |
|---|---|---|---|
| 2K | ~115 | **~230** | **x2** |
| 4K | ~57 | **~115** | **x2** |
| 8K | ~28 | **~57** | **x2** |
| 16K | ~14 | **~28** | **x2** |

FP8 KV cache quality loss is negligible for the vast majority of tasks.

### Parameter 2: `--max-model-len 65536` — Request length protection

Does not change concurrency (as explained earlier, this is a gate, not a reservation). Its purpose:
- Allow long-context tasks up to 64K tokens
- Reject unexpectedly long requests that would consume excessive KV cache
- Set according to actual needs — can be 32768, 65536, 131072, or 262144

### Parameter 3: `--enable-chunked-prefill` — Latency improvement for mixed workloads

Does not change concurrency; improves response latency.

```
Off:  A 32K-token long input arrives → monopolizes GPU for prefill → all other requests wait
On:   Long input is split into chunks → decode for other requests is interleaved between chunks → short requests are not starved
```

Especially useful for mixed scenarios with both long and short requests being processed simultaneously.

## Before vs After Comparison

| Metric | Default config | With three parameters | Improvement |
|---|---|---|---|
| Max concurrency (4K requests) | ~57 | **~115** | **x2** |
| Max concurrency (2K requests) | ~115 | **~230** | **x2** |
| Short request latency during long prefill | High (blocked) | Low (interleaved) | Significant |
| Overlong request protection | None (accepts 262K) | Yes (rejects >64K) | Prevents accidents |

The core benefit comes from `--kv-cache-dtype fp8`, which directly doubles concurrency. The other two parameters are complementary improvements.

## Other Common Parameters

| Parameter | Value | Description |
|---|---|---|
| `--tensor-parallel-size` | GPU count | Tensor parallelism across multiple GPUs |
| `--gpu-memory-utilization` | 0.9 | Use 90% of VRAM. For more aggressive usage, set to 0.92-0.95 |
| `--max-num-seqs` | Default 256 | Upper limit on concurrent sequences. Default is large enough for most cases |
| `--max-num-batched-tokens` | Default auto | Max tokens processed per scheduling step. Default works for most scenarios |

## Disabling Thinking Mode

Some models with thinking capability (e.g., Qwen3.6) have deep thinking enabled by default, producing very long outputs (32K-81K tokens). For tasks that don't require deep reasoning chains, add this to the system prompt in your request:

```
/no_think
```

Or configure `enable_thinking=False` in the chat template. This dramatically reduces output token count, which in turn reduces KV cache usage per request and significantly improves concurrency.

## max-model-len Selection Guide

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

You now have the formulas, the scheduler model, the worked example, and the flags. The last page is a one-page checklist you can pin next to your terminal.

Next: [Quick Estimation Checklist](./quick-checklist)
