# 6. Sampling — Why the Same Prompt Gives Different Answers

[§2](./next-token-prediction) said the model outputs a **probability distribution** over the next token. It does not output "the next token." So to actually generate text, we need a step that **picks one token from the distribution**. This step is called **sampling**, and how you do it has a large effect on the output's character.

## Greedy: Always Pick the Top Token

The simplest strategy: always pick whichever token has the highest probability.

```
distribution: { " Paris": 0.78, " a": 0.04, " the": 0.03, ... }
greedy pick:    " Paris"
```

This is **deterministic** — same input, same output, every time. Useful when you want reproducibility. But greedy decoding has a known failure mode: it produces repetitive, dull text. Because at each step it always commits to the locally most likely token, it can lock into loops ("the the the the the") or boring boilerplate. It's also fragile — if the model is even slightly miscalibrated, greedy decoding amplifies the miscalibration into a single guaranteed-wrong path.

## Temperature: Reshape the Distribution

The model's raw output, before any probability-shaped softmax is applied, is a vector of unnormalized scores called **logits**. To turn logits into a probability distribution we apply softmax. **Temperature** is a single number that scales the logits before that softmax:

```
adjusted_logits = logits / temperature
probabilities   = softmax(adjusted_logits)
```

The effect:

- **Low T (0.0–0.3)**: divides logits by a small number, making the gaps between them larger. The distribution becomes **sharper** — the top token gets even more probability mass, less likely tokens get squashed toward zero. Output becomes more deterministic, more conservative, more likely to repeat the obvious answer. T=0 is mathematically equivalent to greedy decoding (well, the limit of it).
- **T = 1.0**: leaves logits as the model produced them. This is the "default" distribution the model was trained to output.
- **High T (1.0–2.0)**: divides by a large number, flattening the distribution. Less likely tokens get a real chance of being picked. Output becomes more diverse, more creative, more likely to surprise you — and more likely to go off the rails.

A practical heuristic:

| Task                                              | Recommended temperature |
|---|---|
| Code generation, structured extraction, classification, factual QA | 0.0–0.2 |
| General assistant tasks, technical writing, balanced chat | 0.3–0.7 |
| Creative writing, brainstorming, marketing copy   | 0.7–1.2 |
| Wild ideas, "give me 20 different angles"         | 1.2–1.5 |

For most production use cases — RAG, code generation, structured extraction, agent tool calls — you want temperature low (0.0–0.3). Creativity is a feature for chat and writing assistants, not for systems that need to produce predictable outputs.

## Top-p (Nucleus) Sampling

Temperature reshapes the distribution but still considers all tokens. **Top-p sampling**, also called **nucleus sampling**, takes a different approach: only consider the smallest set of tokens whose cumulative probability is at least `p`, and zero out everything else.

```
p = 0.9
distribution sorted:  Paris (0.78), a (0.04), the (0.03), my (0.02), some (0.02), ...
cumulative:           0.78,         0.82,     0.85,       0.87,      0.89, 0.91 <- stop
nucleus:              { Paris, a, the, my, some } — that's the set we sample from
```

Top-p adapts to the shape of the distribution. When the model is confident (one token is dominant), the nucleus is small and the output is essentially deterministic. When the model is uncertain (many tokens are plausible), the nucleus expands and the output becomes more diverse.

In practice, **most APIs let you set both temperature and top-p**, but you typically only adjust one or the other. A common starting point is `top_p = 1.0` (off) and only tune temperature; or `temperature = 1.0` and tune top-p (often 0.9).

There's also `top_k`, a similar idea: only consider the top K tokens by probability. Less commonly used than top-p in modern APIs.

## Other Knobs You Will See

| Parameter            | What it does |
|---|---|
| `frequency_penalty`  | Reduces probability of tokens that have already appeared (discourages repetition by raw count). |
| `presence_penalty`   | Reduces probability of tokens that have already appeared at all (encourages bringing in new topics). |
| `stop`               | A list of strings that, if produced, halt generation. Useful for forcing structured output formats. |
| `seed`               | Some APIs let you pin the random seed for sampling, making temperature > 0 reproducible — though no API guarantees this perfectly. |
| `logit_bias`         | Manually nudge the probability of specific token IDs up or down. Power-user feature. |

## The Frontend Developer's Headache: Non-Determinism

The big shift coming from regular software: **same input, same model, different output**. Even at temperature 0, you may not get bit-exact reproducibility — floating point non-associativity in batched matrix multiplies, kernel autotuning, and how requests are batched together at the inference server can all introduce small variations.

This breaks the testing playbook you're used to:

- Snapshot tests don't work — the snapshot will drift.
- Equality assertions don't work — the model can say the same thing five different ways.
- "Run it once and check" doesn't tell you if a regression has happened.

You need different evaluation techniques: scoring outputs against rubrics, running the same prompt many times and measuring distribution-level properties (rate of correct answers, rate of refusals, average output length), using a separate "judge" LLM to grade outputs, and accepting that you measure **regression rates**, not equality.

This is the core challenge of LLM evaluation, and it gets a chapter of its own — **Chapter 13 (Evaluation and Observability)**. The short version: stop thinking like a unit test author and start thinking like a stats-aware QA engineer. Distributions, not values.

Next: [Putting It Together →](./putting-it-together)
