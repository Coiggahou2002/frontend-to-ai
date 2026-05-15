# 4. Transaction Isolation

You're running a RAG ingestion pipeline that upserts 10,000 document chunks. At the same time, a user is querying the same collection. What does the user see — the old data, the new data, or some half-ingested mix?

The answer depends on the **transaction isolation level**. This section covers what you need to know to pick the right one.

## The problem: concurrent access

A database serves many clients at once. Without isolation, two transactions can interfere:

```mermaid
sequenceDiagram
    participant Ingestion as Ingestion Pipeline
    participant DB as PostgreSQL
    participant Query as User Query
    Ingestion->>DB: BEGIN; INSERT chunk 1..5000
    Query->>DB: SELECT * FROM documents WHERE ...
    Note over DB: What does the query see?
    Ingestion->>DB: INSERT chunk 5001..10000; COMMIT
```

**Dirty read**: the query sees chunks 1–5000 before the ingestion commits. If the ingestion rolls back, the user saw data that never existed.

**Non-repeatable read**: the query runs twice in the same transaction and gets different results because the ingestion committed between the two reads.

**Phantom read**: the query's `WHERE` clause matches different rows on re-execution because new rows appeared.

## The four isolation levels

PostgreSQL supports three of the four SQL-standard levels (it treats Read Uncommitted as Read Committed):

| Level | Dirty reads | Non-repeatable reads | Phantom reads | Postgres default? |
|-------|:-----------:|:--------------------:|:-------------:|:-----------------:|
| Read Uncommitted | Possible* | Possible | Possible | — |
| **Read Committed** | No | Possible | Possible | **Yes** |
| Repeatable Read | No | No | No** | — |
| Serializable | No | No | No | — |

\* Postgres actually prevents dirty reads even at Read Uncommitted — it silently upgrades to Read Committed.
\** Postgres's Repeatable Read also prevents phantom reads, unlike the SQL standard minimum.

## Read Committed — the default you'll usually keep

Each SQL statement within a transaction sees only data that was committed *before that statement started*. Different statements in the same transaction can see different snapshots.

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

**When it's enough**: most AI application CRUD — saving messages, reading conversation history, updating user settings. The brief window where a concurrent write is invisible is fine for chat apps.

## Repeatable Read — for consistent snapshots

The entire transaction sees a snapshot from when it *started*. No matter what other transactions commit during your work, you see the same data throughout.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ;

-- Statement 1
SELECT COUNT(*) FROM documents;  -- returns 5000

-- Meanwhile, ingestion commits 5000 more documents

-- Statement 2 (same transaction)
SELECT COUNT(*) FROM documents;  -- still returns 5000 (snapshot frozen)

COMMIT;
```

**When to use it**:
- RAG evaluation pipelines that need a consistent view of the corpus while computing metrics.
- Reports or analytics queries that scan large tables — you don't want the numbers shifting mid-query.
- Any multi-step read where seeing a half-updated state would produce wrong results.

**Trade-off**: if two Repeatable Read transactions try to update the same row, one will get a serialization error and must retry. Your code needs a retry loop.

## Serializable — when correctness is non-negotiable

Transactions behave *as if* they ran one at a time, in some serial order. Postgres detects conflicts and aborts one of the transactions.

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- Check if user has remaining quota
SELECT remaining_tokens FROM quotas WHERE tenant_id = '...';  -- returns 1000

-- Deduct
UPDATE quotas SET remaining_tokens = remaining_tokens - 500 WHERE tenant_id = '...';

COMMIT;
-- If another transaction touched the same quota row, one of us gets an error
```

**When to use it**:
- Token budget enforcement where overspend is unacceptable.
- Financial-like operations (credit/debit that must balance).

**Trade-off**: higher conflict rate, more retries, lower throughput. Only use it for operations where incorrectness is worse than slowness.

## Practical guidance for AI apps

| Operation | Recommended level | Why |
|-----------|-------------------|-----|
| Save/load messages | Read Committed | Default is fine; brief invisibility of concurrent writes doesn't matter |
| RAG ingestion | Read Committed | Readers see chunks as they're committed; partial visibility is OK |
| Evaluation pipeline reads | Repeatable Read | Need a frozen snapshot to compute consistent metrics |
| Token quota enforcement | Serializable | Can't allow two concurrent requests to both pass a budget check |
| Analytics dashboards | Repeatable Read | Multi-query reports need consistent numbers |

**The practical rule**: start with Read Committed (the default). Only escalate when you can name the specific anomaly that would break your application.

## MVCC — why reads never block writes

PostgreSQL uses **Multi-Version Concurrency Control**. Instead of locking rows during reads, it keeps old versions of rows around so readers can see a consistent snapshot while writers modify the current version.

This means:
- `SELECT` never blocks `INSERT`/`UPDATE`/`DELETE`.
- `INSERT`/`UPDATE`/`DELETE` never blocks `SELECT`.
- Only write-write conflicts cause blocking or serialization errors.

This is why Postgres handles mixed read/write workloads (like an AI app serving queries while ingesting documents) without grinding to a halt. You don't need to think about read locks.

Next: [ORM: SQLAlchemy →](./orm-sqlalchemy)
