# 7. The Framework Landscape

In 2026 the agent-framework story is still in flux. New libraries appear monthly; old ones reorganize their abstractions; the "right" choice in March is mid-tier by September. This page is intentionally short and will go stale faster than the rest of the chapter — treat it as orientation, not as recommendation.

The opinion you should leave with: **rolling your own thin loop on top of the `anthropic` or `openai` SDK is a perfectly reasonable production path.** The agent loop in [§1](./the-agent-loop) was ~100 lines. With the [§6](./safety-budgets) safety machinery added, it's maybe 250. That's a small enough surface area that you understand every line, can trace every bug, and can swap models without rewriting your scaffolding. Frameworks add value for orchestration, observability, and prefab patterns; they extract a tax in lock-in, learning curve, and abstraction debt. Pick deliberately.

## Three named frameworks

We cap at three deliberately. Naming more invites a comparison table this page is not going to age well as.

**LangChain / LangGraph.** The most ecosystem mass — every integration imaginable (every vector DB, every model provider, every tool). LangGraph is the agent-graph layer on top, modeling agents as directed graphs of nodes that pass state. Pick it if you want batteries included, can stomach opinionated abstractions, and value the integration breadth more than minimalism. Sharp edges: abstraction churn between minor versions; documentation that lags the code; the "is this LangChain or LangGraph or LCEL" question.

**OpenAI Agents SDK.** First-party, light, and opinionated. Designed around OpenAI's models and patterns (handoffs between agents, tracing built in, tight loop semantics). Pick it if you're OpenAI-only and want minimum boilerplate over a thoughtful, modern API. Sharp edges: lock-in is real (handoff patterns and traces are OpenAI-specific); not a fit if you need to swap to Claude or Gemini for a workload.

**Anthropic Claude SDK + your own loop.** Not a framework — just the SDK and the ~250 lines of glue described across this chapter. Pick it if you want maximum control, minimal lock-in, and the ability to switch models with a one-line config change (the SDK shapes for tool use are similar enough across Anthropic / OpenAI / Gemini that an abstraction over them is a couple hundred lines, not a framework dependency). Sharp edges: you write your own observability, your own retry logic, your own everything. That's a feature for some teams and a bug for others.

There are more — CrewAI, AutoGen, LlamaIndex's agent module, Pydantic AI, several others released in the last twelve months. They all do roughly what this chapter described. Most teams don't try more than two before settling.

## You don't need a framework if…

- You have fewer than ~5 tools and one or two control patterns.
- You can write the loop yourself in an afternoon (you can — it's [§1](./the-agent-loop)).
- You don't need fancy graph orchestration (state machines, parallel branches, retries with backoff baked in).
- You'd rather own the abstractions than rent them.

## You might want a framework if…

- You're building long-horizon planning agents with branching, retries, and human-in-the-loop checkpoints.
- You want pre-built RAG and memory components and don't want to integrate them yourself.
- Your team's bandwidth for plumbing is zero — there is one engineer doing this part-time and they need a working tracing UI on day three.
- You're committing to one model provider for the foreseeable future and want their first-party SDK ergonomics.

## The thing that actually determines whether your agent is good

It is not the framework. It is, in roughly this order:

1. Tool design ([§2](./tool-design)) — names, descriptions, schemas, error returns.
2. Prompt quality — the system prompt, the tool descriptions, the way the user goal is framed.
3. Eval rigor ([§8](./evaluating-agents)) — having a labeled set, running it on every change, watching trajectories.
4. Safety + observability ([§6](./safety-budgets)) — the mundane stuff that keeps you from regressing silently.
5. Whether the model is fundamentally capable of the task at all.

Frameworks come in maybe seventh. Pick whichever one — including "none" — lets you spend the most time on items 1–4.

Next: [Evaluating Agents →](./evaluating-agents)
