# 9. Practice and References

Hands-on post-training, a self-check list, and the papers worth reading.

## Complete an SFT fine-tuning with the TRL library

Use HuggingFace's TRL (Transformer Reinforcement Learning) library to practice [SFT](./sft) on a small model:

1. Choose a small model (e.g., Qwen2.5-1.5B or Llama-3.2-1B)
2. Prepare 1,000 high-quality instruction-response data points
3. Train for 1-2 epochs using `SFTTrainer`
4. Compare response quality before and after training

Focus areas: training loss curve, response format, signs of Catastrophic Forgetting.

## Align an SFT model with DPO

Perform [DPO](./dpo) training on top of your SFT model:

1. Prepare 500 paired preference data points (chosen/rejected pairs)
2. Train using `DPOTrainer`
3. Compare response quality between SFT-only and SFT+DPO
4. Experiment with adjusting the beta parameter and observe the effect on results

Focus areas: direction of quality changes, signs of overfitting, impact of beta on results.

## Design a post-training plan for a medical Q&A scenario

Design a post-training plan for the following scenario, writing a 1-page technical proposal:

> Scenario: You need to customize an LLM for a medical Q&A scenario. The base model is Qwen2.5-7B. Requirements: accurately answer common medical questions, refuse to provide diagnostic advice, support both Chinese and English.

The proposal should include: chosen post-training methods, data requirements, training steps, evaluation plan, and safety measures.

## Self-check list

- [ ] I can explain what problem each of SFT, RLHF, DPO, and GRPO solves
- [ ] I can articulate the core difference between RLHF and DPO
- [ ] I understand why data quality matters more than quantity
- [ ] I know the main challenges of Safety Alignment
- [ ] I can select the right post-training method for a specific scenario

---

## References

- Ouyang et al., *Training language models to follow instructions with human feedback*, NeurIPS 2022 -- The industrial starting point for RLHF
- Rafailov et al., *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*, NeurIPS 2023 -- The original DPO paper
- Shao et al., *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models*, 2024 -- Where GRPO was first proposed
- DeepSeek-AI, *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*, 2025 -- The reasoning model benchmark
- *Reinforcement Learning for LLM Post-Training: A Survey*, arXiv 2407.16216 -- A continuously updated comprehensive survey
- *A Comprehensive Survey of Direct Preference Optimization*, arXiv 2410.15595 -- The full landscape of DPO variants
- *Fixing It in Post: A Comparative Study of LLM Post-Training Data Quality and Model Performance*, NeurIPS 2025 -- Empirical study on data quality
- HuggingFace, *Guide to Reinforcement Learning Post-Training Algorithms* -- Algorithm comparison reference

## Further reading

- **Getting started**: Phil Schmid, *How to align open LLMs in 2025 with DPO & synthetic data* -- Hands-on guide
- **Deep dive into GRPO**: Cameron R. Wolfe, *Group Relative Policy Optimization (GRPO)* -- Detailed mathematical derivation
- **Open-source frameworks**: verl (HybridFlow), rLLM, slime -- Production-grade RL post-training frameworks
- **Evaluation platform**: Chatbot Arena (lmarena.ai) -- Model battle leaderboard based on real user votes
- **Industry trends**: llm-stats.com, *Post-Training in 2026: GRPO, DAPO, RLVR & Beyond* -- The 2026 post-training technology landscape

---

That closes the post-training story. The next chapter zooms out to evaluation and observability across the whole LLM application stack -- not just the training run.

Next: [Chapter 13: Evaluation & Observability](../evaluation)
