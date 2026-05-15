# 4. 事务隔离

你正在跑一个 RAG 数据导入流水线，往数据库 upsert 10,000 条文档分块。与此同时，一个用户正在查询同一张表。用户看到的是旧数据、新数据，还是一半新一半旧的混合态？

答案取决于**事务隔离级别**。这一节帮你搞清楚如何选择正确的级别。

## 问题：并发访问

数据库同时服务多个客户端。没有隔离机制的话，两个事务会互相干扰：

```mermaid
sequenceDiagram
    participant Ingestion as 数据导入流水线
    participant DB as PostgreSQL
    participant Query as 用户查询
    Ingestion->>DB: BEGIN; INSERT chunk 1..5000
    Query->>DB: SELECT * FROM documents WHERE ...
    Note over DB: 查询会看到什么？
    Ingestion->>DB: INSERT chunk 5001..10000; COMMIT
```

**脏读（Dirty read）**：查询看到了 chunk 1–5000，但此时导入事务还没提交。如果导入事务最终回滚了，用户看到的数据根本就不曾存在过。

**不可重复读（Non-repeatable read）**：同一个事务里执行两次相同查询，却得到了不同的结果——因为导入事务在两次读之间提交了。

**幻读（Phantom read）**：同一个 `WHERE` 条件重新执行时匹配到了不同的行，因为有新行被插入了。

## 四个隔离级别

PostgreSQL 支持 SQL 标准四个级别中的三个（它会把 Read Uncommitted 静默升级为 Read Committed）：

| 级别 | 脏读 | 不可重复读 | 幻读 | Postgres 默认？ |
|------|:----:|:----------:|:----:|:---------------:|
| Read Uncommitted | 可能* | 可能 | 可能 | — |
| **Read Committed** | 否 | 可能 | 可能 | **是** |
| Repeatable Read | 否 | 否 | 否** | — |
| Serializable | 否 | 否 | 否 | — |

\* Postgres 即使在 Read Uncommitted 级别也不会出现脏读——它会静默升级为 Read Committed。
\** Postgres 的 Repeatable Read 同样能防止幻读，这比 SQL 标准的最低要求更严格。

## Read Committed —— 你通常会用的默认级别

在一个事务中，每条 SQL 语句只能看到**该语句开始执行前**已提交的数据。同一事务中的不同语句可能看到不同的快照。

```sql
-- Transaction A (ingestion)
BEGIN;
INSERT INTO documents (content, embedding) VALUES ('chunk 1', '[0.1, ...]');
-- not committed yet

-- Transaction B (user query, running concurrently)
SELECT * FROM documents;
-- Does NOT see chunk 1 — it's uncommitted
-- This is Read Committed preventing dirty reads

-- Transaction A
COMMIT;

-- Transaction B (same transaction, new statement)
SELECT * FROM documents;
-- NOW sees chunk 1 — it was committed before this statement started
```

**什么时候够用**：大多数 AI 应用的 CRUD 操作——保存消息、读取对话记录、更新用户设置。并发写入短暂不可见这件事，对聊天应用来说完全没问题。

## Repeatable Read —— 需要一致性快照时使用

整个事务看到的是**事务开始时**的快照。不管其他事务在你执行过程中提交了什么，你始终看到相同的数据。

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

-- Statement 1
SELECT COUNT(*) FROM documents;  -- returns 5000

-- Meanwhile, ingestion commits 5000 more documents

-- Statement 2 (same transaction)
SELECT COUNT(*) FROM documents;  -- still returns 5000 (snapshot frozen)

COMMIT;
```

**什么时候用**：
- RAG 评估流水线需要在计算指标时看到一致的语料库视图。
- 报表或分析查询扫描大表——你不希望查到一半时数字突然变了。
- 任何多步读取操作，如果看到半更新状态会产生错误结果。

**代价**：如果两个 Repeatable Read 事务试图更新同一行，其中一个会收到序列化错误并需要重试。你的代码里需要加重试逻辑。

## Serializable —— 正确性不容妥协时使用

事务的行为*就像*按某个串行顺序逐一执行。Postgres 会检测冲突并中止其中一个事务。

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- Check if user has remaining quota
SELECT remaining_tokens FROM quotas WHERE tenant_id = '...';  -- returns 1000

-- Deduct
UPDATE quotas SET remaining_tokens = remaining_tokens - 500 WHERE tenant_id = '...';

COMMIT;
-- If another transaction touched the same quota row, one of us gets an error
```

**什么时候用**：
- Token 额度管控，超额不可接受的场景。
- 类金融操作（借贷必须平衡）。

**代价**：冲突率更高、重试更多、吞吐量更低。只在"出错比变慢更不可接受"的操作上使用。

## AI 应用的实用指南

| 操作 | 推荐级别 | 原因 |
|------|---------|------|
| 保存/加载消息 | Read Committed | 默认即可；并发写入短暂不可见不影响业务 |
| RAG 数据导入 | Read Committed | 读者能看到已提交的分块；部分可见没问题 |
| 评估流水线读取 | Repeatable Read | 需要冻结快照来计算一致的指标 |
| Token 额度管控 | Serializable | 不能让两个并发请求同时通过预算检查 |
| 分析看板 | Repeatable Read | 多条查询组成的报表需要一致的数字 |

**实用原则**：从 Read Committed（默认级别）开始。只有当你能明确说出"哪种异常会破坏我的应用"时，才升级隔离级别。

## MVCC —— 为什么读操作永远不会阻塞写操作

PostgreSQL 使用 **MVCC（多版本并发控制）**。它不会在读取时锁定行，而是保留行的旧版本，让读者看到一致的快照，同时写者修改当前版本。

这意味着：
- `SELECT` 永远不会阻塞 `INSERT`/`UPDATE`/`DELETE`。
- `INSERT`/`UPDATE`/`DELETE` 永远不会阻塞 `SELECT`。
- 只有写-写冲突才会导致阻塞或序列化错误。

这就是为什么 Postgres 能同时处理混合读写负载（比如 AI 应用一边响应查询一边导入文档）而不会卡死。你不需要操心读锁的事。

下一节：[ORM：SQLAlchemy →](./orm-sqlalchemy)
