# From Pre-Training to Production: A Complete Guide to LLM Post-Training

May 2, 2026

> Principles and practice of SFT, RLHF, DPO, and GRPO

---

You've probably seen this before: a pre-trained language model with hundreds of billions of parameters, and when you ask it "help me write an out-of-office email," it responds with a Wikipedia-style explainer about what leave policies are. It has astonishing language ability, but it doesn't know you're talking to it.

This is the awkward reality of pre-trained models -- they learn the statistical patterns of language, but they never learn how to "be a good assistant." From GPT-3 to ChatGPT, the model parameters didn't increase, but the user experience changed fundamentally. The key to that transformation is **Post-Training**.

Post-training is not a nice-to-have. It's a systematic engineering process that turns "raw capability" into "usable product," encompassing Supervised Fine-Tuning, Preference Optimization, Capability Enhancement, and Safety Alignment. Once you understand this system, you'll see why the same base model can produce wildly different results depending on who trains it.

This is the theoretical companion to [Chapter 11: Fine-Tuning in Practice](../fine-tuning). That chapter shows you how to run a LoRA / QLoRA fine-tune on a single GPU. This one explains *why* the algorithms exist -- SFT, RLHF, DPO, GRPO -- and how to choose between them.

## What's in this chapter

1. [The Post-Training Landscape](./landscape) -- the four-stage modular stack and why post-training, not scale, decides the final UX.
2. [Supervised Fine-Tuning (SFT)](./sft) -- teaching the model to talk like a human; data quality, training rules of thumb, common pitfalls.
3. [RLHF](./rlhf) -- the InstructGPT three-stage method, PPO mechanics, and the engineering pain that made the field look for alternatives.
4. [DPO and Its Variants](./dpo) -- the "language model is its own reward model" insight; IPO, KTO, SimPO, ORPO.
5. [GRPO and Reasoning Enhancement](./grpo) -- group-relative advantage, RLVR, DAPO, and the boundaries of reasoning training.
6. [Data Engineering](./data) -- quality vs. quantity, preference data collection, synthetic data risks, practical mixing recipes.
7. [Alignment and Safety](./safety) -- the helpful/harmless tension, shallow alignment fragility, multi-objective layered defense.
8. [Evaluation and Method Selection](./evaluation-and-selection) -- three tiers of evaluation and a decision table for picking your post-training stack.
9. [Practice and References](./practice) -- hands-on exercises with TRL, a self-check list, and the papers worth reading.

By the end you'll be able to look at a base model, a target use case, and a budget, and say with conviction: "we need SFT plus DPO" -- or RLHF, or GRPO -- and explain *why*.

Next: [The Post-Training Landscape](./landscape)
