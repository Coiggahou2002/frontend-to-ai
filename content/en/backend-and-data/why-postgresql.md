# 1. Why PostgreSQL

You need a database. The question is which one.

For AI applications in 2026, the default answer is **PostgreSQL**. Not because it's the only option, but because it eliminates the most decisions:

| Need | How Postgres covers it |
|------|----------------------|
| Conversation history | Relational tables with JSONB for flexible message metadata |
| Vector search | `pgvector` extension — HNSW indexes, cosine/L2/inner-product distance |
| Tool-call audit logs | JSONB columns store arbitrary tool input/output without schema changes |
| Multi-tenant isolation | Row-Level Security (RLS) enforces tenant boundaries at the DB level |
| Full-text search | Built-in `tsvector` + `tsquery` — good enough for hybrid retrieval |
| Transactional writes | ACID by default; no eventual-consistency surprises |

One database. One connection string. One backup strategy. One set of permissions to audit.

## The pgvector argument

In [Chapter 3](../embeddings-and-rag/vector-search) you learned about vector databases. The dirty secret: most teams under 5M vectors don't need a dedicated one. The `pgvector` extension adds a `vector` column type and HNSW indexing directly inside Postgres.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL,
    content    TEXT NOT NULL,
    embedding  vector(1536),  -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON documents
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

Your embeddings live next to your relational data. A single query can filter by `tenant_id`, sort by vector distance, and JOIN against a `users` table — no cross-service orchestration.

## The JSONB advantage

LLM tool calls, function outputs, and message metadata are semi-structured. You don't want to ALTER TABLE every time a new tool appears. JSONB gives you document-database flexibility inside a relational model:

```sql
CREATE TABLE messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    role           TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content        TEXT,
    tool_calls     JSONB,       -- arbitrary tool-call payloads
    metadata       JSONB,       -- tokens used, latency, model version
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- Query JSONB fields directly
SELECT * FROM messages
WHERE metadata->>'model' = 'claude-sonnet-4-6'
  AND (metadata->>'input_tokens')::int > 1000;
```

You can index JSONB paths with GIN indexes when query patterns emerge. Until then, the flexibility costs you nothing.

## When Postgres is not the answer

Be honest about the edges:

- **> 50M vectors at high QPS with complex filters** — pgvector works, but a dedicated vector DB (Qdrant, Pinecone) will give you better tail latency. See [§7](./pgvector-graduation).
- **Real-time event streams** — if you need sub-millisecond pub/sub or millions of writes per second, look at Redis or Kafka. But these are *complements* to Postgres, not replacements.
- **Graph-heavy queries** — if your core access pattern is "traverse six relationship hops," a graph database might be worth the ops cost. This is rare in AI apps.

For everything else — and "everything else" covers 90% of AI application backends — Postgres is the right default.

## Every cloud has it

- **AWS**: RDS for PostgreSQL, Aurora PostgreSQL
- **GCP**: Cloud SQL for PostgreSQL, AlloyDB
- **Azure**: Azure Database for PostgreSQL
- **Serverless/edge**: Neon, Supabase, CockroachDB (Postgres-compatible)

You will never be unable to find a managed Postgres instance. The operational knowledge transfers everywhere.

Next: [SQL Refresher →](./sql-refresher)
