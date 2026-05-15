# Inference Concurrency: Theory, Methods, and Practice

[Chapter 9](../kv-cache) was about *one* request — where the KV cache lives, how it grows, and why decode is bandwidth-bound. This chapter answers the obvious next question: **how many requests can a single GPU box handle at once, and how do you predict that number before you provision?**

The short version: concurrency is an inverse function. Given fixed hardware and a fixed model, the maximum number of simultaneous requests scales as `K / X`, where `X` is the average tokens per request and `K` is a constant determined by VRAM and architecture. Everything in this chapter is about computing `K` precisely enough to size a deployment.

## What you'll be able to do by the end

- Look at any model's `config.json` and any GPU's spec sheet and produce a defensible concurrency number for a target request length.
- Explain why `--kv-cache-dtype fp8` doubles concurrency and `--max-model-len` does not reduce it.
- Read a vLLM dashboard and tell whether you are bandwidth-bound, compute-bound, or KV-bound.
- Decide between BF16 and FP8 KV cache, between TP=1 and TP=2, and between aggressive and conservative `gpu_memory_utilization`.
- Walk through a worked example end-to-end: Qwen3.6-27B FP8 on 2x L20, from architecture parameters to concurrency table to throughput estimate.

## What's in this chapter

1. [Prefill and Decode](./prefill-and-decode) — the two phases, KV cache mechanics, GQA, MLA, bandwidth vs compute, tensor parallelism. The mental model.
2. [Estimation Methodology](./estimation-method) — five steps from `config.json` and GPU specs to a concurrency number.
3. [vLLM Automatic Concurrency](./vllm-auto-concurrency) — why you don't set concurrency manually, why max-model-len is a gate not a reservation, and how mixed long/short workloads schedule.
4. [Worked Example: Qwen3.6-27B on 2x L20](./worked-example) — the full numerical walkthrough, including a concurrency-by-context-length table.
5. [vLLM Tuning Parameters](./vllm-tuning-parameters) — the three flags that matter, before/after numbers, and the rest of the knobs.
6. [Quick Estimation Checklist](./quick-checklist) — the six-step recipe to keep next to your terminal.

This chapter assumes you've internalized the per-token KV cache formula from [Chapter 9](../kv-cache); we'll build on it directly. The next chapter, [Fine-Tuning in Practice](../fine-tuning), uses these same numbers — concurrency math is what tells you whether your fine-tuned model can actually serve traffic on the hardware you have.

Next: [Prefill and Decode](./prefill-and-decode)
