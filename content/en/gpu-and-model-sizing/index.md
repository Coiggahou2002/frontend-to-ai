# GPU and Model Sizing

By the end of [Chapter 4 (Agents)](../agents-and-orchestration), you've built systems that talk to a model over an API. From here on, the book moves under the API line — to the hardware and serving layer. This chapter is the first step: **what does it actually take, in GPUs and dollars, to run a given model?**

The framing is deliberately backwards from how vendor docs present it. We don't start with GPU SKUs. We start with the model you want to run, work out how much memory it needs, then pick the cheapest card that fits. Once that's a habit, the rest of the deployment story (infra stack, KV cache, concurrency in the next three chapters) is just optimizations on top of "the model fits in VRAM."

Five sections:

1. [GPU mental model](./gpu-mental-model) — why LLMs need GPUs at all, and why VRAM is the only spec that matters at first
2. [VRAM and precision](./vram-and-precision) — the parameter-count-to-VRAM formula, what FP16/FP8/INT4 actually trade off, and the GPU lineup you'll see on cloud platforms
3. [Multi-GPU, MoE, and the rest](./multi-gpu-and-moe) — when one card isn't enough, the trap MoE models hide, and the non-VRAM specs (system RAM, vCPU, disk) you still need to size
4. [Choosing model size](./choosing-model-size) — the open-source model landscape as of 2026, capability tiers, the cost-cliff between A10 and A100, and how to actually decide
5. [Decision tree](./decision-tree) — a flowchart from "what model are you deploying" to "buy this GPU," plus the two-step sizing method as a closing recap

The goal isn't to memorize numbers — it's to build the reflex of "model size x precision x 1.2 = VRAM, then pick the card." Once that reflex is there, the rest of the infra chapters will make sense.

Next: [GPU mental model →](./gpu-mental-model)
