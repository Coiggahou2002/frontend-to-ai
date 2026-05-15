# 2. SQL 快速回顾

你在学校里学过 SQL，然后花了好几年写 `prisma.user.findMany()`，大部分都忘光了。这一节是一剂强心针——覆盖 AI 应用后端中 95% 场景的那 20% SQL。

## 表和类型

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

你会频繁用到的类型：

| Postgres 类型 | 用途 | JS/TS 对应类型 |
|---------------|------|----------------|
| `UUID` | 主键、外键 | `string` (crypto.randomUUID()) |
| `TEXT` | 任意字符串，无长度限制 | `string` |
| `INTEGER` / `BIGINT` | 计数、token 数量 | `number` |
| `BOOLEAN` | 标志位 | `boolean` |
| `TIMESTAMPTZ` | 所有时间戳（始终带时区） | `Date` |
| `JSONB` | 半结构化数据 | `object` / `Record<string, unknown>` |
| `vector(N)` | Embedding 向量（pgvector） | `number[]` |

**始终使用 `TIMESTAMPTZ`，而不是 `TIMESTAMP`。** 不带时区的版本会默默丢弃时区信息，在任何多地域部署中都会引发 bug。

## CRUD

四种操作，和你已经熟悉的写法对照着看：

**Create（创建）：**

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

**Read（查询）：**

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

**Update（更新）：**

```sql
UPDATE conversations
SET title = 'Fixed RAG pipeline', updated_at = now()
WHERE id = '...'
RETURNING *;
```

**Delete（删除）：**

```sql
DELETE FROM messages WHERE conversation_id = '...';
DELETE FROM conversations WHERE id = '...';
```

如果你在外键上设置了 `ON DELETE CASCADE`（如上面的建表语句），删除 conversation 时会自动删除它的所有 messages。

## JOIN

两种 JOIN 几乎覆盖所有场景：

**INNER JOIN** —— 只返回两张表都匹配的行：

```sql
SELECT c.title, m.role, m.content
FROM conversations c
INNER JOIN messages m ON m.conversation_id = c.id
WHERE c.tenant_id = 'a1b2c3d4-...'
ORDER BY m.created_at;
```

**LEFT JOIN** —— 返回左表的所有行，即使右表没有匹配：

```sql
SELECT c.id, c.title, COUNT(m.id) AS message_count
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.tenant_id = 'a1b2c3d4-...'
GROUP BY c.id, c.title;
```

这会把没有 messages 的 conversation 也返回——`message_count` 为 0。换成 INNER JOIN 的话，这些行会被悄悄丢掉。

## 索引

没有索引时，Postgres 会扫描每一行（"顺序扫描"）。当表有几百万行时，查询时间从毫秒级变成秒级。

```sql
-- The queries you'll run most often determine which indexes to create
CREATE INDEX idx_conversations_tenant ON conversations (tenant_id);
CREATE INDEX idx_messages_conversation ON messages (conversation_id);
CREATE INDEX idx_messages_created ON messages (created_at);
```

**经验法则**：给每个频繁出现在 `WHERE` 或 `JOIN ON` 子句中的列建索引。不要给所有列都建——每个索引都会拖慢写入。

## EXPLAIN —— 阅读查询计划

当查询变慢时，`EXPLAIN ANALYZE` 告诉你原因：

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

看什么：
- **Index Scan** 或 **Index Only Scan** —— 好的，用到了索引。
- **Seq Scan** 出现在大表上 —— 不好，在逐行扫描。加个索引。
- **actual time** —— 真实的墙钟时间。拿它和你的延迟预算做对比。

你不需要记住查询计划的完整语法。你需要知道的是：`EXPLAIN ANALYZE` 这个东西存在，以及"在百万级行数的表上看到 Seq Scan"意味着"该加索引了"。

## 你真正会用到的聚合查询

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

这些就是你在做仪表盘、成本追踪和用量分析时会写的查询。它们的套路都是 `GROUP BY` + 聚合函数（`COUNT`、`SUM`、`AVG`）。

下一节：[Schema 与 Migration →](./schemas-and-migrations)
