# 8. Closing

This is the end of the book.

Twelve chapters ago, the premise was: a frontend developer wants to become an AI engineer, and the standard advice ("read these papers, take this course") is the wrong shape for someone who already knows how to ship software. The book took a different path. Start at the bottom — what an LLM actually does, mechanically — and work upward through the practical layers until you can build, serve, change, and validate AI-powered systems in production.

## What the book covered

- **Chapter 0** — How LLMs actually work. Tokens, next-token prediction, the chat-template trick, statelessness, context windows, sampling, non-determinism. The mechanical foundation for everything that came after.
- **Chapter 1** — Python for TS developers. The language of the AI ecosystem, sized for someone who already programs.
- **Chapter 2** — How to call models in code. APIs, prompts, structured output, tool use, streaming, cost, the three failure modes you'll see in production.
- **Chapter 3** — How to give the model knowledge it doesn't have. Embeddings, vector search, RAG end to end, retrieval failures and how to measure them.
- **Chapter 4** — How to give the model the ability to act. Tool design, the agent loop, planning and control, parallelism, safety budgets, the trajectory-based way to evaluate any of it.
- **Chapters 5–8** — The hardware and serving reality. GPU sizing, the open-source infra stack, KV cache and prefix caching, inference concurrency.
- **Chapters 9–10** — Changing the model itself. When to fine-tune, what post-training is, how the LoRA / SFT / RLHF stack fits together.
- **Chapter 11** — How to know whether any of it works. The discipline that lets you change anything safely.

That's the whole map: what the model does, how to call it, how to extend it with knowledge and tools, how to run it on real hardware, how to alter it, and how to measure it. That arc is enough to get from "I've used ChatGPT" to "I can ship AI features in production." The rest is depth on the parts you end up needing.

## What's not in the book — directions to go from here

Real fields are bigger than any one book. Some directions deliberately not covered:

- **Multimodal.** Images, video, and audio in and out. Vision-language models, voice models, generative image and video. The mechanics layer onto Chapter 0's foundations but the practical playbooks are different — image-grounded RAG, audio streaming UX, latency budgets for voice.
- **On-device and edge inference.** Running quantized models on phones, laptops, browsers (WebGPU, MLX, llama.cpp). Different cost structure, different deployment story, the same fundamentals.
- **Training from scratch / pretraining.** This book stayed on the application and post-training side. The full pretraining stack — distributed training, data pipelines, infrastructure for thousand-GPU runs — is a separate discipline.
- **Specific verticals.** Code agents, voice agents, legal-document AI, medical AI, scientific discovery. Each has its own deep playbook that builds on the basics here.
- **Reinforcement learning from interaction.** Beyond the post-training-style RLHF in Chapter 10 — the full RL loop with environments, rewards, and self-improvement. This is where a lot of the frontier-model work is, but it lives one layer below the application engineering this book teaches.
- **Safety, alignment, interpretability.** A real research area in its own right. The eval discipline in Chapter 11 is the practitioner-side overlap.

You can pick any of these as a next learning project once the foundation here is solid.

## The one piece of advice

If there's a single thing to take away from this book — across all twelve chapters — it's this:

> **Build the eval set on day three. Not week three, not month three.**

Not week three because by week three you have users and a stake in not measuring things that might be bad. Not month three because by month three you're attached to your prompts and your model picks and you'll find reasons not to test them.

Day three. While the system is still small, while changes are still cheap, while you can still afford to learn what "good" looks like before the pressure to ship sets the answer. The team that has 30 labeled cases on day three ships better products than the team that has 0 on day ninety.

Everything else — the model picks, the framework picks, the infra picks — has good defaults. The eval discipline does not have a default. You have to build it deliberately, and the right time to start is before you have anything to evaluate.

## Two practical next steps

Pick a small project. Not a startup, not a company, not a Big Idea. Pick **one useful thing** that an LLM can help with and ship it to ten people. Maybe it's a personal RAG over your own notes. Maybe it's a small agent that automates a chore at your day job. Maybe it's a code reviewer for your team's repo. The point is the loop: pick a thing, build it, ship it, measure it, learn from real users, iterate. One end-to-end loop teaches more than ten more chapters.

Read the source of `vllm` or one of the eval tools mentioned in [§7](./tools). The code is more approachable than you'd expect — it's not magic, it's careful systems engineering by people who write Python and CUDA. Reading the paged-attention implementation in vllm, or the trace-collection code in Langfuse, will teach you more about how this stuff actually works than another tutorial. The same advice that applies to every other engineering discipline applies here: read good code in your domain, regularly.

## A last reflection

This is a moving field. The libraries you'll use in 2027 may not be the libraries this book named in 2026. Models will get bigger, smaller, faster, cheaper, better at some tasks and worse at others in ways nobody currently predicts. Whole categories of tooling that don't exist yet will exist. Categories that exist today will be obsolete.

The fundamentals from Chapter 0 — what the model does mechanically — won't change. The discipline from Chapter 11 — measuring distributions, not values; rates, not booleans — won't change. The arc in between has to be re-learned periodically as the libraries and providers move.

That's actually the good news. If you've internalized the foundations and the eval discipline, the rest is rotating surface area you can keep up with. New model? Run the golden set. New framework? Trace it. New deployment target? Cost it out. The skills compound.

Welcome to the field.
