# 3. Schemas & Migrations

Two concepts that trip up frontend developers: PostgreSQL **schemas** (which are not what you think) and **migrations** (which are exactly what you think, but with different tooling in Python).

## PostgreSQL schemas are namespaces

In Prisma, a "schema" is a `.prisma` file that describes your table shapes. In PostgreSQL, a **schema** is a *namespace* — a folder inside a database that contains tables, views, and functions.

```
database: myapp
├── schema: public        ← default, where everything goes unless you say otherwise
│   ├── conversations
│   ├── messages
│   └── users
├── schema: embeddings
│   └── documents         ← same table name, different namespace
└── schema: analytics
    ├── daily_usage
    └── token_costs
```

Every database starts with a `public` schema. When you write `SELECT * FROM conversations`, Postgres reads that as `SELECT * FROM public.conversations`.

**Creating and using schemas:**

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

**When to use schemas:**
- Logical separation (keep `analytics` tables out of your app's `public` namespace)
- Multi-tenant isolation (one schema per tenant — covered in [§6](./multi-tenant-isolation))
- Extension isolation (keep pgvector objects in their own schema)

For most small-to-medium apps, the `public` schema is fine. Schemas become valuable when you have 50+ tables or need tenant isolation.

## Migrations: Alembic for Python

You already understand migrations from Prisma Migrate or Drizzle Kit. The concept is identical: version-controlled SQL scripts that move the database from state A to state B.

In the Python ecosystem, the standard tool is **Alembic** (built by the SQLAlchemy team).

**Setup:**

```bash
pip install alembic sqlalchemy
alembic init migrations
```

This creates:

```
migrations/
├── env.py          ← connects to your database
├── script.py.mako  ← template for new migrations
└── versions/       ← migration files live here
alembic.ini         ← config (database URL, etc.)
```

**Generating a migration:**

```bash
# Auto-generate from model changes (like prisma migrate dev)
alembic revision --autogenerate -m "add messages table"
```

This creates a file in `versions/` with `upgrade()` and `downgrade()` functions:

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

**Running migrations:**

```bash
alembic upgrade head    # Apply all pending migrations (like prisma migrate deploy)
alembic downgrade -1    # Roll back one step
alembic current         # Show current revision
alembic history         # Show all revisions
```

**Side-by-side with Prisma Migrate:**

| Concept | Prisma | Alembic |
|---------|--------|---------|
| Define tables | `.prisma` schema file | SQLAlchemy models (Python classes) |
| Generate migration | `prisma migrate dev` | `alembic revision --autogenerate` |
| Apply to production | `prisma migrate deploy` | `alembic upgrade head` |
| Roll back | Not supported natively | `alembic downgrade -1` |
| Migration files | SQL files in `prisma/migrations/` | Python files in `migrations/versions/` |

The biggest difference: Alembic migrations are Python code, not raw SQL. You can write conditional logic, data backfills, and multi-step operations inside a migration function. This is more powerful but also more rope to hang yourself with.

## Migration discipline

Rules that save you in production:

1. **Never edit a migration that's already been applied.** Create a new one instead. Alembic tracks which migrations have run by revision ID — if you change an applied migration's content, the database and the code disagree silently.

2. **Test migrations against a production-like database.** `alembic upgrade head` on an empty dev DB tells you nothing. Keep a staging database with realistic data volumes.

3. **Avoid destructive migrations without a backout plan.** Dropping a column is irreversible. Rename it to `_deprecated_X` first, deploy, verify nothing breaks, then drop it in a later migration.

4. **Always include both `upgrade()` and `downgrade()`.** You will need to roll back at 2 AM. The downgrade function is the only thing between you and a manual SQL session.

Next: [Transaction Isolation →](./transaction-isolation)
