# 5. Engineering Stack

You've now got the language. The next problem is making a Python project feel as well-engineered as a typed TS project: package management, static type checking, runtime validation, lint/format, tests, pre-commit, CI, project layout. The good news — modern Python (uv + mypy + pydantic + ruff + pytest + pre-commit) maps almost 1:1 onto pnpm + tsc + zod + eslint + prettier + vitest + husky.

## 5.1 Toolchain Overview: TS Strongly-Typed Stack vs Python Strongly-Typed Stack

Setting up a strongly-typed Python project is equivalent to setting up a TypeScript + pnpm full stack:

| Responsibility | TypeScript Stack | Python Stack | Notes |
|---------------|-----------------|--------------|-------|
| Package management + version management | pnpm + nvm | **uv** | uv = pip + venv + pyenv + poetry in one tool |
| Compilation / static type checking | tsc | **mypy --strict** | Static checking only, not involved at runtime |
| Runtime type validation | zod | **pydantic v2** | Used at all external data boundaries |
| Lint + Format | eslint + prettier | **ruff** | Written in Rust, one tool replaces two |
| Testing | vitest / jest | **pytest** | Fixture mechanism is more powerful than beforeEach |
| Pre-commit | husky + lint-staged | **pre-commit** | Local gate before CI |

The complete equation:

```
TS strongly-typed stack  = pnpm + tsc + zod + eslint + prettier + vitest + husky
Python strongly-typed stack = uv + mypy + pydantic + ruff + pytest + pre-commit
```

Setup order: `uv init` -> add dependencies -> configure `pyproject.toml` (mypy + ruff + pytest) -> configure pre-commit -> CI. The following sections cover each in detail.

## 5.2 Package Manager

| npm | uv | Notes |
|-----|-----|-------|
| `npm init` | `uv init` | Create project |
| `npm install` | `uv sync` | Install all dependencies (auto-creates `.venv`) |
| `npm install foo` | `uv add foo` | Add dependency |
| `npm install -D foo` | `uv add --dev foo` | Add dev dependency |
| `npm uninstall foo` | `uv remove foo` | Remove dependency |
| `npm run script` | `uv run command` | Run command in venv |
| `npm ci` | `uv sync --frozen` | Strict install from lock file (for CI) |
| `npm update` | `uv lock --upgrade` | Upgrade dependencies |
| `npm outdated` | `uv pip list --outdated` | Check outdated dependencies |
| `npx foo` | `uvx foo` | Run one-off tool without installing |
| `package.json` | `pyproject.toml` | Project config file |
| `package-lock.json` | `uv.lock` | Lock file |
| `node_modules/` | `.venv/` | Dependency install directory |

**Why uv is recommended**: 10-100x faster than pip (written in Rust), built-in virtual environment management, Python version management, lock files — one tool replaces pip + venv + pyenv + poetry.

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create project
uv init myproject
cd myproject

# Add dependencies
uv add fastapi pydantic sqlalchemy
uv add --dev pytest mypy ruff

# Run
uv run python -m myproject
uv run pytest
```

## 5.3 Dependency Declaration

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
# Python — pyproject.toml (equivalent to package.json)
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
serve = "my_app.main:main"   # equivalent to package.json scripts

[tool.mypy]
strict = true

[tool.ruff]
line-length = 100

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## 5.4 Virtual Environments

TS's `node_modules` provides project-level isolation. Python needs **virtual environments** to do the same thing.

```bash
# With uv (automatic management, you barely need to think about it)
uv sync              # auto-creates .venv + installs dependencies
uv run pytest        # auto-runs in venv

# Manual approach (understanding the internals)
python -m venv .venv            # create virtual environment
source .venv/bin/activate       # activate (macOS/Linux)
pip install -r requirements.txt # install dependencies
deactivate                      # exit

# .venv goes in .gitignore (like node_modules not being committed)
```

**Why Python needs virtual environments**: Python has only one global `site-packages` (imagine having only one global `node_modules`). Without virtual environments, all projects share the same dependencies — version conflicts are inevitable.

## 5.5 Type Checking

```bash
# TypeScript
npx tsc --noEmit

# Python — mypy
uv run mypy .                  # basic check
uv run mypy --strict .         # strict mode (recommended)
```

`mypy --strict` includes:
- No unannotated functions allowed
- No implicit `Any` propagation
- No untyped third-party libraries (require stubs or `type: ignore`)

```toml
# pyproject.toml — recommended mypy config
[tool.mypy]
strict = true
python_version = "3.12"
warn_return_any = true
warn_unused_ignores = true
disallow_any_generics = true
check_untyped_defs = true

# Some third-party libraries lack type stubs
[[tool.mypy.overrides]]
module = ["some_untyped_lib.*"]
ignore_missing_imports = true
```

### mypy is static-only, not involved at runtime

This is the most important thing to understand coming from TS: **mypy is equivalent to `tsc --noEmit` — it only runs during development and in CI, with zero impact on program execution.**

| | TypeScript (`tsc`) | Python (`mypy`) |
|-|---|---|
| Static type checking | Yes | Yes |
| Runtime type checking | No (types are erased after compilation) | No (type annotations are pure metadata, completely ignored at runtime) |

Python type annotations have **zero effect** at runtime — adding or removing them doesn't change program behavior at all:

```python
def add(a: int, b: int) -> int:
    return a + b

add("hello", "world")  # no runtime error, returns "helloworld" just fine
                        # mypy will flag: Argument 1 has incompatible type "str"
```

For runtime type validation, you need **Pydantic** (equivalent to Zod in the TS ecosystem):

```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int

User(name="Alice", age="abc")  # runtime ValidationError!
```

**Two layers of defense in practice:**

```
Dev / CI     --> mypy --strict  --> catches type errors (equivalent to tsc)
Runtime boundary --> Pydantic   --> validates external input (equivalent to Zod)
                     ^
                     Used for: API request bodies, database reads, LLM output parsing, config loading
                     Not for: internal function calls (mypy already covers those)
```

In the TS ecosystem, Zod is a nice-to-have. In the Python ecosystem, Pydantic is nearly **essential** — without a compilation step as a safety net, runtime type errors can only be caught by it.

## 5.6 Code Formatting & Linting

```bash
# TypeScript — two tools
npx eslint .               # lint
npx prettier --write .     # format

# Python — ruff does it all (written in Rust, extremely fast)
uv run ruff check .        # lint (replaces flake8 + isort + pylint)
uv run ruff format .       # format (replaces black)
uv run ruff check --fix .  # auto-fix
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

## 5.7 Python Version Management

```bash
# TypeScript uses nvm to manage Node versions
nvm install 20
nvm use 20

# Python — uv has built-in version management (pyenv also works)
uv python install 3.12        # install Python 3.12
uv python pin 3.12             # pin version for project (writes to .python-version)
```

## 5.8 Testing

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
# Python — pytest (no describe/it nesting needed, just write functions)
from my_app.user import create_user

def test_create_user_with_name() -> None:
    user = create_user("Alice")
    assert user.name == "Alice"

def test_create_user_default_age() -> None:
    user = create_user("Alice")
    assert user.age == 0

# Fixtures — dependency injection (more flexible than beforeEach)
import pytest
from sqlalchemy import Engine, create_engine

@pytest.fixture
def db_engine() -> Engine:
    engine = create_engine("sqlite:///:memory:")
    return engine

def test_query(db_engine: Engine) -> None:   # <- pytest auto-injects the fixture
    with db_engine.connect() as conn:
        result = conn.execute("SELECT 1")
        assert result.scalar() == 1

# Parameterized tests (one function, multiple data sets)
@pytest.mark.parametrize("input,expected", [
    ("hello", 5),
    ("", 0),
    ("hi", 2),
])
def test_string_length(input: str, expected: int) -> None:
    assert len(input) == expected
```

```bash
# Running tests
uv run pytest                  # run all tests
uv run pytest tests/test_user.py  # run a single file
uv run pytest -k "test_create"    # filter by name
uv run pytest --cov=my_app       # coverage
```

## 5.9 Project Structure

```
# Typical TypeScript structure
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
# Recommended Python structure (src layout)
my-app/
├── src/
│   └── my_app/              <- package name uses underscores (no hyphens allowed)
│       ├── __init__.py      <- package declaration (can be empty)
│       ├── main.py          <- entry point
│       ├── domain/
│       │   ├── __init__.py
│       │   ├── models.py    <- Pydantic models
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
│   ├── conftest.py          <- centralized pytest fixture definitions
│   ├── test_ingestion.py
│   └── test_models.py
├── pyproject.toml            <- package.json equivalent
├── uv.lock                   <- package-lock.json equivalent
├── .python-version           <- .nvmrc equivalent
└── .gitignore
```

**Why src layout**: Prevents accidentally importing uninstalled local code from the project root (TS doesn't have this problem because tsc has an explicit compilation entry point).

## 5.10 Naming Conventions

| Context | TypeScript | Python (PEP 8) |
|---------|-----------|----------------|
| Variables / functions | `camelCase` | `snake_case` |
| Classes | `PascalCase` | `PascalCase` |
| Constants | `UPPER_CASE` | `UPPER_CASE` |
| Filenames | `camelCase.ts` or `kebab-case.ts` | `snake_case.py` |
| Packages / directories | `kebab-case` | `snake_case` (no hyphens allowed) |
| Private | `#field` or `_field` | `_field` (convention) / `__field` (name mangling) |
| Booleans | `isActive` | `is_active` |

## 5.11 Pre-commit & CI

```yaml
# .pre-commit-config.yaml (equivalent to husky + lint-staged)
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
# Installation
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

With the toolchain in place, your project is now structurally as solid as a typed TS one. Next we look at the libraries you'll actually reach for on top of it — FastAPI for HTTP, Pydantic for validation, SQLAlchemy for database access — and how they compare to their TS counterparts.

Next: [Ecosystem →](./ecosystem)
