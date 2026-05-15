# 3. Schema 与 Migration

两个容易让前端开发者困惑的概念：PostgreSQL 的 **schema**（和你以为的不一样）以及 **migration**（和你以为的一样，但 Python 生态的工具链不同）。

## PostgreSQL 的 schema 是命名空间

在 Prisma 里，"schema" 是一个 `.prisma` 文件，用来描述表的结构。在 PostgreSQL 里，**schema** 是一个*命名空间*——数据库内部的一个文件夹，里面装着表、视图和函数。

```
database: myapp
├── schema: public        ← 默认，不指定的话所有东西都放这里
│   ├── conversations
│   ├── messages
│   └── users
├── schema: embeddings
│   └── documents         ← 同名表，不同命名空间
└── schema: analytics
    ├── daily_usage
    └── token_costs
```

每个数据库初始都有一个 `public` schema。当你写 `SELECT * FROM conversations` 时，Postgres 实际读取的是 `SELECT * FROM public.conversations`。

**创建和使用 schema：**

```sql
CREATE SCHEMA IF NOT EXISTS embeddings;

CREATE TABLE embeddings.documents (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content   TEXT NOT NULL,
    embedding vector(1536)
);

-- Query it explicitly
SELECT * FROM embeddings.documents WHERE id = '...';

-- Or set the search path so you don't have to qualify every time
SET search_path TO embeddings, public;
```

**什么时候用 schema：**
- 逻辑隔离（把 `analytics` 表和应用的 `public` 命名空间分开）
- 多租户隔离（一个租户一个 schema —— 详见 [§6](./multi-tenant-isolation)）
- 扩展隔离（把 pgvector 相关对象放进独立 schema）

对大多数中小型应用来说，`public` schema 就够了。当你有 50 张以上的表或者需要租户隔离时，schema 才真正有价值。

## Migration：Python 生态用 Alembic

你已经理解了 migration 的概念——无论是通过 Prisma Migrate 还是 Drizzle Kit。核心思路是一样的：版本控制的 SQL 脚本，把数据库从状态 A 迁移到状态 B。

在 Python 生态中，标准工具是 **Alembic**（SQLAlchemy 团队开发的）。

**初始化：**

```bash
pip install alembic sqlalchemy
alembic init migrations
```

这会创建如下目录结构：

```
migrations/
├── env.py          ← 连接数据库
├── script.py.mako  ← 新 migration 的模板
└── versions/       ← migration 文件存放目录
alembic.ini         ← 配置文件（数据库 URL 等）
```

**生成 migration：**

```bash
# Auto-generate from model changes (like prisma migrate dev)
alembic revision --autogenerate -m "add messages table"
```

这会在 `versions/` 目录下创建一个包含 `upgrade()` 和 `downgrade()` 函数的文件：

```python
def upgrade():
    op.create_table(
        'messages',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('conversation_id', sa.UUID(), sa.ForeignKey('conversations.id')),
        sa.Column('role', sa.Text(), nullable=False),
        sa.Column('content', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table('messages')
```

**执行 migration：**

```bash
alembic upgrade head    # Apply all pending migrations (like prisma migrate deploy)
alembic downgrade -1    # Roll back one step
alembic current         # Show current revision
alembic history         # Show all revisions
```

**与 Prisma Migrate 对照：**

| 概念 | Prisma | Alembic |
|------|--------|---------|
| 定义表结构 | `.prisma` schema 文件 | SQLAlchemy model（Python 类） |
| 生成 migration | `prisma migrate dev` | `alembic revision --autogenerate` |
| 部署到生产环境 | `prisma migrate deploy` | `alembic upgrade head` |
| 回滚 | 原生不支持 | `alembic downgrade -1` |
| Migration 文件 | `prisma/migrations/` 中的 SQL 文件 | `migrations/versions/` 中的 Python 文件 |

最大的区别：Alembic 的 migration 是 Python 代码，不是原始 SQL。你可以在 migration 函数里写条件逻辑、数据回填和多步操作。这更强大，但也更容易把自己绊倒。

## Migration 纪律

在生产环境中救你一命的几条规则：

1. **永远不要修改已经执行过的 migration。** 创建一个新的。Alembic 通过 revision ID 追踪哪些 migration 已经跑过——如果你改了一个已执行 migration 的内容，数据库和代码会悄无声息地对不上。

2. **用类生产环境的数据库测试 migration。** 在空的开发数据库上跑 `alembic upgrade head` 什么都证明不了。维护一个有真实数据量的 staging 数据库。

3. **没有回退方案就不要做破坏性 migration。** 删列是不可逆的。先把列重命名为 `_deprecated_X`，部署上线，确认没有问题，再在后续 migration 中删掉。

4. **永远同时写 `upgrade()` 和 `downgrade()`。** 你总有一天要在凌晨 2 点回滚。downgrade 函数是你和手动敲 SQL 之间唯一的屏障。

下一节：[事务隔离 →](./transaction-isolation)
