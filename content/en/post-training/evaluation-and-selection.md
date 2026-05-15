# 8. Evaluation and Method Selection

A methodology for judging post-training effectiveness, and a decision table for choosing your stack.

## Why evaluating post-training is hard

Evaluating a post-trained model is far harder than evaluating a pre-trained one. Pre-training can be measured by perplexity, but post-training's objectives are multi-dimensional -- useful, safe, accurate, natural, format-compliant -- and these dimensions are hard to capture in a single number.

[Chapter 13](../evaluation) is dedicated to evaluation and observability in production. Here we focus narrowly on judging "did this post-training run work?"

## Three tiers of evaluation methods

**Automatic metrics**: Fast but coarse. Traditional metrics like perplexity, BLEU, and ROUGE only measure surface matching and cannot assess whether a response is genuinely helpful. They're better as quick screening tools than final judgment criteria.

**Task benchmarks**: Structured but limited. MT-Bench and Arena-Hard use multi-turn conversations to evaluate different capability dimensions; MMLU tests breadth of knowledge. In 2026, the industry has about 15 mainstream benchmarks in active use, but only 4 reliably predict production performance.

**Human evaluation and arena platforms**: Closest to reality but highest cost. Chatbot Arena calculates Elo scores through 6M+ user votes in blind head-to-head comparisons, making it currently the closest approximation to "real user preference."

## Practical evaluation recommendations

| Evaluation Scenario | Recommended Method | Notes |
| --- | --- | --- |
| Rapid iteration | Automatic metrics + small-scale human spot-checks | Don't rely on numbers alone |
| Pre-release | MT-Bench + domain-specific tests | Cover safety and edge cases |
| Method selection | Arena-Hard + human blind evaluation | Ensure evaluation set matches target scenario |
| Safety audit | Red-teaming + known attack pattern library | Continuously update attack vectors |

## Post-training method selection decisions

Finally, let's put all methods together for a practical selection reference:

| Your Situation | Recommended Method | Rationale |
| --- | --- | --- |
| First post-training, limited resources | SFT + DPO | Simple pipeline, mature tooling |
| Pursuing conversation quality, have annotation budget | SFT + RLHF (PPO) | Online learning yields better results |
| Improving reasoning, verifiable tasks | SFT + GRPO/RLVR | Effectiveness proven by DeepSeek-R1 |
| Only binary feedback data | SFT + KTO | No paired preference data needed |
| Tight GPU memory, quick experiments | SFT + SimPO | No reference model needed |
| Production-grade full optimization | SFT + RLHF/GRPO + Safety Alignment | Multi-stage combination for best results |

If you map this back to the four-stage stack from [Section 1](./landscape), the pattern is consistent: start at SFT, add preference optimization for chat quality, add capability enhancement for reasoning, layer safety on top of whatever you ship.

> **Checkpoint**: If you were doing post-training for a customer service LLM, which method combination would you choose? Why?

Next: [Practice and References](./practice)
