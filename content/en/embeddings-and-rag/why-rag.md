# 1. Why RAG

The model in [Chapter 2](../llm-apis-and-prompts/api-call-shape) can hold a conversation, return JSON, and call tools. But it has three structural blind spots that you can't prompt your way out of:

1. **Context is bounded.** A 1M-token model still can't see your 50M-token corpus ([Chapter 0 §5](../how-llms-work/context-window)).
2. **Training cutoff.** The model knows nothing about anything after its cutoff date — your last sprint's PRs, today's incident report, the API your team shipped this morning.
3. **Hallucination.** Even on topics that *were* in training, the model produces plausible-sounding text without privileged access to "do I know this" ([Chapter 2 §9](../llm-apis-and-prompts/failure-modes)).

RAG addresses all three with the same trick: at query time, retrieve the relevant slice of text and paste it into the prompt.

## The three problems, concretely

### Problem 1: corpus > context window

A frontend dev's mental model: "the context window is the model's RAM." If your knowledge base is bigger than RAM, you need a fetch-from-disk strategy. RAG is that fetch.

Concretely, suppose your company has 100,000 internal documents averaging 2,000 words each:

```
100,000 docs × 2,000 words × 1.3 tokens/word ≈ 260,000,000 tokens
```

That's 260x larger than a 1M-context model. There is no model on the market — and likely never will be — where you can stuff this in on every call. Even if you could, look at the cost:

```
260M input tokens × $3 per 1M input tokens = $780 per query
```

You can't afford that. RAG turns the same question into "embed the query (cents), retrieve 5 chunks of 500 tokens each, send 2,500 tokens of context plus the query." Total: a few cents per call.

### Problem 2: post-cutoff knowledge

The model's training data has a cutoff — typically 6–12 months before release. It does not know your company exists, what your codebase looks like, what bug you fixed yesterday, or what the user just typed into another tab. RAG is the standard pattern for injecting time-sensitive knowledge: index the latest docs and let retrieval bring them in on demand.

### Problem 3: hallucination grounding

When the model is forced to answer **only from a set of chunks you provide**, hallucination drops dramatically. It still happens — the model can misread, conflate, or fill in gaps — but the failure mode is now "ignored or misread the source," which is auditable, instead of "invented something whole-cloth," which is not. Citation patterns ([§5](./retrieval-pipeline), [§8](./production-patterns)) make this auditability the whole point.

## "Why not just put everything in the prompt?"

Even when the corpus *does* fit, stuffing it all in is wasteful:

| Strategy | Tokens per call | Latency | Quality |
|---|---:|---|---|
| Stuff entire 200K-token codebase | 200,000 | seconds of prefill | "lost in the middle" — recall degrades on long context |
| Retrieve top-5 relevant chunks (~2,500 tokens) | 2,500 | tens of milliseconds | sharper — model reads only what matters |

The cost ratio is 80x. The quality usually goes *up* with retrieval, not down — long-context models are known to under-use information from the middle of a long prompt. A short, targeted context outperforms a giant dump.

## "Why not fine-tune instead?"

A common confusion. Fine-tuning and RAG solve different problems.

| | Fine-tuning | RAG |
|---|---|---|
| **What it changes** | Model weights | The prompt |
| **Best for** | Behavior — tone, format, style, domain reasoning | Knowledge — facts, sources, fresh data |
| **Update cost** | Re-train (hours to days, $$$) | Re-index (minutes, ~free) |
| **Auditability** | Hard — knowledge is baked in | Easy — chunks are citable |
| **Hallucination** | Same as base model on facts | Reduced on facts in the corpus |

A simple rule: **fine-tune for behavior, RAG for knowledge**. If you want the model to always answer in legal-memo format, fine-tune. If you want it to answer questions about your 50,000 legal memos, RAG. Most production systems do both — a lightly fine-tuned model that consumes RAG context.

Fine-tuning bakes knowledge in lossily — the model "remembers" the corpus but can't cite it, and you can't update one fact without re-training. We cover fine-tuning end-to-end in **Chapter 11**.

## The name

The architecture has a paper of origin — *Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks* (Lewis et al., 2020) — but everything in production today is a variation on the same idea: **retrieve, then read.** You will see it called RAG, retrieval, grounding, context augmentation, in-context learning with retrieval. Same thing.

The next page makes the "retrieve" half concrete: how does a query find the right chunks?

Next: [Embeddings 101 →](./embeddings)
