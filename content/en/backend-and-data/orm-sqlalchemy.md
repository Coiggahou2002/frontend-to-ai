# 5. ORM: SQLAlchemy

You could write raw SQL for everything. In practice, you'll use an ORM for the same reason you use React instead of `document.createElement` — it handles the repetitive parts so you can focus on the logic.

In the Python AI ecosystem, that ORM is **SQLAlchemy**. If you've used Prisma, the concepts map directly.

## The three objects you need

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, DeclarativeBase

engine = create_engine("postgresql://user:pass@localhost/myapp")

class Base(DeclarativeBase):
    pass
```

| SQLAlchemy | Prisma equivalent | What it does |
|------------|-------------------|--------------|
| `engine` | `PrismaClient()` | Holds the connection pool, talks to the database |
| `Session` | Implicit in Prisma queries | A unit of work — groups queries into a transaction |
| `Base` | `schema.prisma` | Base class all your models inherit from |

## Defining models

```python
import uuid
from datetime import datetime
from sqlalchemy import ForeignKey, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID, nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text, default="claude-sonnet-4-6")
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    tool_calls: Mapped[dict | None] = mapped_column(JSONB)
    token_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
```

**Prisma comparison:**

```prisma
// This Prisma schema produces roughly the same tables
model Conversation {
  id        String   @id @default(uuid())
  tenantId  String
  title     String?
  model     String   @default("claude-sonnet-4-6")
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())
  messages  Message[]
}
```

The SQLAlchemy version is more verbose but gives you full control over column types, defaults, and indexing.

## CRUD operations

**Create:**

```python
with Session(engine) as session:
    conv = Conversation(
        tenant_id=uuid.UUID("a1b2c3d4-..."),
        title="Debug my RAG pipeline",
    )
    session.add(conv)
    session.commit()
    print(conv.id)  # UUID is populated after commit
```

```typescript
// Prisma equivalent
const conv = await prisma.conversation.create({
  data: { tenantId: 'a1b2c3d4-...', title: 'Debug my RAG pipeline' }
})
```

**Read:**

```python
with Session(engine) as session:
    convs = (
        session.query(Conversation)
        .filter(Conversation.tenant_id == tenant_id)
        .order_by(Conversation.created_at.desc())
        .limit(20)
        .all()
    )
```

**Update:**

```python
with Session(engine) as session:
    conv = session.get(Conversation, conv_id)
    conv.title = "Fixed RAG pipeline"
    session.commit()
```

**Delete:**

```python
with Session(engine) as session:
    conv = session.get(Conversation, conv_id)
    session.delete(conv)  # cascades to messages
    session.commit()
```

## The Session as a transaction

Every `Session` block is a transaction. Calls to `session.add()`, `session.delete()`, and attribute mutations are batched and flushed together on `commit()`. If anything raises, nothing is written.

```python
with Session(engine) as session:
    try:
        conv = Conversation(tenant_id=tid, title="New chat")
        session.add(conv)

        msg = Message(conversation_id=conv.id, role="user", content="Hello")
        session.add(msg)

        session.commit()  # both written atomically
    except Exception:
        session.rollback()  # neither written
        raise
```

This is equivalent to wrapping Prisma operations in a `prisma.$transaction()` block.

## Relationships and eager loading

By default, accessing `conv.messages` triggers a lazy load — a separate query fires when you touch the attribute. For API endpoints that always need messages, this is an N+1 problem.

```python
from sqlalchemy.orm import joinedload

with Session(engine) as session:
    conv = (
        session.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.id == conv_id)
        .one()
    )
    # conv.messages is already loaded — no extra query
```

**Prisma equivalent:**

```typescript
const conv = await prisma.conversation.findUnique({
  where: { id: convId },
  include: { messages: true },
})
```

Same concept, different syntax: tell the ORM upfront what you need to avoid extra round-trips.

## When to drop to raw SQL

The ORM isn't always the right tool:

```python
from sqlalchemy import text

with Session(engine) as session:
    result = session.execute(
        text("""
            SELECT conversation_id, SUM(token_count) AS total
            FROM messages
            WHERE created_at > :since
            GROUP BY conversation_id
            HAVING SUM(token_count) > :threshold
        """),
        {"since": "2026-01-01", "threshold": 10000},
    )
    rows = result.fetchall()
```

**Drop to raw SQL when:**
- Complex aggregations with GROUP BY, window functions, or CTEs
- Bulk operations (INSERT ... ON CONFLICT, bulk UPDATE)
- pgvector queries with custom distance functions
- Performance-critical queries where you need exact control over the plan

**Stay with the ORM when:**
- Standard CRUD on single models
- Queries involving relationships and eager loading
- Code that benefits from type safety and IDE autocompletion

There's no shame in mixing. Most production codebases use the ORM for 80% of queries and raw SQL for the rest.

Next: [Multi-Tenant Isolation →](./multi-tenant-isolation)
