# 4. DPO and Its Variants

Simpler preference learning.

## The core intuition behind DPO

In 2023, Rafailov et al. proposed a key insight: **the language model itself is an implicit reward model**. You don't need to train a separate reward model and then optimize with RL -- you can train the language model directly on preference data.

DPO's mathematical derivation starts from RLHF's optimal policy and, through variable substitution, arrives at a closed-form solution. The final training objective becomes a simple classification loss: given a pair of "good answer" and "bad answer," increase the probability of the good answer and decrease the probability of the bad answer.

```
Given a preference pair (x, y_w, y_l)  -- y_w preferred over y_l

L_DPO = -log sigmoid(
    beta * ( log pi_theta(y_w|x) - log pi_ref(y_w|x) )
  - beta * ( log pi_theta(y_l|x) - log pi_ref(y_l|x) )
)
```

No reward model. No PPO loop. Just a binary cross-entropy on log-probability differences against a frozen reference.

## RLHF vs. DPO pipeline comparison

| Dimension | RLHF (PPO) | DPO |
| --- | --- | --- |
| Training pipeline | SFT -> RM -> PPO | SFT -> DPO |
| Models required | 4 (policy, reward, reference, value network) | 2 (policy, reference) |
| Data type | Ranking data + online sampling | Offline paired preference data |
| Training stability | Unstable, requires extensive tuning | Relatively stable |
| Compute cost | High | Moderate |
| Online exploration | Yes (via sampling new responses) | No (static data only) |

DPO's greatest advantage is simplification: no reward model to train, no complex RL loop -- a standard training loop is all you need for preference optimization.

## Limitations of DPO

DPO is not a perfect replacement for [RLHF](./rlhf):

- **Distribution sensitivity**: DPO uses offline data; if the training data distribution diverges significantly from the model's current policy, effectiveness degrades
- **Overfitting risk**: Easy to overfit on small datasets, especially when the "bad answers" aren't actually that bad
- **Lack of online exploration**: PPO can sample new responses during training and get feedback; DPO can only learn from static data

## The DPO variant family

DPO's elegant framework spawned a series of variants, each addressing specific pain points:

| Method | Core Improvement | Use Case |
| --- | --- | --- |
| IPO | Replaces sigmoid with MSE loss for robustness | Noisy preference data; bad answers aren't very bad |
| KTO | Supports unpaired data (only "good/bad" labels needed) | Hard to obtain paired preference data |
| SimPO | Removes reference model; uses length-normalized log probability | Limited GPU memory; efficiency-focused |
| ORPO | Merges SFT and preference optimization into one step | Reducing training stages |

## Selection guidance

A practical selection framework: when you have ample compute and online sampling capability, PPO/GRPO typically perform better; when resources are limited and simplicity is paramount, DPO or SimPO are reasonable choices; when you only have unpaired data, KTO is the only option.

The next chapter takes preference learning a step further -- replacing humans with verifiers, and pushing the model toward genuine reasoning ability.

> **Checkpoint**: If you have paired preference data but limited GPU resources, would you choose RLHF or DPO? Why?

Next: [GRPO and Reasoning Enhancement](./grpo)
