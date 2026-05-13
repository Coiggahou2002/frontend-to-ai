# 8. Cost & Latency Basics

Every line of LLM code you ship has a per-call dollar cost. Build the habit of estimating it from day one.

## Input vs. Output: Why Output Is More Expensive

Most providers charge ~3–5x more per output token than per input token. The reason is mechanical, not commercial:

- **Input tokens go through the prefill phase.** All N input tokens are processed in one parallel forward pass. The GPU is fed a long matrix and chews through it efficiently.
- **Output tokens come from the decode phase.** Each output token requires its own full forward pass through the model. Generate 500 tokens, that's 500 sequential forward passes. You can't parallelize them across the same request because each token depends on the previous one (autoregressive — Chapter 0 §2).

So output is not just "the same work, charged more." It's actually more compute per token. The KV cache (Chapter 7) is what keeps decode tractable — without it, each new token would also have to recompute attention against all prior tokens. With it, decode becomes a steady drumbeat: one matmul per token, KV cache grows by one entry, repeat. **Chapters 7 and 8** explain the mechanics in depth.

## Approximate 2026 Pricing

Mid- to top-tier model from each major provider. USD per million tokens. Numbers move; verify the current rates before billing decisions.

| Model | Input / Mtok | Output / Mtok | Cached input / Mtok | Notes |
|---|---:|---:|---:|---|
| Claude Sonnet 4.6 (Anthropic) | $3.00 | $15.00 | $0.30 | 90% off on cache hits with prompt caching |
| Claude Opus 4.7 (Anthropic) | $15.00 | $75.00 | $1.50 | Frontier-tier, expensive |
| GPT-4.1 (OpenAI) | $2.50 | $10.00 | $1.25 | 50% off automatic prefix cache |
| GPT-4.1 mini (OpenAI) | $0.40 | $1.60 | $0.20 | "Fast and cheap" tier |
| Gemini 2.5 Pro (Google) | $1.25 | $5.00 | $0.31 | Cheapest frontier; 1M context |
| Gemini 2.5 Flash (Google) | $0.30 | $1.20 | $0.075 | Very cheap, very fast |
| Llama 3.3 70B on Together | $0.88 | $0.88 | — | Open model, hosted; flat rate |

**Prompt caching** appears across providers in different forms (Anthropic's explicit cache markers, OpenAI's automatic prefix matching, Gemini's context caching). All of them dramatically reduce cost for chat sessions, RAG with stable system prompts, and few-shot pipelines — anywhere a long prefix is reused. The deep mechanics are in **Chapter 7's prefix caching section**. For now, just know it exists and that cache discounts of 50–90% on input tokens are real.

## Quick Math: One RAG Chat Turn

A typical RAG-augmented chat turn looks like:

- ~500 token system prompt
- ~6,000 tokens of retrieved context (3–6 chunks)
- ~1,000 tokens of conversation history (a few prior turns)
- ~500 tokens of user message
- ~500 tokens of model output

Total: ~8,000 input + 500 output. Across the providers above:

| Model | Input cost | Output cost | Total / turn |
|---|---:|---:|---:|
| Claude Sonnet 4.6 (no cache) | $0.024 | $0.0075 | $0.032 |
| Claude Sonnet 4.6 (90% cache) | $0.0024 | $0.0075 | $0.010 |
| GPT-4.1 (no cache) | $0.020 | $0.005 | $0.025 |
| GPT-4.1 (50% cache) | $0.010 | $0.005 | $0.015 |
| Gemini 2.5 Pro | $0.010 | $0.0025 | $0.013 |
| Gemini 2.5 Flash | $0.0024 | $0.0006 | $0.003 |
| Llama 3.3 70B (Together) | $0.0070 | $0.0004 | $0.0074 |

A back-of-envelope: at 1 million chat turns per month, the difference between Claude Sonnet 4.6 (uncached) and Gemini Flash is $32K vs. $3K. The difference between cached and uncached on the same model is 3x. **These numbers compound fast.** Decisions about model selection and prompt caching dominate the LLM bill.

## Latency: TTFT vs. Total Latency

Two latencies to track separately:

- **TTFT (time to first token)** — from request sent to first byte of response received. Dominated by network + server queueing + the prefill phase (processing all input tokens). Long inputs slow TTFT linearly. Closed APIs land around 200–600 ms TTFT for typical workloads.
- **Total latency** — TTFT plus output generation time. Decoding speed is roughly constant per token (a function of the model and the GPU). 50–150 tokens/second is typical for a frontier model on a single request.

For a chat UI, TTFT is the metric users feel. Optimize for it: shorter system prompts, smaller retrieved context, prompt caching, and streaming.

For a batch pipeline (summarize 10K documents overnight), total latency dominates and TTFT is irrelevant.

A useful rule:

```
total_latency  ≈  TTFT  +  (output_tokens / decode_tokens_per_second)
```

For an 8K-input / 500-output Sonnet-class call: TTFT ~500 ms, decode ~80 tok/s → total ~7 seconds. If your chat UI can't render 7 seconds of work without feeling broken, you need streaming, not a faster model.

Next: [Common Failure Modes →](./failure-modes)
