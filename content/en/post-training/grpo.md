# 5. GRPO and Reasoning Enhancement

Teaching models to think deeply.

## Starting with DeepSeek-R1

In early 2025, DeepSeek released its R1 model and demonstrated a stunning finding: through pure RL training (without human-written reasoning examples), a model can spontaneously develop Chain-of-Thought capabilities. The core algorithm behind this is GRPO.

## GRPO's core innovation

GRPO (Group Relative Policy Optimization) was first proposed in the DeepSeekMath paper. It makes a key simplification to [PPO](./rlhf): **remove the value network (critic) and use group-relative comparisons to estimate the advantage function**.

Specifically, for each input question, GRPO has the model generate a group of responses (typically 64), then scores each response using a reward function (or verifier). Each response's advantage value is not absolute but relative to the group's average:

```
advantage_i = (reward_i - group_mean) / group_std
```

This design has two benefits: first, it completely eliminates the value network, saving massive GPU memory; second, the within-group normalization provides a natural baseline, reducing gradient variance.

```mermaid
flowchart LR
    A[Prompt x] --> B[Sample G responses from policy]
    B --> C[Score each: reward_i]
    C --> D[Normalize within group: A_i = (r_i - mean) / std]
    D --> E[Policy update with PPO-style clip]
    E --> A
```

## RLVR: replacing humans with verifiers

GRPO's most powerful application scenario is **RLVR (Reinforcement Learning with Verifiable Rewards)**. For math and code tasks, you don't need humans to judge whether an answer is good -- unit tests, proof checkers, or math verifiers can provide entirely objective reward signals.

This allows training to proceed fully online: model generates response -> verifier scores it -> policy updates -> model generates new response, and the cycle repeats. DeepSeek-R1 used exactly this approach to achieve rapid improvement on math and code reasoning tasks.

The crucial point: RLVR sidesteps the entire reward-model annotation pipeline. The reward function is *code*, and code doesn't disagree with itself.

## DAPO: solving reasoning training instability

At large scale, GRPO still faces stability issues in reasoning training. ByteDance's DAPO addresses this through four techniques:

1. **Preventing entropy collapse**: Stopping model outputs from becoming overly deterministic and losing exploration ability
2. **Dynamic batch filtering**: Discarding uninformative training samples
3. **Token-level gradient computation**: Finer-grained gradient signals than sequence-level
4. **Length reward adjustment**: Preventing the model from learning to "write longer answers for higher rewards"

## The boundaries of reasoning enhancement

RLVR's effectiveness is remarkable on tasks with verifiers, but it has clear applicability boundaries:

- **Well-suited**: Mathematical reasoning, code generation, formal proofs, structured output
- **Less suited**: Open-ended writing, creative tasks, subjective Q&A
- **Under exploration**: Multi-step planning, tool use, agent behavior

Whether you're doing SFT, RLHF, DPO or GRPO, the deciding factor is rarely the algorithm -- it's the data. That's the next page.

> **Checkpoint**: What is the biggest difference between GRPO and PPO? Why is RLVR particularly well-suited for math and code tasks?

Next: [Data Engineering](./data)
