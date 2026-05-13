# 2. Choosing a Provider

A frontend developer building their first AI feature has, in 2026, two real categories of choice:

- **Closed model APIs** — Anthropic (Claude), OpenAI (GPT), Google (Gemini), and a handful of others. You send a request, you get a response, you pay per million tokens. Everything is run for you.
- **Open weights, self-hosted** — Llama, Qwen, DeepSeek, Mistral. You download the weights, run them on your own GPUs (or rented ones), often via vLLM or SGLang. You handle scaling, batching, KV cache, the works. We cover this stack in Chapters 5–8.

There's a third category — open weights served by a hosted inference provider (Together, Fireworks, Groq, AWS Bedrock, Cerebras). Mechanically it looks like a closed API, but underneath it's an open model. Pricing is usually cheaper than frontier closed models for comparable quality.

## The Decision Table

Approximate, current as of 2026. Cost figures are USD per million tokens, mid-tier model from each provider.

| Dimension | Anthropic (Claude) | OpenAI (GPT) | Google (Gemini) | Self-hosted (Llama/Qwen on vLLM) |
|---|---|---|---|---|
| Input cost | ~$3 / Mtok | ~$2.5 / Mtok | ~$1.25 / Mtok | $0 marginal — you pay for the GPU |
| Output cost | ~$15 / Mtok | ~$10 / Mtok | ~$5 / Mtok | $0 marginal — same |
| Typical TTFT | 200–600 ms | 200–500 ms | 200–500 ms | 50–300 ms (depends on you) |
| Quality (frontier tier) | Top tier | Top tier | Top tier | Strong but lags frontier closed by 6–12 months |
| Privacy posture | Data not used for training by default; enterprise data residency available | Same | Same | Total — never leaves your VPC |
| Customizability | Limited fine-tuning, system prompts only on most tiers | Fine-tuning available; structured outputs strong | Fine-tuning, prompt caching, grounding | Total — full fine-tuning, LoRA, custom decoding, anything |
| Ops overhead | None | None | None | High — GPUs, autoscaling, batching, KV cache mgmt (Ch. 5–8) |
| Rate-limit ceiling | Tiered, scales with spend | Tiered, scales with spend | Tiered, scales with spend | Whatever your hardware supports |
| Time to first prototype | 5 minutes | 5 minutes | 5 minutes | Days to weeks |

## When Each Makes Sense

For a frontend developer's first AI feature: **use a closed API, almost always**. The marginal cost of a closed-API call ($0.001–$0.05 per turn) is negligible compared to the engineering cost of standing up your own inference. You also get the best models, instantly, with strong default safety alignment.

Reach for self-hosting only when one of these is true:

- **Privacy / regulation** — your data physically cannot leave your environment.
- **Scale** — you serve millions of requests per day and the API bill is large enough that GPU CapEx + OpEx wins.
- **Customization** — you need to fine-tune (Ch. 9) for a domain where closed models are weak, or use a feature only open models support (custom decoding, structured generation backends, very long context with quantized KV cache).
- **Latency** — closed APIs have a hard floor on TTFT due to geographic distance and queueing; self-hosted on local GPUs can hit single-digit-ms TTFT.

We will mostly assume closed-API code in this chapter. Self-hosted equivalents look the same — vLLM and SGLang both expose an OpenAI-compatible HTTP endpoint.

Next: [Prompt Engineering as Software Engineering →](./prompt-as-code)
