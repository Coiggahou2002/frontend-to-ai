# 7. Alignment and Safety

Making models both useful and safe.

## The tension between safety and usefulness

One of the most difficult problems in post-training is finding the balance between "safe" and "useful."

On one extreme is over-refusal: the model says "I can't answer that" to any sensitive topic, even when the question is a legitimate medical consultation or security research discussion. On the other extreme is over-compliance: the model readily fulfills harmful requests, becoming a tool for generating malicious content.

Good alignment isn't simply teaching the model to refuse -- it's enabling the model to **assess intent, evaluate risk, and choose an appropriate response strategy**.

## Main safety alignment methods

| Method | Principle | Advantage | Limitation |
| --- | --- | --- | --- |
| Safety SFT | Fine-tune with safe conversation examples | Simple and direct | Prone to over-refusal |
| Safety RLHF | Add safety dimension to preferences | Flexible, enables multi-objective optimization | High annotation cost |
| Constitutional AI | Use rules for model self-review and correction | Scalable, reduces human annotation | Rule design is difficult |
| Red-teaming | Proactively find model safety vulnerabilities | Discovers real risks | Can only find known attack patterns |
| MOSAIC framework | "Plan-Check-Act or Refuse" workflow | Structured decisions, suited for agent scenarios | Increases inference overhead |

## The fragility of shallow safety alignment

Recent research has revealed a disturbing fact: many safety alignment techniques only affect the first few tokens of a model's output, while deeper in the generation, the model may still drift toward unsafe directions. This is why "jailbreak" attacks can bypass safety mechanisms -- they essentially trick the model into skipping the initial tokens where it learned to "refuse."

[DPO](./dpo) also has limitations for safety alignment: its loss function is not optimal for the task of "learning to refuse," because it optimizes pairwise comparisons rather than absolute safety standards.

## Multi-objective optimization in practice

Modern safety alignment must simultaneously pursue multiple objectives: helpful, harmless, and honest. In practice, a layered strategy is typically adopted:

1. **Foundation layer**: Establish basic safe behavior patterns through SFT
2. **Optimization layer**: Balance usefulness and safety through multi-objective RLHF/DPO
3. **Defense layer**: Build runtime guardrails through red-teaming, input filtering, and output review
4. **Monitoring layer**: Continuously monitor for anomalous patterns after deployment, iterating on improvements

You'll notice these aren't all training-time fixes. Safety is a system property; the training run is just one of four layers.

How do you know your safety alignment actually worked? That's an evaluation problem.

> **Checkpoint**: Why can jailbreak attacks succeed? What does this imply for the choice of safety alignment methods?

Next: [Evaluation and Method Selection](./evaluation-and-selection)
