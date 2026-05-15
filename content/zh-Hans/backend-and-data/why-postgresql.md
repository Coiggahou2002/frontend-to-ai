# 1. 为什么选 PostgreSQL

你需要一个数据库，问题是选哪个。

对于 2026 年的 AI 应用，默认答案是 **PostgreSQL**。不是因为它是唯一选择，而是因为它帮你省掉了最多的决策：

| 需求 | Postgres 怎么满足 |
|------|------------------|
| 对话历史 | 关系表 + JSONB 存储灵活的消息元数据 |
| 向量搜索 | `pgvector` 扩展 —— HNSW 索引，支持 cosine/L2/内积距离 |
| 工具调用审计日志 | JSONB 列存储任意工具输入/输出，无需改表结构 |
| 多租户隔离 | Row-Level Security (RLS) 在数据库层面强制租户边界 |
| 全文搜索 | 内置 `tsvector` + `tsquery` —— 用于混合检索完全够用 |
| 事务写入 | 默认 ACID；不会有最终一致性的意外 |

一个数据库。一个连接字符串。一套备份策略。一组需要审计的权限。

## pgvector 的价值

在[第三章](../embeddings-and-rag/vector-search)中你了解了向量数据库。一个不太会被说出来的事实是：大多数向量规模在 500 万以下的团队根本不需要专用向量数据库。`pgvector` 扩展直接在 Postgres 内部添加了 `vector` 列类型和 HNSW 索引。

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

Embedding 和关系数据住在一起。一条查询就能按 `tenant_id` 过滤、按向量距离排序、再 JOIN `users` 表——不需要跨服务编排。

## JSONB 的优势

LLM 工具调用、函数输出、消息元数据都是半结构化的。你不想每加一个新工具就 ALTER TABLE。JSONB 在关系模型里给了你文档数据库的灵活性：

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

当查询模式明确后，你可以用 GIN 索引来加速 JSONB 字段的查询。在那之前，这种灵活性是零成本的。

## Postgres 不适合的场景

也要对它的边界坦诚：

- **5000 万以上向量 + 高 QPS + 复杂过滤** —— pgvector 能跑，但专用向量数据库（Qdrant、Pinecone）的尾部延迟更好。参见[第 7 节](./pgvector-graduation)。
- **实时事件流** —— 如果你需要亚毫秒级 pub/sub 或每秒百万级写入，看 Redis 或 Kafka。但它们是 Postgres 的*补充*，不是替代。
- **重度图查询** —— 如果核心访问模式是"遍历六层关系"，图数据库可能值得增加的运维成本。不过这在 AI 应用中很少见。

除此之外——而"除此之外"覆盖了 AI 应用后端 90% 的场景——Postgres 就是正确的默认选择。

## 各大云平台都有

- **AWS**：RDS for PostgreSQL、Aurora PostgreSQL
- **GCP**：Cloud SQL for PostgreSQL、AlloyDB
- **Azure**：Azure Database for PostgreSQL
- **Serverless/边缘**：Neon、Supabase、CockroachDB（Postgres 兼容）

你永远不会找不到一个托管的 Postgres 实例。你积累的运维知识在任何平台都通用。

下一节：[SQL 速览 →](./sql-refresher)
