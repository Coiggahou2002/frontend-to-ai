# 2. Supervised Fine-Tuning (SFT)

Teaching the model to talk like a human.

## The critical leap from "completion" to "conversation"

At its core, a pre-trained model is a text completion engine: given a prefix, predict the next token. It doesn't know it's an assistant, and it doesn't understand that "a user is asking a question."

SFT's core idea is simple: train the model on a set of "good conversation examples" so it learns conversational patterns. These examples are typically in instruction-input-output triplet form:

```
Instruction: Please translate the following English into Chinese
Input: The quick brown fox jumps over the lazy dog.
Output: 敏捷的棕色狐狸跳过了那只懒狗。
```

The training objective is the same next-token prediction as pre-training, but the training data shifts from unlabeled web text to carefully constructed instruction-response pairs.

## Preparing SFT data

Data quality almost single-handedly determines the ceiling of this stage. IBM Research's empirical study at NeurIPS 2025 showed that using fewer but higher-quality data points (a 14% reduction) can match or even exceed the performance of larger datasets.

Key data quality dimensions include:

- **Accuracy**: Responses must be factually correct, avoiding hallucinations
- **Diversity**: Coverage across multiple task types (Q&A, translation, summarization, code, reasoning, etc.)
- **Complexity gradient**: A mix from simple to complex, avoiding an all-easy-tasks dataset
- **Format consistency**: Unified conversation templates so the model learns structured output

We dig deeper into data engineering in [Section 6](./data).

## Rules of thumb in training practice

SFT training is much lighter than pre-training, but there are still a few key parameters:

| Parameter | Common Range | Notes |
| --- | --- | --- |
| Dataset size | 10K - 100K samples | Quality matters far more than quantity |
| Learning rate | 1e-5 to 5e-5 | Too high causes forgetting; too low converges slowly |
| Training epochs | 1-3 epochs | More epochs risk overfitting |
| Batch size | Adjust to fit GPU memory | Gradient accumulation can simulate larger batches |

## Common SFT pitfalls

**Catastrophic Forgetting**: Over-training causes the model to lose the general capabilities learned during pre-training. The InstructGPT paper uses PPO-ptx (mixing in a portion of pre-training data) to mitigate this.

**Format Lock-in**: If all training data follows a single rigid format, the model becomes unable to answer in any other way, losing flexibility.

**Overfitting to Surface Patterns**: The model may learn patterns that "look like good answers" (e.g., always starting with "Sure, let me help you with that"), while the actual content quality doesn't improve.

SFT also has a fundamental ceiling: it can only teach the model to imitate examples, not to *prefer* one answer over another. That's the gap [RLHF](./rlhf) fills next.

> **Checkpoint**: If you only had 5,000 high-quality data points and 50,000 mediocre-quality data points, which would you choose? Why?

Next: [RLHF](./rlhf)
