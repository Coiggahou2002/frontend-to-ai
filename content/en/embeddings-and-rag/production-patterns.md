# 8. Production Patterns

A working notebook is not a working product. Eight patterns separate the two.

## 1. Always return citations

Every RAG response should come back as `(answer, source_chunk_ids)`, not just `answer`. Use schema-constrained output ([Chapter 2 §5](../llm-apis-and-prompts/structured-output)):

```python
class GroundedAnswer(BaseModel):
    answer: str
    sources: list[str]                # chunk IDs the answer relied on
    confidence: float                 # 0..1
```

Citations buy you three things:

- **Auditability.** When the model is wrong, you can read the chunks it actually saw and tell whether the failure was retrieval or generation.
- **A UI primitive.** Every serious RAG product (Perplexity, Notion AI, Cursor) has a "Sources" affordance. Without citation IDs, you can't build it.
- **An eval signal.** Citation correctness — does `sources` point at the chunks that contain the answer's claims? — is a cheap, high-signal generation metric ([§7](./evaluating-rag)).

If you don't return citations, you don't have a RAG system. You have an LLM with a prompt prefix.

## 2. Handle "no result" explicitly

When retrieval comes back with junk (low scores, off-topic, or the corpus genuinely doesn't contain the answer), the model's default behavior is to **try to answer anyway** — that's hallucination ([Chapter 2 §9](../llm-apis-and-prompts/failure-modes)). You have to instruct it not to, then verify.

System prompt pattern:

```text
Answer ONLY using the provided context. If the context does not contain the
answer, respond exactly: "I don't know based on the provided context."
Do NOT use prior knowledge.
```

Plus a code-side guardrail before you even call the model: if the top-k similarity scores are all below a threshold (e.g., cosine similarity < 0.3), short-circuit and return the "I don't know" answer without making the LLM call. You save tokens and you avoid tempting the model with bad context.

```python
def answer_with_threshold(query: str, min_sim: float = 0.3) -> dict:
    chunks = retrieve(query)
    best = 1 - chunks[0]["distance"]   # cosine similarity
    if best < min_sim:
        return {"answer": "I don't know based on the provided context.",
                "sources": []}
    # ... normal LLM call
```

The threshold is a hyperparameter — tune it on the adversarial slice of your golden set ([§7](./evaluating-rag)).

## 3. Freshness and incremental updates

Real corpora change. Documents get added, edited, deleted. Two strategies:

- **Incremental upserts.** When a document changes, re-chunk it, re-embed the chunks, upsert by stable ID. For deletions, soft-delete with a `tombstone` flag in metadata and filter at query time (cheaper than physical deletion in HNSW indexes).
- **Periodic rebuild.** Once a week, re-build the whole index from scratch. Catches schema drift, embedding-model upgrades, and chunking-strategy changes. Required when you switch embedding models — you cannot mix vectors from different models in the same index.

The trade-off:

| | Incremental | Rebuild |
|---|---|---|
| Cost | Low (only changed docs) | High (whole corpus) |
| Latency | Real-time | Hours |
| Embedding model migration | Can't | Yes |
| Operational complexity | High (tombstones, dedup) | Low |

Most production teams do **both** — incremental updates for the steady state, periodic rebuilds for migrations and drift correction.

Use stable, deterministic chunk IDs (e.g., `f"{doc_id}-{section_path}-{chunk_index}"`). It makes upserts idempotent and migrations far easier to reason about.

## 4. Prompt caching for the stable prefix

RAG requests have a structural pattern: the system prompt and tool schemas are **stable**, the chunks and user query are **dynamic**. Mark the stable portion as cacheable ([Chapter 2 §8](../llm-apis-and-prompts/cost-and-latency)) and you typically cut input cost by 50–80% on the steady-state traffic.

```python
resp = llm.messages.create(
    model="claude-sonnet-4-6",
    system=[
        {"type": "text", "text": SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral"}},
    ],
    tools=[answer_tool],   # tool schemas are also cached implicitly when stable
    messages=[{"role": "user", "content": user_msg}],
)
```

The KV cache mechanics that make this possible are covered in **Chapter 7**. The point here: design your prompts so the stable prefix is *actually stable*. If you concatenate timestamps, request IDs, or chunk text into the system prompt, you've broken caching for nothing.

## 5. Knobs you'll actually tune — in order of impact

When recall or faithfulness regresses, fix knobs in this order. Higher-impact knobs first.

| # | Knob | Typical impact | Cost to change |
|---|---|---|---|
| 1 | Chunk size & overlap | Large | Re-index |
| 2 | Embedding model | Medium-large | Re-index entirely |
| 3 | Top-k | Medium (too low misses, too high adds noise) | Free |
| 4 | Hybrid search + rerank ([§6](./reranking-and-hybrid)) | Medium-large for the failure modes it addresses | Code + latency |
| 5 | Vector DB | Tiny — only matters at scale or for filters | Re-platform |

Note what's not on the list: temperature (keep it 0–0.2 for grounding), prompt-engineering tweaks beyond the basic grounding instruction (small returns), or switching to a more expensive LLM (often the cheapest knob to tune but rarely the bottleneck).

## 6. Anti-patterns

- **"Just embed everything and pray."** Chunking is the highest-impact knob ([§4](./chunking)). You can't fix a bad chunking strategy with a better embedding model.
- **"Pure vector search, no BM25."** Exact matches will fail — codes, SKUs, error strings ([§6](./reranking-and-hybrid)).
- **"No eval set."** You can't tell if changes regress. Build the golden set on day three, not month six ([§7](./evaluating-rag)).
- **"Stuff 50 chunks into context."** Top-5 reranked beats top-50 raw, almost always. Long context dilutes attention and burns tokens.
- **"Embed at query time, every time, without caching."** Your bill explodes. Cache query embeddings (LRU on the query string) and definitely cache document embeddings persistently.
- **"Re-embed the corpus every deploy."** It's expensive and almost never necessary. Embeddings only need to be regenerated when the model changes.
- **"Trust the similarity score as confidence."** Cosine similarity is a *ranking* signal, not a calibrated confidence. Use it for ordering and threshold-based no-result detection, not for "the model is X% sure."

## 7. The bridge to Chapter 4: from passive to active retrieval

Look at the pipeline you've built across this chapter. *Your code* decides when to retrieve. *Your code* embeds the query. *Your code* fetches chunks. *Your code* formats the prompt. The model only consumes what you provide. This is **passive retrieval** — the application is in charge.

In **Chapter 4**, you flip this. Retrieval becomes a tool the **model** can choose to invoke ([Chapter 2 §6](../llm-apis-and-prompts/tool-use)):

```python
tools = [
    {
        "name": "search_kb",
        "description": "Search the knowledge base for chunks relevant to a query.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "k": {"type": "integer"}},
            "required": ["query"],
        },
    },
    # ... other tools the agent can call ...
]
```

The model decides:
- **Whether** to retrieve at all (some questions don't need it).
- **What** to retrieve (it can rephrase, decompose, multi-query).
- **When to stop** retrieving and answer.

Same vector DB, same chunks, same embedding model — but the orchestration moves from your code into the model's decision loop. That's an **agent** doing RAG, sometimes called **agentic retrieval** or **tool-style RAG**.

Everything in Chapter 3 still applies. The pipeline doesn't go away; it just gets called from a different driver. In Chapter 4 you'll build that driver.

## Further Reading

- Lewis et al., [*Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*](https://arxiv.org/abs/2005.11401) — the original 2020 paper. Short, readable, the architecture has barely changed.
- Anthropic, [*Prompt caching*](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — the operational guide referenced from §4 and from [Chapter 2 §8](../llm-apis-and-prompts/cost-and-latency).
- Malkov & Yashunin, [*Efficient and robust approximate nearest neighbor search using HNSW*](https://arxiv.org/abs/1603.09320) — the HNSW paper. Read the figures even if you skip the math.
- [*ragas docs*](https://docs.ragas.io/) — the canonical RAG evaluation library; the LLM-judge prompts inside are worth reading on their own.
- [*Pinecone: hybrid search*](https://www.pinecone.io/learn/hybrid-search-intro/) — clean writeup of why pure vector search fails and how hybrid fixes it.
- Liu et al., [*Lost in the Middle*](https://arxiv.org/abs/2307.03172) — referenced from [Chapter 0 §5](../how-llms-work/context-window); explains why "stuff more chunks in" is a worse strategy than careful retrieval + rerank.
