# 5. 工程化工具链

语言部分已经讲完了。下一个问题是：怎么把 Python 项目调成跟一个类型化的 TS 项目一样规整：包管理、静态类型检查、运行时校验、lint/format、测试、pre-commit、CI、项目结构。好消息——现代 Python（uv + mypy + pydantic + ruff + pytest + pre-commit）几乎可以 1:1 对应到 pnpm + tsc + zod + eslint + prettier + vitest + husky。

## 5.1 工具栈总览：TS 强类型工程 vs Python 强类型工程

搭建一个 Python 强类型项目，等价于搭建 TypeScript + pnpm 全家桶：

| 职责 | TypeScript 栈 | Python 栈 | 备注 |
|------|-------------|-----------|------|
| 包管理 + 版本管理 | pnpm + nvm | **uv** | uv 一个工具 = pip + venv + pyenv + poetry |
| 编译 / 静态类型检查 | tsc | **mypy --strict** | 只做静态检查，不参与运行时 |
| 运行时类型校验 | zod | **pydantic v2** | 用在所有外部数据边界 |
| Lint + Format | eslint + prettier | **ruff** | Rust 写的，一个工具替代两个 |
| 测试 | vitest / jest | **pytest** | fixture 机制比 beforeEach 更强 |
| Pre-commit | husky + lint-staged | **pre-commit** | CI 之前的本地卡点 |

完整等式：

```
TS 强类型栈  = pnpm + tsc + zod + eslint + prettier + vitest + husky
Python 强类型栈 = uv + mypy + pydantic + ruff + pytest + pre-commit
```

搭建顺序：`uv init` → 加依赖 → 配 `pyproject.toml`（mypy + ruff + pytest）→ 配 pre-commit → CI。以下各节详细展开。

## 5.2 包管理器

| npm | uv | 备注 |
|-----|-----|------|
| `npm init` | `uv init` | 创建项目 |
| `npm install` | `uv sync` | 安装所有依赖（自动创建 `.venv`） |
| `npm install foo` | `uv add foo` | 添加依赖 |
| `npm install -D foo` | `uv add --dev foo` | 添加开发依赖 |
| `npm uninstall foo` | `uv remove foo` | 移除依赖 |
| `npm run script` | `uv run command` | 在 venv 中运行命令 |
| `npm ci` | `uv sync --frozen` | 严格按 lock 文件安装（CI 用） |
| `npm update` | `uv lock --upgrade` | 升级依赖 |
| `npm outdated` | `uv pip list --outdated` | 查看过期依赖 |
| `npx foo` | `uvx foo` | 运行一次性工具，不装进项目 |
| `package.json` | `pyproject.toml` | 项目配置文件 |
| `package-lock.json` | `uv.lock` | 锁文件 |
| `node_modules/` | `.venv/` | 依赖安装目录 |

**为什么推荐 uv**：速度是 pip 的 10-100 倍（Rust 写的），内置虚拟环境管理、Python 版本管理、lock 文件，一个工具替代 pip + venv + pyenv + poetry。

```bash
# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 创建项目
uv init myproject
cd myproject

# 添加依赖
uv add fastapi pydantic sqlalchemy
uv add --dev pytest mypy ruff

# 运行
uv run python -m myproject
uv run pytest
```

## 5.3 依赖声明

```jsonc
// TypeScript — package.json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.18.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "@types/express": "^4.17.0"
  }
}
```

```toml
# Python — pyproject.toml（等价于 package.json）
[project]
name = "my-app"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.110.0",
    "pydantic>=2.6.0",
    "sqlalchemy>=2.0.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "mypy>=1.8.0",
    "ruff>=0.3.0",
]

[project.scripts]
serve = "my_app.main:main"   # 等价于 package.json scripts

[tool.mypy]
strict = true

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## 5.4 虚拟环境

TS 的 `node_modules` 是项目级隔离。Python 需要**虚拟环境**做同样的事。

```bash
# 用 uv（自动管理，你几乎不用关心）
uv sync              # 自动创建 .venv + 安装依赖
uv run pytest        # 自动在 venv 中运行

# 手动方式（了解原理）
python -m venv .venv            # 创建虚拟环境
source .venv/bin/activate       # 激活（macOS/Linux）
pip install -r requirements.txt # 安装依赖
deactivate                      # 退出

# .venv 加入 .gitignore（等价于 node_modules 不提交）
```

**为什么 Python 需要虚拟环境**：Python 全局只有一个 `site-packages`（类似只有一个全局 `node_modules`）。不用虚拟环境，所有项目共享同一套依赖，版本冲突不可避免。

## 5.5 类型检查

```bash
# TypeScript
npx tsc --noEmit

# Python — mypy
uv run mypy .                  # 基础检查
uv run mypy --strict .         # 严格模式（推荐）
```

`mypy --strict` 包括：
- 不允许无类型注解的函数
- 不允许 `Any` 隐式传播
- 不允许无类型的第三方库（需要 stub 或 `type: ignore`）

```toml
# pyproject.toml — 推荐的 mypy 配置
[tool.mypy]
strict = true
python_version = "3.12"
warn_return_any = true
warn_unused_ignores = true
disallow_any_generics = true
check_untyped_defs = true

# 某些第三方库没有类型 stub
[[tool.mypy.overrides]]
module = ["some_untyped_lib.*"]
ignore_missing_imports = true
```

### mypy 只做静态检查，不参与运行时

这是从 TS 过来最需要理解的一点：**mypy 等价于 `tsc --noEmit`，只在开发时和 CI 中运行，对程序执行没有任何影响。**

| | TypeScript (`tsc`) | Python (`mypy`) |
|-|---|---|
| 静态类型检查 | 有 | 有 |
| 运行时类型检查 | 无（编译后类型全部擦除） | 无（类型注解是纯元数据，运行时完全被忽略） |

Python 的类型注解在运行时**零作用**——加不加注解对程序行为完全没有影响：

```python
def add(a: int, b: int) -> int:
    return a + b

add("hello", "world")  # 运行时不报错，正常返回 "helloworld"
                        # mypy 会报错：Argument 1 has incompatible type "str"
```

要在运行时也校验类型，需要 **Pydantic**（等价于 TS 生态中的 Zod）：

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int

User(name="Alice", age="abc")  # 运行时抛 ValidationError！
```

**实践中的两层防线：**

```
开发时 / CI ──→ mypy --strict  ──→ 捕获类型错误（等价于 tsc）
运行时边界  ──→ Pydantic       ──→ 校验外部输入（等价于 Zod）
              ↑
              用在：API 请求体、数据库读取、LLM 输出解析、配置文件加载
              不用在：内部函数调用（mypy 已经覆盖了）
```

TS 生态里 Zod 是可选的锦上添花，但 Python 生态里 Pydantic 几乎是**必需的**——因为没有编译步骤兜底，运行时类型错误只能靠它拦。

## 5.6 代码格式化与检查

```bash
# TypeScript — 两个工具
npx eslint .               # lint
npx prettier --write .     # format

# Python — ruff 一个工具全搞定（Rust 写的，极快）
uv run ruff check .        # lint（替代 flake8 + isort + pylint）
uv run ruff format .       # format（替代 black）
uv run ruff check --fix .  # 自动修复
```

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort (import sorting)
    "UP",   # pyupgrade (modernize syntax)
    "B",    # bugbear (common gotchas)
    "SIM",  # simplify
    "TCH",  # type checking imports
    "RUF",  # ruff-specific rules
]
```

## 5.7 Python 版本管理

```bash
# TypeScript 用 nvm 管理 Node 版本
nvm install 20
nvm use 20

# Python — uv 内置版本管理（也可用 pyenv）
uv python install 3.12        # 安装 Python 3.12
uv python pin 3.12             # 项目锁定版本（写入 .python-version）
```

## 5.8 测试

```typescript
// TypeScript — vitest
import { describe, it, expect } from "vitest";
import { createUser } from "./user";

describe("createUser", () => {
  it("should create a user with name", () => {
    const user = createUser("Alice");
    expect(user.name).toBe("Alice");
  });

  it("should default age to 0", () => {
    const user = createUser("Alice");
    expect(user.age).toBe(0);
  });
});
```

```python
# Python — pytest（不需要 describe/it 嵌套，直接写函数）
from my_app.user import create_user

def test_create_user_with_name() -> None:
    user = create_user("Alice")
    assert user.name == "Alice"

def test_create_user_default_age() -> None:
    user = create_user("Alice")
    assert user.age == 0

# fixture — 依赖注入（比 beforeEach 更灵活）
import pytest
from sqlalchemy import Engine, create_engine

@pytest.fixture
def db_engine() -> Engine:
    engine = create_engine("sqlite:///:memory:")
    return engine

def test_query(db_engine: Engine) -> None:   # ← pytest 自动注入 fixture
    with db_engine.connect() as conn:
        result = conn.execute("SELECT 1")
        assert result.scalar() == 1

# 参数化测试（一个函数测多组数据）
@pytest.mark.parametrize("input,expected", [
    ("hello", 5),
    ("", 0),
    ("hi", 2),
])
def test_string_length(input: str, expected: int) -> None:
    assert len(input) == expected
```

```bash
# 运行测试
uv run pytest                  # 运行所有测试
uv run pytest tests/test_user.py  # 运行单个文件
uv run pytest -k "test_create"    # 按名称过滤
uv run pytest --cov=my_app       # 覆盖率
```

## 5.9 项目结构

```
# TypeScript 典型结构
my-app/
├── src/
│   ├── index.ts
│   ├── routes/
│   ├── services/
│   └── types/
├── tests/
├── package.json
├── tsconfig.json
└── .eslintrc.js
```

```
# Python 推荐结构（src layout）
my-app/
├── src/
│   └── my_app/              ← 包名用下划线（不能用连字符）
│       ├── __init__.py      ← 包声明（可以为空）
│       ├── main.py          ← 入口
│       ├── domain/
│       │   ├── __init__.py
│       │   ├── models.py    ← Pydantic models
│       │   └── enums.py
│       ├── services/
│       │   ├── __init__.py
│       │   └── ingestion.py
│       ├── adapters/
│       │   ├── __init__.py
│       │   └── postgres.py
│       └── api/
│           ├── __init__.py
│           └── routes.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py          ← pytest fixture 集中定义
│   ├── test_ingestion.py
│   └── test_models.py
├── pyproject.toml            ← package.json 等价
├── uv.lock                   ← package-lock.json 等价
├── .python-version           ← .nvmrc 等价
└── .gitignore
```

**src layout 的意义**：防止你在项目根目录意外 import 到未安装的本地代码（TS 没这个问题因为 tsc 有明确的编译入口）。

## 5.10 命名规范

| 场景 | TypeScript | Python (PEP 8) |
|------|-----------|----------------|
| 变量 / 函数 | `camelCase` | `snake_case` |
| 类 | `PascalCase` | `PascalCase` |
| 常量 | `UPPER_CASE` | `UPPER_CASE` |
| 文件名 | `camelCase.ts` 或 `kebab-case.ts` | `snake_case.py` |
| 包/目录 | `kebab-case` | `snake_case`（不能有连字符） |
| private | `#field` 或 `_field` | `_field`（约定）/ `__field`（name mangling） |
| 布尔变量 | `isActive` | `is_active` |

## 5.11 Pre-commit & CI

```yaml
# .pre-commit-config.yaml（等价于 husky + lint-staged）
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.8.0
    hooks:
      - id: mypy
        additional_dependencies: [pydantic]
```

```bash
# 安装
uv tool install pre-commit
pre-commit install
```

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run mypy .
      - run: uv run pytest --cov
```

工具链就位后，项目在结构上跟一个类型化的 TS 项目一样扎实。下一页讲在它之上你真正会去拿的那些库——FastAPI（HTTP）、Pydantic（校验）、SQLAlchemy（数据库访问）——以及它们在 TS 里的对应物。

下一节: [生态对照 →](./ecosystem)
