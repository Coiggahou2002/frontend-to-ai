# 7. 生态对照

工具链让你能搭起一个项目。生态是你在上面真正构建东西用到的部分。这一页把你每天会用的库——HTTP 框架、ORM、校验、HTTP 客户端，再加一份 Docker 配方——映到 TS 里的对应物。这里大多数惊喜是好的：FastAPI 就是"如果 Express 被以 Pydantic 为中心重新设计一遍"的样子。

## 7.1 常用库对照表

| 类别 | TypeScript | Python | 备注 |
|------|-----------|--------|------|
| HTTP 框架 | Express / Fastify / Hono | **FastAPI** / Flask | FastAPI 自带 OpenAPI 文档 |
| ORM | Prisma / Drizzle | **SQLAlchemy 2.0** | SA 2.0 支持类型注解 |
| 数据校验 | Zod / Yup | **Pydantic v2** | Pydantic = Zod + 更多 |
| HTTP 客户端 | fetch / axios | **httpx** / requests | httpx 支持 sync + async |
| 任务队列 | BullMQ | **Celery** / arq | |
| WebSocket | ws / socket.io | websockets / python-socketio | |
| CLI 框架 | Commander / yargs | **typer** / click | typer 基于类型注解 |
| 环境配置 | dotenv | **pydantic-settings** | 类型安全的配置 |
| 日志 | pino / winston | **structlog** / loguru | |
| 定时任务 | node-cron | APScheduler | |
| JWT | jsonwebtoken | PyJWT | |
| LLM SDK | @anthropic-ai/sdk | **anthropic** | |
| AI 编排 | LangChain.js / Vercel AI | **LangChain** / LlamaIndex | Python 生态远更成熟 |
| Embedding | — | sentence-transformers | |
| 向量数据库 | — | chromadb / pgvector | |
| 数据处理 | — | **pandas** / polars | Python 独有优势 |

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
    name: str                     # Pydantic 自动校验
    age: int

class UserResponse(BaseModel):
    id: str
    name: str
    age: int

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate) -> UserResponse:
    # 请求体自动解析 + 校验，失败自动返回 422
    return UserResponse(id="1", name=user.name, age=user.age)

@app.get("/users/{user_id}")
async def get_user(user_id: str) -> UserResponse:
    return UserResponse(id=user_id, name="Alice", age=30)

# 运行：uvicorn main:app --reload
# 自动生成交互式 API 文档：http://localhost:8000/docs
```

**FastAPI 的优势**：
- 请求参数校验是声明式的（Pydantic model），不需要手动 `safeParse`
- 自动生成 OpenAPI 文档 + Swagger UI
- 原生 async，性能接近 Go
- 返回值类型注解直接成为响应 schema

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

# 校验 — 失败抛 ValidationError
user = User.model_validate(input_dict)
# 或直接构造
user = User(name="Alice", email="a@b.com", age=30, role="admin")

# 序列化
user.model_dump()        # → dict
user.model_dump_json()   # → JSON string

# 从 JSON 反序列化
user = User.model_validate_json('{"name": "Alice", ...}')
```

**Pydantic vs Zod 区别**：Pydantic 的 schema 就是 Python class（不需要 `z.infer`），类型定义和校验规则是同一个东西。

## 7.4 SQLAlchemy vs Prisma

```typescript
// Prisma — schema 文件（DSL）
// prisma/schema.prisma
// model User {
//   id    String @id @default(uuid())
//   name  String
//   email String @unique
//   posts Post[]
// }

// 查询
const user = await prisma.user.findUnique({ where: { id: "1" } });
const users = await prisma.user.findMany({
  where: { name: { contains: "Ali" } },
  include: { posts: true },
});
```

```python
# SQLAlchemy 2.0 — 用 Python class 定义 schema
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

# 查询
from sqlalchemy import select

stmt = select(User).where(User.id == "1")
user = session.scalars(stmt).one()

stmt = select(User).where(User.name.contains("Ali"))
users = session.scalars(stmt).all()
```

**SQLAlchemy vs Prisma**：SA 更底层、更灵活（支持复杂 JOIN、子查询、原生 SQL），学习曲线更陡。Prisma 的类型安全查询构造器在 SA 2.0 中通过 `Mapped[]` 注解也基本实现了。

数据库迁移用 **Alembic**（等价于 Prisma Migrate）：

```bash
uv add alembic
alembic init migrations
alembic revision --autogenerate -m "add users table"
alembic upgrade head
```

## 7.5 Docker 打包

```dockerfile
# TypeScript — 典型 Node Dockerfile
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
# Python — 用 uv 的多阶段构建
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

# uv 创建的 venv 在 .venv 目录
ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "my_app"]
```

到这里你有了语言、工具链和生态。最后一道阻挡你上线 Python 的关卡是：一组每个 TS 开发者至少被坑一次的小陷阱——可变默认值、GIL、作用域规则，再加几个不按 Node.js 习惯出牌的小坑。

下一节: [踩坑指南 →](./gotchas)
