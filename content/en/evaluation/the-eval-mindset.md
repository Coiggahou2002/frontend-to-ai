# 1. The Eval Mindset

The mindset shift is one sentence:

> **Distributions, not values. Rates, not booleans.**

Internalize that and the rest of this chapter is mechanics. Skip it and you'll spend a quarter writing snapshot tests that are stale before they merge.

## The thesis, restated

From [Chapter 0 §6](../how-llms-work/sampling): the model emits a probability distribution over next tokens. Sampling picks one. Same prompt, two calls, different outputs. Even at temperature 0, floating-point non-associativity in batched matmuls and inference-server batching can drift the result.

The output of an LLM call is not a value. It's a sample from a distribution. The question "did this work?" is therefore not "did the output equal the expected string?" — it's "what fraction of samples from this distribution satisfy the criterion I care about?"

That's a different question. It needs different tools.

## Where unit-test thinking still works

Not every output is generative. Plenty of LLM-powered code paths still have a right answer:

- **Classification.** "Is this email spam?" One of {spam, not spam}. Accuracy, F1.
- **Extraction.** "Pull the company name and the dollar amount from this invoice." Field-by-field equality. JSON schema validation.
- **Tool-use argument extraction.** "Did the agent call `transfer_money` with `amount=100`?" Programmatic check on the tool log ([Ch 4 §8](../agents-and-orchestration/evaluating-agents)).
- **Routing.** "Which of these 12 intents fits this user message?" Confusion matrix.

For these, traditional QA discipline applies. Build a labeled set of `(input, expected_output)` pairs, run the model, count exact matches. The non-determinism is real but the answer surface is small enough that you can pin it.

Treat these as the **easy half** of LLM eval. Always do them first when they apply — they're cheap, fast, and unambiguous.

## Where unit-test thinking breaks

The hard half is everything generative:

- A summary. There are a hundred good summaries of any document.
- A chat reply. The model can be helpful in a thousand phrasings.
- A RAG answer. The facts must be right, but the prose around them is open.
- An agent trajectory. Many sequences of tool calls reach the same goal.
- An open-ended writing task. There is no expected output.

For these, equality assertions are useless. The model can be correct and produce ten different correct outputs. It can also be wrong in ways that look correct. You need:

- A **rubric** — what does "good" mean, broken into checkable dimensions?
- A **grader** — model or human, that scores against the rubric.
- A **distribution view** — score a hundred outputs and look at the rate of pass, not the result of one run.

This is most of the work. The rest of the chapter is about doing it without losing your mind.

## The scientific-method analogy

Treat every prompt edit as a hypothesis. Make the analogy explicit:

| Software engineering | LLM engineering |
|---|---|
| Code change | Prompt / model / tool / fine-tune change |
| Unit test | Programmatic metric on the labeled set |
| Integration test | LLM-judge metric on the labeled set |
| Code review | Diff vs. baseline on regression metrics |
| Feature flag rollout | Shadow traffic, canary, A/B test |
| Production monitoring | Tracing, structured logs, drift detection |

Every prompt edit is an experiment. The labeled set is your control group. The metrics are your measurements. The diff vs. last green build is the result.

If you can't articulate the hypothesis ("this rewording will reduce hallucination on the medical-question slice from 8% to under 4%"), you don't have an experiment. You have a vibe-driven tweak.

## The two failure modes you avoid by having eval

Without an eval discipline, two things happen, and both are silent.

**Silent regression.** Someone — possibly you — edits the system prompt to fix a customer-reported bug. The bug goes away. So does the previous behavior on three other slices that nobody is watching. Two weeks later, support starts getting tickets. Now you have to bisect across model version, prompt version, and tool-schema version, none of which were tracked. You will spend a week recovering.

**Cargo-cult tweaks.** A blog post says "adding 'think step by step' improves performance." You add it. Someone else says "Anthropic recommends XML tags in the system prompt." You add those. Someone says "use temperature 0.3, not 0." You change it. Now your prompt is 40% longer than it needs to be, you can't tell which changes helped, and the latency went up. You changed the system five times and learned nothing.

Both failure modes share the same root cause: no measurement. Eval is the cure for both.

## What eval lets you do

| With eval | Without eval |
|---|---|
| Ship a prompt change in confidence | Ship a prompt change in hope |
| Switch from Sonnet to Haiku for cost savings | Be afraid to touch the model picker |
| Refactor the system prompt for prompt-cache stability ([Ch 7](../kv-cache)) | Avoid touching it because it "works" |
| Compare two RAG retrievers on the same labeled set | Argue about which one feels better |
| Run a fine-tune and know whether it helped ([Ch 9](../fine-tuning)) | Tune for a week, ship, find out in production |
| Detect that a model provider's silent update broke you | Notice 11 days later from support tickets |
| Roll back a regression in one commit | Bisect across three systems for a week |

The blunt version: **without eval, you can't change the system safely**. With eval, every component — prompt, model, tools, retriever, fine-tune — becomes a swappable part with measurable behavior.

## The mindset, restated

Echoing [Ch 0 §6](../how-llms-work/sampling) and [Ch 2 §9](../llm-apis-and-prompts/failure-modes):

```
Hallucination rate.        Not "does it hallucinate".
Injection success rate.    Not "is it secure".
Refusal false-positive %.  Not "did this prompt refuse".
Faithfulness rate.         Not "is the answer right".
Task success rate.         Not "did the agent work".
```

Every question about an LLM-powered system is a question about a rate over a population of inputs. Build the population (golden set, [§2](./golden-sets)). Measure the rate (metrics, [§3](./metrics)). Track the rate over time. That is the entire job.

Next: [Golden Sets →](./golden-sets)
