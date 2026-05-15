# 5. Memory & State

The model is stateless ([Chapter 0 §4](../how-llms-work/multi-turn)). Two consecutive API calls share nothing on the server. So when people say "the agent remembers" — what they actually mean is: *the client replays the messages array on every iteration, and that array is the agent's working memory.*

Internalize this and the rest of memory engineering becomes obvious: you decide what's in the array. You decide what gets summarized. You decide what spills out to a database. The model just reads whatever you put in front of it.

## Three tiers

| Tier | Lives in | Lifetime | Token cost | What goes here |
|---|---|---|---|---|
| Working memory | `messages` array (in process) | Single agent run | Counts against context budget | The active transcript: tool calls, results, intermediate text |
| Scratchpad | A keyed in-memory dict the agent can read/write via tools | Single session (multiple runs) | Only what gets injected per turn | Stable facts: user name, current ticket ID, picked-up preferences |
| Persistent memory | External store (Postgres, vector DB) | Across sessions / users | Retrieval-controlled, like RAG | Long-term: past conversations, user profile, prior decisions |

You almost certainly need tier 1 (every agent has it). You probably want tier 2 the moment your agent has multiple sub-tasks within one session. You only need tier 3 if your product has cross-session continuity ("remember what I asked you last week").

## Tier 1: working memory = the messages array

This is what the loop in [§1](./the-agent-loop) already maintains. Every iteration appends:

- The assistant's turn (text + tool_use blocks).
- The user-role turn carrying tool_results.

The transcript grows monotonically. Every turn the model re-reads the entire thing. Two consequences you have to design for:

**1. The transcript is your debug log, for free.** Don't throw it away when the run ends — log it for [§8 evaluation](./evaluating-agents). The full sequence of `(messages, tool_results, model_output)` is the trajectory.

**2. Long runs blow up context.** Every iteration's input grows. By iteration 15, a research agent might be sending 80K tokens of transcript in every call. We deal with this below (summarization) and in §4 (sub-agents take the largest chunks out of the parent's context entirely).

## Tier 2: scratchpad = an explicit key-value store

The scratchpad is a simple dict the agent can write to and read from via two tools:

```python
SCRATCH: dict[str, str] = {}

SCRATCH_TOOLS = [
    {
        "name": "scratch_set",
        "description": (
            "Write a fact to the scratchpad. Use for stable info you'll need across "
            "iterations: user_name, ticket_id, current_environment, user preferences."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
            "required": ["key", "value"],
        },
    },
    {
        "name": "scratch_get",
        "description": "Read a value from the scratchpad by key.",
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        },
    },
]

def tool_scratch_set(key: str, value: str) -> dict:
    SCRATCH[key] = value
    return {"set": key}

def tool_scratch_get(key: str) -> dict:
    return {"key": key, "value": SCRATCH.get(key)}
```

Better still, have the loop **inject the current scratchpad as a system-prompt section on every iteration** rather than relying on the model to call `scratch_get`. The model "remembers" without spending tokens on retrieval calls:

```python
def build_system_prompt(base_prompt: str, scratch: dict) -> str:
    if not scratch:
        return base_prompt
    facts = "\n".join(f"- {k}: {v}" for k, v in scratch.items())
    return f"{base_prompt}\n\n<scratchpad>\n{facts}\n</scratchpad>"
```

This is a small idea with disproportionate impact: the model now has constant-cost "memory" that survives any context-window pressure. Used heavily in coding agents (current file, current branch, last test result) and customer-support agents (user_id, ticket priority, escalation flag).

## Tier 3: persistent memory across sessions

When the agent run ends, tier 1 and 2 are gone. If the next session needs to know what happened in the previous session, you need an external store. This is just RAG ([Chapter 3](../embeddings-and-rag)) applied to past interactions instead of documents:

- After each session, summarize the salient facts (use the LLM itself to write the summary).
- Embed the summary and write to a vector store with `(user_id, session_id, ts)` metadata.
- At the start of the next session, retrieve the top-k summaries for this user and inject them into the system prompt or as an early `user` message.

The retrieval policy is the design choice: by user_id, by topic similarity to the new query, by recency, or some weighted combination. Recency-weighted similarity is a reasonable default.

This is the architecture behind ChatGPT's "memory" feature, Anthropic's beta Memory tool, and most "personalized assistant" products. It's not a different mechanism from RAG; it's just a corpus of past-conversation summaries instead of docs.

## Summarization: the long-running-agent escape hatch

When working memory gets close to the context limit, the loop has to do something. Three strategies, in increasing sophistication:

1. **Truncate.** Drop the oldest tool_use/tool_result pairs once you cross a threshold (say, 50% of context). Cheap, lossy, often fine.
2. **Summarize and slice.** When the transcript exceeds N tokens, replace the middle with an LLM-written summary; keep the user goal at the start and the most-recent ~10 turns intact.
3. **Sub-agents** ([§4](./parallel-and-subagents)). Don't summarize after the fact — push large sub-tasks into sub-agents that return only structured findings, so the parent's transcript never grows that large in the first place.

A tiny summarize-and-slice helper:

```python
def maybe_summarize(messages: list, threshold_tokens: int = 80_000) -> list:
    if estimate_tokens(messages) < threshold_tokens:
        return messages

    keep_head = messages[:1]                  # original user goal
    keep_tail = messages[-10:]                # most-recent turns
    middle = messages[1:-10]
    if not middle:
        return messages

    summary = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="Summarize this agent transcript. Keep all decisions, tool results, and unresolved questions. Drop tool-call boilerplate.",
        messages=[{"role": "user", "content": serialize_for_summary(middle)}],
    ).content[0].text

    return keep_head + [
        {"role": "user", "content": f"<summary_of_prior_steps>\n{summary}\n</summary_of_prior_steps>"}
    ] + keep_tail
```

`estimate_tokens` is a tokenizer-based count of the serialized messages. `serialize_for_summary` flattens tool blocks into readable text. Both are 10-line helpers.

This is lossy. Run it on logged trajectories and check that the summary preserves what mattered before turning it on in production.

## The context-budget mental model

At any iteration, the agent's prompt has roughly this layout:

```
+--- system prompt ---------------+   ~5K tokens
+--- scratchpad section -----------+   ~1K
+--- tool schemas ----------------+   ~3K
+--- transcript (messages array) -+   grows monotonically
|   user goal                     |
|   asst turn 1 (text + tool_use) |
|   user turn 1 (tool_results)    |
|   asst turn 2                   |
|   ...                           |
|   asst turn N                   |
+--- next assistant turn (output) +   model's slot to fill
```

For a typical 200K-context model running an agent, a healthy budget split looks like:

```
+ system prompt        ~5K tokens
+ tool schemas         ~3K
+ scratchpad           ~1K
+ stable RAG context   ~5K   (if injected)
+ transcript           ~80K  (room to grow during the run)
+ retrieved chunks     ~50K  (one big retrieval result)
+ headroom for output  ~30K
                       -----
                       ~174K of 200K used; 26K headroom
```

Two design rules emerge from this picture:

- **Pin the stable parts to the front.** System + tool schemas + scratchpad are stable across iterations and stable across very long runs. They're the perfect prefix for caching ([Chapter 2 §8](../llm-apis-and-prompts/cost-and-latency)).
- **The transcript is what grows.** Every memory-management technique above is about controlling the transcript's growth — by summarizing it, by pushing parts of it into sub-agents, or by spilling parts of it to external storage.

## Forward link: prefix caching is huge for agents

Agents have the perfect shape for prompt caching: a long, stable prefix (system + tools + early transcript) that's reprocessed on every iteration. With prefix caching turned on, the inference engine recognizes the shared prefix from the previous iteration and skips re-attending to it — only the new tail (the latest tool result) is full-cost.

For a 15-iteration agent run with an 80K-token transcript at the end, the un-cached cost is dominated by re-prefilling that 80K every turn. With caching, the marginal cost per iteration is roughly the new tool_result + the new model output — orders of magnitude cheaper.

[Chapter 9](../kv-cache) covers the KV cache mechanics that make this possible. The takeaway here: **agent runs are where prefix caching ROI is biggest.** Bigger than RAG, bigger than long-context Q&A. If you skip caching on agents, you are paying for every long-prefix prefill yourself.

Next: [Safety & Budgets →](./safety-budgets)
