# 7. Ecosystem

The toolchain gets you a project. The ecosystem is what you build on top of it. This page maps the libraries you'll actually use day-to-day — HTTP framework, ORM, validation, HTTP client, plus a Docker recipe — to their TS counterparts. Most of the surprises here are pleasant: FastAPI is what Express would look like if it had been redesigned with Pydantic at the center.

## 7.1 Common Library Comparison

| Category | TypeScript | Python | Notes |
|----------|-----------|--------|-------|
| HTTP framework | Express / Fastify / Hono | **FastAPI** / Flask | FastAPI includes auto-generated OpenAPI docs |
| ORM | Prisma / Drizzle | **SQLAlchemy 2.0** | SA 2.0 supports type annotations |
| Data validation | Zod / Yup | **Pydantic v2** | Pydantic = Zod + more |
| HTTP client | fetch / axios | **httpx** / requests | httpx supports sync + async |
| Task queue | BullMQ | **Celery** / arq | |
| WebSocket | ws / socket.io | websockets / python-socketio | |
| CLI framework | Commander / yargs | **typer** / click | typer is annotation-based |
| Environment config | dotenv | **pydantic-settings** | Type-safe configuration |
| Logging | pino / winston | **structlog** / loguru | |
| Scheduled tasks | node-cron | APScheduler | |
| JWT | jsonwebtoken | PyJWT | |
| LLM SDK | @anthropic-ai/sdk | **anthropic** | |
| AI orchestration | LangChain.js / Vercel AI | **LangChain** / LlamaIndex | Python ecosystem is far more mature |
| Embeddings | — | sentence-transformers | |
| Vector database | — | chromadb / pgvector | |
| Data processing | — | **pandas** / polars | Python's unique advantage |

## 7.2 FastAPI vs Express

```typescript
// Express (TypeScript)
import express, { Request, Response } from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

app.post("/users", (req: Request, res: Response) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({ errors: result.error.issues });
  }
  const user = result.data;
  res.json({ id: "1", ...user });
});

app.get("/users/:id", (req: Request, res: Response) => {
  res.json({ id: req.params.id, name: "Alice" });
});

app.listen(3000);
```

```python
# FastAPI (Python)
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class UserCreate(BaseModel):
    name: str                     # Pydantic auto-validates
    age: int

class UserResponse(BaseModel):
    id: str
    name: str
    age: int

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate) -> UserResponse:
    # Request body is auto-parsed + validated; failures auto-return 422
    return UserResponse(id="1", name=user.name, age=user.age)

@app.get("/users/{user_id}")
async def get_user(user_id: str) -> UserResponse:
    return UserResponse(id=user_id, name="Alice", age=30)

# Run: uvicorn main:app --reload
# Auto-generated interactive API docs: http://localhost:8000/docs
```

**FastAPI advantages:**
- Request parameter validation is declarative (Pydantic models), no manual `safeParse` needed
- Auto-generates OpenAPI docs + Swagger UI
- Native async, performance approaching Go
- Return type annotations directly become response schemas

## 7.3 Pydantic vs Zod

```typescript
// Zod
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
  role: z.enum(["admin", "user"]),
  tags: z.array(z.string()).default([]),
});

type User = z.infer<typeof UserSchema>;

const result = UserSchema.safeParse(input);
if (result.success) {
  const user: User = result.data;
}
```

```python
# Pydantic v2
from pydantic import BaseModel, EmailStr, Field
from typing import Literal

class User(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    age: int = Field(ge=0, le=150)
    role: Literal["admin", "user"]
    tags: list[str] = []

# Validation — raises ValidationError on failure
user = User.model_validate(input_dict)
# Or construct directly
user = User(name="Alice", email="a@b.com", age=30, role="admin")

# Serialization
user.model_dump()        # -> dict
user.model_dump_json()   # -> JSON string

# Deserialization from JSON
user = User.model_validate_json('{"name": "Alice", ...}')
```

**Pydantic vs Zod difference**: In Pydantic, the schema IS the Python class (no `z.infer` needed) — the type definition and validation rules are the same thing.

## 7.4 SQLAlchemy vs Prisma

```typescript
// Prisma — schema file (DSL)
// prisma/schema.prisma
// model User {
//   id    String @id @default(uuid())
//   name  String
//   email String @unique
//   posts Post[]
// }

// Queries
const user = await prisma.user.findUnique({ where: { id: "1" } });
const users = await prisma.user.findMany({
  where: { name: { contains: "Ali" } },
  include: { posts: true },
});
```

```python
# SQLAlchemy 2.0 — schema defined with Python classes
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    posts: Mapped[list["Post"]] = relationship(back_populates="author")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    author: Mapped[User] = relationship(back_populates="posts")

# Queries
from sqlalchemy import select

stmt = select(User).where(User.id == "1")
user = session.scalars(stmt).one()

stmt = select(User).where(User.name.contains("Ali"))
users = session.scalars(stmt).all()
```

**SQLAlchemy vs Prisma**: SA is lower-level and more flexible (supports complex JOINs, subqueries, raw SQL), with a steeper learning curve. Prisma's type-safe query builder is largely matched in SA 2.0 via `Mapped[]` annotations.

Database migrations use **Alembic** (equivalent to Prisma Migrate):

```bash
uv add alembic
alembic init migrations
alembic revision --autogenerate -m "add users table"
alembic upgrade head
```

## 7.5 Docker Packaging

```dockerfile
# TypeScript — typical Node Dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

```dockerfile
# Python — multi-stage build with uv
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /app /app

# uv creates venv in .venv directory
ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "my_app"]
```

You now have the language, the toolchain, and the ecosystem. The last thing standing between you and shipping Python is the small set of pitfalls that bite every TS developer at least once — mutable defaults, the GIL, scoping rules, and a few others that don't behave the way Node.js trained you to expect.

Next: [Gotchas →](./gotchas)
