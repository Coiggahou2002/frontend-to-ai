# 3. vLLM Automatic Concurrency Management

If you came from a synchronous-API mindset, the natural instinct is "set max_concurrent_requests = N somewhere." vLLM doesn't work like that, and trying to force it to is how people end up with worse throughput than the defaults. This page is the model of how vLLM actually schedules.

## Concurrency does not need manual configuration

vLLM uses **continuous batching** and **PagedAttention**, making concurrency dynamically adaptive.

How it works:

1. At startup, vLLM calculates the total KV cache budget based on configuration parameters (memory utilization, KV cache precision, etc.)
2. When requests arrive, the scheduler checks "is there KV cache space available?":
   - Space available: immediately admitted, batched with existing requests
   - No space: queued until a running request completes and frees its KV cache
3. With many short requests, concurrency is automatically high; with many long requests, concurrency is automatically low

There is no need to calculate "should I set concurrency to 115 or 57" and put it in a config file. vLLM handles this dynamic scheduling at runtime.

## Concurrency is fundamentally an inverse function

```
Max concurrency = available_KV_VRAM / (KV_size_per_token × tokens_per_request)
                = constant K / X
```

- X-axis: context token length per request (input + output)
- Y-axis: maximum supported concurrency
- Relationship: pure Y = K/X

All the concepts and calculation steps covered earlier are about determining that constant K. K is jointly determined by hardware (VRAM size, memory utilization) and model architecture (layer count, KV head count, head dimension, KV cache precision).

## max-model-len is a "gate", not a "reservation"

`max-model-len` does not pre-allocate that much VRAM per request. PagedAttention allocates **on demand** — a request that actually uses 2K tokens occupies 2K x 128KB = 256 MB of KV cache regardless of whether `max-model-len` is set to 4096 or 262144.

```
max-model-len = 262144, actual request 2K tokens → KV usage 256 MB
max-model-len = 4096,   actual request 2K tokens → KV usage 256 MB   ← identical
```

The only purpose of `max-model-len` is to set the maximum allowed request length. Requests exceeding this length are rejected.

At startup, vLLM validates that the available KV VRAM can accommodate at least one request of max-model-len length. As long as this check passes, the setting has no impact on short request concurrency.

## Mixed workload scenarios

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

The numbers above used `58 GB` and `128 KB/token` without justification. Those came from a specific real-world setup — Qwen3.6-27B FP8 on 2x L20 — which is exactly what we'll work through next, end to end.

Next: [Worked Example: Qwen3.6-27B on 2x L20](./worked-example)
