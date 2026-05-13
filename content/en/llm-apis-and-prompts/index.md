# LLM APIs & Prompt Engineering

In Chapter 0 you learned what the model does mechanically. Now you learn how to talk to one in code.

This chapter is a working developer's tour of the API surface and the engineering practices around it. By the end you should be able to:

- Send and parse a chat completion against any major closed-model provider
- Pick a provider for a given workload using cost, latency, and ops criteria
- Treat prompts as code: version-controlled, tested, structured
- Force the model to emit JSON that matches a schema you defined
- Run a tool-use lifecycle and understand why "an agent" is not magic
- Stream responses for low-latency UX
- Estimate cost and latency before you ship
- Recognize the three failure modes you will absolutely encounter in production

We'll lean on the `anthropic` and `openai` Python SDKs throughout. Everything here applies in TypeScript / JS too — the SDKs are nearly identical — but per Chapter 1, the AI ecosystem is Python-first and you will be reading more Python than JS in this domain.

## What's in this chapter

1. [The Shape of an LLM API Call](./api-call-shape) — what goes on the wire, side-by-side OpenAI vs. Anthropic
2. [Choosing a Provider](./choosing-provider) — closed APIs vs. self-hosted, decision table for 2026
3. [Prompt Engineering as Software Engineering](./prompt-as-code) — prompts are files, not f-strings
4. [System Prompts](./system-prompts) — persona, format, guardrail
5. [Structured Output](./structured-output) — three levels, ending at schema-constrained generation
6. [Function Calling / Tool Use](./tool-use) — the protocol that becomes "an agent"
7. [Streaming](./streaming) — TTFT, SSE, and why streaming + tool calls is fiddly
8. [Cost & Latency Basics](./cost-and-latency) — input vs. output pricing, prompt caching, TTFT vs. total latency
9. [Common Failure Modes](./failure-modes) — hallucination, prompt injection, refusals
