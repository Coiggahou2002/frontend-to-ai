# 3. Vector Search & ANN

You have N embeddings. The user asks a question, you embed it, and you need to find the K closest vectors. The naive way works fine until it doesn't.

## The brute-force baseline

```python
import numpy as np

def brute_force_topk(query: np.ndarray, corpus: np.ndarray, k: int) -> list[int]:
    # Both pre-normalized -> dot product == cosine.
    scores = corpus @ query           # shape: (N,)
    return np.argsort(-scores)[:k].tolist()
```

This is `O(N · d)` per query. With 10K vectors at 1024 dims, that's 10M multiply-adds — sub-millisecond on any modern CPU. **Don't reach for a vector DB until you actually need one.** A `numpy` array in process memory is the right answer for prototypes, evals, and small production corpora (<10K–100K vectors).

But at 10M vectors and 1024 dims, brute force is 10B ops per query — hundreds of milliseconds, single-threaded. Latency is now your problem.

## Approximate Nearest Neighbor (ANN) — the HNSW intuition

Vector databases solve this with **Approximate Nearest Neighbor** indexes — data structures that trade a tiny amount of recall for huge speedups. The dominant algorithm in 2026 is **HNSW** (Hierarchical Navigable Small World).

Intuition: HNSW is a **skip-list of graphs**. The bottom layer connects every vector to its neighbors. Higher layers contain progressively fewer vectors with longer-range edges. A query enters at the top, greedily hops toward closer neighbors, drops down a layer, hops some more, and so on until it can't improve. Search is `O(log N)` instead of `O(N)`.

![HNSW layered graph structure and search path](/frontend-to-ai/images/hnsw-structure.png)

You don't need to derive HNSW. You only need to know:

- It's a graph index. Build is amortized over inserts (slower than brute-force append).
- The recall/latency knob is `ef_search` (Qdrant: `hnsw_ef`; pgvector: `hnsw.ef_search`). Higher = explores more candidates = higher recall but slower.
- The other graph-quality knob is `M` at build time (edges per node). Default 16 is fine.

Two other algorithms you'll see:

- **IVF (inverted file index)** — partitions vectors into clusters; query searches `nprobe` nearest clusters. Better for very large corpora when memory is tight.
- **ScaNN** (Google) — IVF + product quantization, optimized for billion-scale.

For 95% of teams, HNSW (often combined with quantization) is the right default.

## Recall vs. latency

Every ANN index has a knob:

| Knob | What it controls | Higher means |
|---|---|---|
| HNSW `ef_search` | candidates inspected per query | recall ↑, latency ↑ |
| HNSW `M` (build) | edges per node | recall ↑, index size ↑, build time ↑ |
| IVF `nprobe` | clusters searched | recall ↑, latency ↑ |
| Quantization (PQ/SQ) | compression aggressiveness | storage ↓, recall ↓ slightly |

When you bring up a new index, sweep `ef_search` from 32 to 256 against your eval set ([§7](./evaluating-rag)) and pick the lowest value that hits your recall target.

## Choosing a vector DB in 2026

You really only need to choose between three:

| DB | Pick when |
|---|---|
| **pgvector** (Postgres extension) | You already run Postgres and your scale is <10M vectors. One DB, no new infra, transactional with your other data. Default for most products. |
| **Qdrant** (self-hosted, Rust) | You need filtered search at high QPS (e.g., "search this user's documents only"), or want full ops control. Best filter performance and good defaults. |
| **Pinecone** (hosted) | You don't want to operate anything and you're willing to pay. Predictable hosted pricing, decent filter and metadata story, no servers to manage. |

Brief mentions: **Weaviate** (full-featured, with built-in hybrid; heavier ops), **Milvus** (huge-scale, complex), **Chroma** (great for prototyping — embedded, zero-config; reach for it on day one and graduate later). Lots of teams stay on Chroma in production for small corpora.

The choice rarely matters for your retrieval *quality*. It matters for your ops, your filter requirements, and your scale. Optimize quality with chunking, embeddings, and reranking — not by switching vector DBs.

## A working in-memory example with Chroma

The fastest way to feel this end-to-end. `chromadb` runs in-process, no server needed.

```python
import chromadb
from chromadb.utils import embedding_functions

client = chromadb.Client()
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="BAAI/bge-small-en-v1.5"
)

collection = client.create_collection(
    name="kb",
    embedding_function=embed_fn,
    metadata={"hnsw:space": "cosine"},
)

collection.add(
    documents=[
        "The Postgres MVCC mechanism uses transaction IDs to provide snapshot isolation.",
        "Cats are obligate carnivores and require taurine in their diet.",
        "HNSW builds a multi-layer graph for sub-linear nearest-neighbor search.",
    ],
    ids=["doc1", "doc2", "doc3"],
)

results = collection.query(
    query_texts=["how does ANN search work?"],
    n_results=2,
)
print(results["ids"])        # -> [['doc3', 'doc1']]
print(results["distances"])  # -> [[0.21, 0.78]]   (smaller = closer)
```

Add → query → results. The vector DB hides the embedding call, the index, and the math. You'll spend the rest of the chapter learning when its defaults aren't enough.

A note on the `distances` field: most DBs return *distance*, not similarity. For cosine, `distance = 1 - similarity`, so smaller is closer. Read your DB's docs once and never assume.

Next: [Chunking →](./chunking)
