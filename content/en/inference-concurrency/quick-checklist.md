# 6. Quick Estimation Checklist

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

That's the entire mental model. Six steps, one inverse function (`max_concurrent = K / X`), one constant (`K`) determined by hardware and architecture, and three vLLM flags worth knowing.

---

You now have a serving-side picture: how many requests a single deployment can take, where the bandwidth wall is, and which knobs move the needle. The next chapter, [Fine-Tuning in Practice](../fine-tuning), goes back to the *training* side — how to actually customize a model. The concurrency math from this chapter is what tells you whether the fine-tuned model you produce can serve traffic on the hardware you have, or whether you need to revisit `--kv-cache-dtype`, `tensor_parallel_size`, or just a bigger box.

Next: [Fine-Tuning in Practice](../fine-tuning)
