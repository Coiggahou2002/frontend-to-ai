# 5. ORM：SQLAlchemy

你当然可以所有操作都写原生 SQL。但实际开发中你会用 ORM，理由和你用 React 而不是 `document.createElement` 一样——它帮你处理重复性的部分，让你专注于业务逻辑。

在 Python AI 生态中，这个 ORM 就是 **SQLAlchemy**。如果你用过 Prisma，概念可以直接对应。

## 你需要的三个对象

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, DeclarativeBase

engine = create_engine("postgresql://user:pass@localhost/myapp")

class Base(DeclarativeBase):
    pass
```

| SQLAlchemy | Prisma 对应 | 作用 |
|------------|------------|------|
| `engine` | `PrismaClient()` | 持有连接池，与数据库通信 |
| `Session` | Prisma 查询中隐含 | 工作单元——将多条查询组织成一个事务 |
| `Base` | `schema.prisma` | 所有 model 继承的基类 |

## 定义 model

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

**Prisma 对比：**

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

SQLAlchemy 版本更啰嗦，但给了你对列类型、默认值和索引的完全控制。

## CRUD 操作

**创建：**

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

**查询：**

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

**更新：**

```python
with Session(engine) as session:
    conv = session.get(Conversation, conv_id)
    conv.title = "Fixed RAG pipeline"
    session.commit()
```

**删除：**

```python
with Session(engine) as session:
    conv = session.get(Conversation, conv_id)
    session.delete(conv)  # cascades to messages
    session.commit()
```

## Session 即事务

每个 `Session` 块就是一个事务。`session.add()`、`session.delete()` 以及属性修改都会被批量收集，在 `commit()` 时一起刷入数据库。如果中途抛异常，什么都不会写入。

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

这等价于把 Prisma 操作包在 `prisma.$transaction()` 块中。

## 关联关系与预加载

默认情况下，访问 `conv.messages` 会触发懒加载——你碰到这个属性时才发出一条额外查询。对于总是需要返回消息的 API 端点来说，这就是 N+1 问题。

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

**Prisma 对应写法：**

```typescript
const conv = await prisma.conversation.findUnique({
  where: { id: convId },
  include: { messages: true },
})
```

同样的概念，不同的语法：提前告诉 ORM 你需要什么，避免额外的数据库往返。

## 什么时候该回退到原生 SQL

ORM 不是万能的：

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

**用原生 SQL 的场景：**
- 复杂聚合查询，涉及 GROUP BY、窗口函数或 CTE
- 批量操作（INSERT ... ON CONFLICT、批量 UPDATE）
- pgvector 查询搭配自定义距离函数
- 对性能敏感的查询，需要精确控制执行计划

**用 ORM 的场景：**
- 单 model 的标准 CRUD
- 涉及关联关系和预加载的查询
- 需要类型安全和 IDE 自动补全的代码

混合使用完全没问题。大多数生产代码库 80% 的查询用 ORM，剩下 20% 用原生 SQL。

下一节：[多租户隔离 →](./multi-tenant-isolation)
