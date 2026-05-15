# 2. SQL Refresher

You learned SQL in school. Then you spent years writing `prisma.user.findMany()` and forgot most of it. This section is the jolt — the 20% of SQL that covers 95% of what you'll write in an AI application backend.

## Tables and types

```sql
CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    title       TEXT,
    model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT,
    tool_calls      JSONB,
    token_count     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

Types you'll use constantly:

| Postgres type | What it's for | JS/TS equivalent |
|---------------|---------------|-------------------|
| `UUID` | Primary keys, foreign keys | `string` (crypto.randomUUID()) |
| `TEXT` | Any string, no length limit | `string` |
| `INTEGER` / `BIGINT` | Counts, token numbers | `number` |
| `BOOLEAN` | Flags | `boolean` |
| `TIMESTAMPTZ` | All timestamps (always use TZ) | `Date` |
| `JSONB` | Semi-structured data | `object` / `Record<string, unknown>` |
| `vector(N)` | Embeddings (pgvector) | `number[]` |

**Always use `TIMESTAMPTZ`, not `TIMESTAMP`.** The version without timezone silently drops timezone info and will cause bugs in any multi-region deployment.

## CRUD

The four operations, side by side with what you already know:

**Create:**

```sql
INSERT INTO conversations (tenant_id, title, model)
VALUES ('a1b2c3d4-...', 'Debug my RAG pipeline', 'claude-sonnet-4-6')
RETURNING *;
```

```typescript
// Prisma equivalent
await prisma.conversation.create({
  data: { tenantId: 'a1b2c3d4-...', title: 'Debug my RAG pipeline', model: 'claude-sonnet-4-6' }
})
```

**Read:**

```sql
SELECT id, title, created_at
FROM conversations
WHERE tenant_id = 'a1b2c3d4-...'
ORDER BY created_at DESC
LIMIT 20;
```

```typescript
// Prisma equivalent
await prisma.conversation.findMany({
  where: { tenantId: 'a1b2c3d4-...' },
  select: { id: true, title: true, createdAt: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
})
```

**Update:**

```sql
UPDATE conversations
SET title = 'Fixed RAG pipeline', updated_at = now()
WHERE id = '...'
RETURNING *;
```

**Delete:**

```sql
DELETE FROM messages WHERE conversation_id = '...';
DELETE FROM conversations WHERE id = '...';
```

Or, if you used `ON DELETE CASCADE` on the foreign key (like above), deleting the conversation automatically deletes its messages.

## JOINs

Two JOINs cover nearly everything:

**INNER JOIN** — only rows that match on both sides:

```sql
SELECT c.title, m.role, m.content
FROM conversations c
INNER JOIN messages m ON m.conversation_id = c.id
WHERE c.tenant_id = 'a1b2c3d4-...'
ORDER BY m.created_at;
```

**LEFT JOIN** — all rows from the left table, even if no match on the right:

```sql
SELECT c.id, c.title, COUNT(m.id) AS message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.tenant_id = 'a1b2c3d4-...'
GROUP BY c.id, c.title;
```

This returns conversations with zero messages too — `message_count` will be 0. An INNER JOIN would silently drop those rows.

## Indexes

Without an index, Postgres scans every row (a "sequential scan"). With millions of rows, that's seconds instead of milliseconds.

```sql
-- The queries you'll run most often determine which indexes to create
CREATE INDEX idx_conversations_tenant ON conversations (tenant_id);
CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_created ON messages (created_at);
```

**Rule of thumb**: index every column that appears in a `WHERE` or `JOIN ON` clause and is queried frequently. Don't index everything — each index slows down writes.

## EXPLAIN — reading the query plan

When a query is slow, `EXPLAIN ANALYZE` tells you why:

```sql
EXPLAIN ANALYZE
SELECT * FROM messages
WHERE conversation_id = 'abc-123'
ORDER BY created_at;
```

```
Index Scan using idx_messages_conversation on messages  (cost=0.42..8.44 rows=5 width=312) (actual time=0.028..0.035 rows=5 loops=1)
  Index Cond: (conversation_id = 'abc-123'::uuid)
Planning Time: 0.152 ms
Execution Time: 0.061 ms
```

What to look for:
- **Index Scan** or **Index Only Scan** — good, using an index.
- **Seq Scan** on a large table — bad, scanning every row. Add an index.
- **actual time** — the real wall-clock time. Compare this to your latency budget.

You don't need to memorize query plan syntax. You need to know that `EXPLAIN ANALYZE` exists and that "Seq Scan on a table with millions of rows" means "add an index."

## Aggregations you'll actually use

```sql
-- Total tokens used per conversation
SELECT conversation_id, SUM(token_count) AS total_tokens
FROM messages
GROUP BY conversation_id
HAVING SUM(token_count) > 10000;

-- Daily active conversations per tenant
SELECT tenant_id, DATE(created_at) AS day, COUNT(DISTINCT conversation_id) AS active_convs
FROM messages
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY tenant_id, DATE(created_at)
ORDER BY day DESC;
```

These are the queries you'll write for dashboards, cost tracking, and usage analytics. All of them are `GROUP BY` + an aggregate function (`COUNT`, `SUM`, `AVG`).

Next: [Schemas & Migrations →](./schemas-and-migrations)
