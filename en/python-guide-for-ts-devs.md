# Python Quick Start Guide — For TypeScript Developers

> This guide assumes you're already proficient in TypeScript / Node.js full-stack development, using that as an anchor to quickly build a Python mental model.

---

## Table of Contents

- [Part 1: Language Feature Comparison](#part-1-language-feature-comparison)
- [Part 2: Project Engineering Comparison](#part-2-project-engineering-comparison)
- [Part 3: Ecosystem Comparison](#part-3-ecosystem-comparison)
- [Part 4: Gotchas & Pitfalls](#part-4-gotchas--pitfalls)
- [Part 5: Learning Path](#part-5-learning-path)

---

# Part 1: Language Feature Comparison

## 1.1 Variable Declaration & Type Annotations

TypeScript uses `let` / `const` + type annotations. Python uses direct assignment + optional type hints. Python has no `const` — the convention is ALL_CAPS for constants, but the language doesn't enforce it.

```typescript
// TypeScript
let name: string = "Alice";
const age: number = 30;
const active: boolean = true;
const nothing: null = null;
const missing: undefined = undefined;
```

```python
# Python
name: str = "Alice"
age: int = 30
active: bool = True
nothing: None = None
# Python has no undefined, only None
```

Python type annotations are **optional metadata** — not enforced at runtime (unless you use Pydantic). To enforce static checks, use mypy.

## 1.2 Basic Type Mapping

| TypeScript | Python | Notes |
|-----------|--------|-------|
| `string` | `str` | |
| `number` | `int` / `float` | Python distinguishes integers from floats |
| `boolean` | `bool` | `True` / `False` are capitalized |
| `null` | `None` | |
| `undefined` | N/A | Python only has one "empty" value |
| `bigint` | `int` | Python natively supports arbitrary-precision integers |
| `any` | `Any` | `from typing import Any` |
| `unknown` | `object` | Not a perfect equivalent; Python has no `unknown` |
| `never` | `NoReturn` | `from typing import NoReturn` |
| `void` | `None` | Function return type `-> None` |

## 1.3 Advanced Type Annotations

```typescript
// TypeScript
type UserId = string;
type Status = "active" | "inactive";
type MaybeUser = User | null;
type Pair<A, B> = [A, B];

function greet(name: string, loud?: boolean): string {
  return loud ? name.toUpperCase() : name;
}
```

```python
# Python
from typing import TypeAlias, Literal, TypeVar, Generic

UserId: TypeAlias = str
Status: TypeAlias = Literal["active", "inactive"]
MaybeUser: TypeAlias = User | None          # Python 3.10+, equivalent to Optional[User]

A = TypeVar("A")
B = TypeVar("B")
Pair: TypeAlias = tuple[A, B]

def greet(name: str, loud: bool = False) -> str:
    return name.upper() if loud else name
```

Common typing utilities comparison:

| TypeScript | Python | Description |
|-----------|--------|-------------|
| `T \| null` | `T \| None` or `Optional[T]` | Nullable |
| `"a" \| "b"` | `Literal["a", "b"]` | Literal union |
| `A & B` | No direct equivalent | Use multiple inheritance or Protocol |
| `Partial<T>` | No built-in | Manually mark Optional or use Pydantic `model.model_copy(update=...)` |
| `Record<K, V>` | `dict[K, V]` | |
| `ReadonlyArray<T>` | `Sequence[T]` or `tuple[T, ...]` | |
| `Promise<T>` | `Coroutine` / `Awaitable[T]` | |

## 1.4 Functions

```typescript
// TypeScript
// Arrow function
const add = (a: number, b: number): number => a + b;

// Default parameters
function greet(name: string, prefix: string = "Hello"): string {
  return `${prefix}, ${name}`;
}

// Rest parameters
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// Destructured parameters
function createUser({ name, age }: { name: string; age: number }) {
  return { name, age };
}
```

```python
# Python
# lambda is Python's "arrow function", but limited to a single expression
add = lambda a, b: a + b

# In practice, def is used much more often (Python doesn't fuss over function vs arrow)
def add(a: int, b: int) -> int:
    return a + b

# Default parameters
def greet(name: str, prefix: str = "Hello") -> str:
    return f"{prefix}, {name}"

# *args = rest positional args, **kwargs = rest keyword args
def total(*nums: int) -> int:
    return sum(nums)

# Python has no destructured parameter syntax; use dataclass/TypedDict or pass directly
def create_user(name: str, age: int) -> dict[str, str | int]:
    return {"name": name, "age": age}
```

**Key difference**: Python's `lambda` is weak (single expression only); everyday code uses `def`. The Python community doesn't heavily use anonymous functions like JS — list comprehensions are preferred.

## 1.5 Strings

```typescript
// TypeScript — template literals
const name = "Alice";
const msg = `Hello, ${name}!`;
const multi = `
  line 1
  line 2
`;
```

```python
# Python — f-strings (3.6+)
name = "Alice"
msg = f"Hello, {name}!"
multi = """
  line 1
  line 2
"""

# f-strings can contain arbitrary expressions
total = f"sum = {1 + 2}"             # "sum = 3"
debug = f"{name=}"                   # "name='Alice'" (debugging shorthand)
```

## 1.6 Data Structures

```typescript
// TypeScript
const arr: number[] = [1, 2, 3];
const obj: Record<string, number> = { a: 1, b: 2 };
const map = new Map<string, number>([["a", 1]]);
const set = new Set<number>([1, 2, 3]);
const tuple: [string, number] = ["Alice", 30];
```

```python
# Python
arr: list[int] = [1, 2, 3]
obj: dict[str, int] = {"a": 1, "b": 2}
# Python's dict is ordered (insertion order guaranteed since 3.7+), essentially equivalent to Map
s: set[int] = {1, 2, 3}
t: tuple[str, int] = ("Alice", 30)
frozen: frozenset[int] = frozenset({1, 2, 3})  # immutable set, can be used as dict key
```

| TypeScript | Python | Mutable? |
|-----------|--------|----------|
| `Array<T>` | `list[T]` | Mutable |
| `ReadonlyArray<T>` | `tuple[T, ...]` | Immutable |
| `[A, B]` (tuple) | `tuple[A, B]` | Immutable |
| `object / Record` | `dict[K, V]` | Mutable |
| `Map<K, V>` | `dict[K, V]` | Mutable (Python dict is essentially Map) |
| `Set<T>` | `set[T]` | Mutable |
| `ReadonlySet<T>` | `frozenset[T]` | Immutable |

## 1.7 Destructuring & Spreading

```typescript
// TypeScript
const [a, b, ...rest] = [1, 2, 3, 4];        // a=1, b=2, rest=[3,4]
const { name, ...others } = { name: "A", age: 1, x: 2 };
const merged = { ...obj1, ...obj2 };
const combined = [...arr1, ...arr2];
```

```python
# Python
a, b, *rest = [1, 2, 3, 4]           # a=1, b=2, rest=[3,4]

# No destructuring syntax for dicts; access values directly
name = d["name"]

# Spreading
merged = {**obj1, **obj2}             # dict spread uses **
combined = [*arr1, *arr2]             # list spread uses *

# Python 3.12+: more spread scenarios
merged = obj1 | obj2                  # dict merge operator
```

## 1.8 Four Ways to Define Data Structures

This is the most confusing part for TS developers — Python has multiple ways to define "data objects."

```typescript
// TypeScript — one mainstream approach
interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
}
```

Python has four, each suited to different scenarios:

```python
# Approach 1: TypedDict — closest to a TS interface, adds types to a dict
from typing import TypedDict

class User(TypedDict, total=False):
    id: str          # required (when total=False, use Required[] for required fields)
    name: str
    age: int
    email: str       # optional (because total=False)

# Usage: it's just a dict
user: User = {"id": "1", "name": "Alice", "age": 30}
user["name"]  # access like a normal dict
```

```python
# Approach 2: dataclass — closest to traditional OOP class, auto-generates __init__/__repr__/__eq__
from dataclasses import dataclass, field

@dataclass
class User:
    id: str
    name: str
    age: int
    email: str | None = None

# Usage: use the constructor
user = User(id="1", name="Alice", age=30)
user.name           # attribute access
user.email = "a@b"  # mutable
```

```python
# Approach 3: Pydantic BaseModel — dataclass with runtime validation (recommended for API boundaries)
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    id: str
    name: str
    age: int
    email: EmailStr | None = None

# Usage: automatically validates on construction
user = User(id="1", name="Alice", age=30)
user = User(id="1", name="Alice", age="abc")  # runtime ValidationError!

# Serialization
user.model_dump()       # -> dict
user.model_dump_json()  # -> JSON string
```

```python
# Approach 4: Protocol — closest to TS interface's "structural typing" (duck typing)
from typing import Protocol

class HasName(Protocol):
    name: str
    def greet(self) -> str: ...

# Any object with a name attribute and greet method satisfies HasName, no explicit "implements" needed
class Dog:
    def __init__(self, name: str):
        self.name = name
    def greet(self) -> str:
        return f"Woof, I'm {self.name}"

def hello(thing: HasName) -> None:
    print(thing.greet())

hello(Dog("Rex"))  # OK — Dog structurally satisfies HasName
```

**Selection guide:**

| Scenario | Use | Why |
|----------|-----|-----|
| API request/response, DB models, config | **Pydantic BaseModel** | Runtime validation + serialization |
| Internal data transfer (DTO) | **dataclass** | Lightweight, no runtime overhead |
| Adding type hints to existing dicts | **TypedDict** | Minimal invasion |
| Defining abstract interfaces | **Protocol** | Structural subtyping |

## 1.9 Classes

```typescript
// TypeScript
class Animal {
  readonly species: string;
  private _name: string;

  constructor(species: string, name: string) {
    this.species = species;
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  toString(): string {
    return `${this.species}: ${this._name}`;
  }

  static create(species: string, name: string): Animal {
    return new Animal(species, name);
  }
}
```

```python
# Python
class Animal:
    def __init__(self, species: str, name: str) -> None:
        self.species: str = species      # public (Python has no true private)
        self._name: str = name           # convention: single underscore = "please don't access directly"

    @property                            # getter
    def name(self) -> str:
        return self._name

    @name.setter                         # setter
    def name(self, value: str) -> None:
        self._name = value

    def __str__(self) -> str:            # toString() equivalent
        return f"{self.species}: {self._name}"

    def __repr__(self) -> str:           # debug output, no JS equivalent
        return f"Animal({self.species!r}, {self._name!r})"

    def __eq__(self, other: object) -> bool:  # == operator
        if not isinstance(other, Animal):
            return NotImplemented
        return self.species == other.species and self._name == other._name

    def __hash__(self) -> int:           # usable as dict key / set element
        return hash((self.species, self._name))

    @staticmethod                        # doesn't need cls or self
    def create(species: str, name: str) -> "Animal":
        return Animal(species, name)

    @classmethod                         # first param is the class itself (no TS equivalent)
    def from_string(cls, s: str) -> "Animal":
        species, name = s.split(":")
        return cls(species.strip(), name.strip())
```

**`self` vs `this`:**
- TS's `this` is implicit; Python's `self` must be explicitly written as the first parameter
- `self` is just a naming convention — you could call it `this` (but nobody does)
- `@classmethod`'s first parameter is `cls` (the class itself), used for factory methods and correct construction in inheritance chains

**Common dunder methods (magic methods):**

| Python | TypeScript Equivalent | Purpose |
|--------|-----------------------|---------|
| `__init__` | `constructor` | Initialization |
| `__str__` | `toString()` | User-facing string |
| `__repr__` | N/A | Developer-facing string |
| `__eq__` | Must implement manually | `==` operator |
| `__hash__` | N/A | Hashable (usable as dict key) |
| `__len__` | `.length` | `len(obj)` |
| `__getitem__` | `[index]` | `obj[key]` |
| `__iter__` | `[Symbol.iterator]` | `for x in obj` |
| `__enter__/__exit__` | N/A | `with` statement |
| `__call__` | N/A | `obj()` makes instances callable |

## 1.10 Enums

```typescript
// TypeScript
enum Status {
  Active = "active",
  Inactive = "inactive",
}

function check(s: Status) {
  if (s === Status.Active) { /* ... */ }
}
```

```python
# Python
from enum import Enum, StrEnum

# StrEnum (3.11+) — closest to TS string enums
class Status(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"

def check(s: Status) -> None:
    if s == Status.ACTIVE:
        ...

# StrEnum can be used directly as a string
print(f"status is {Status.ACTIVE}")  # "status is active"

# Regular Enum (non-string)
class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3
```

## 1.11 Error Handling

```typescript
// TypeScript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

try {
  throw new AppError("Not found", "NOT_FOUND", 404);
} catch (e) {
  if (e instanceof AppError) {
    console.log(e.code);
  }
} finally {
  cleanup();
}
```

```python
# Python
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code

try:
    raise AppError("Not found", "NOT_FOUND", 404)
except AppError as e:          # catch -> except ... as
    print(e.code)
except (ValueError, KeyError): # can catch multiple types
    print("value or key error")
except Exception as e:         # catch-all
    print(f"unexpected: {e}")
finally:
    cleanup()
```

**Difference**: Python can precisely match exception types after `except`, no need for `instanceof` checks.

## 1.12 Async Programming

```typescript
// TypeScript
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// Concurrency
const [user, posts] = await Promise.all([
  fetchUser("1"),
  fetchPosts("1"),
]);
```

```python
# Python
import asyncio
import httpx

async def fetch_user(id: str) -> User:
    async with httpx.AsyncClient() as client:
        res = await client.get(f"/api/users/{id}")
        return res.json()

# Concurrency
user, posts = await asyncio.gather(
    fetch_user("1"),
    fetch_posts("1"),
)
```

**Key differences:**

| | TypeScript | Python |
|-|-----------|--------|
| Runtime | Event loop built into Node.js | Must explicitly start with `asyncio.run()` |
| HTTP client | `fetch` built-in | Requires third-party library (httpx / aiohttp) |
| Concurrency primitives | `Promise.all` / `Promise.race` | `asyncio.gather` / `asyncio.wait` |
| Ecosystem | Nearly all libraries are async | Many libraries are still synchronous; async versions may be separate packages |

```python
# Entry point for an async program
async def main() -> None:
    user = await fetch_user("1")
    print(user)

asyncio.run(main())  # <- not needed in Node.js
```

## 1.13 Iteration & Functional Operations

```typescript
// TypeScript
const nums = [1, 2, 3, 4, 5];

const doubled = nums.map(n => n * 2);
const evens = nums.filter(n => n % 2 === 0);
const sum = nums.reduce((acc, n) => acc + n, 0);
const found = nums.find(n => n > 3);
const hasEven = nums.some(n => n % 2 === 0);
const allPositive = nums.every(n => n > 0);
```

```python
# Python — list comprehensions are the mainstream approach, not .map/.filter
nums = [1, 2, 3, 4, 5]

doubled = [n * 2 for n in nums]                    # map
evens = [n for n in nums if n % 2 == 0]            # filter
total = sum(nums)                                   # reduce (sum is built-in)
found = next((n for n in nums if n > 3), None)     # find (no built-in .find)
has_even = any(n % 2 == 0 for n in nums)           # some
all_positive = all(n > 0 for n in nums)            # every

# Nested comprehension (flatMap equivalent)
matrix = [[1, 2], [3, 4]]
flat = [x for row in matrix for x in row]          # [1, 2, 3, 4]

# Dict comprehension
scores = {"a": 1, "b": 2, "c": 3}
doubled_scores = {k: v * 2 for k, v in scores.items()}

# Set comprehension
unique_lengths = {len(s) for s in ["hi", "hello", "hey"]}
```

**Key difference**: The Python community prefers comprehensions over `.map()` / `.filter()` chains. Comprehensions are faster (C-level optimization) and more idiomatic.

## 1.14 Modules & Imports

```typescript
// TypeScript
// Exports
export interface User { name: string; }
export function createUser(name: string): User { return { name }; }
export default class App { }

// Imports
import App from "./app";
import { User, createUser } from "./user";
import * as utils from "./utils";
```

```python
# Python
# --- user.py ---
class User:
    name: str

def create_user(name: str) -> User:
    return User()

# --- app.py ---
class App:
    pass

# --- imports ---
from app import App                    # no "default" concept in Python
from user import User, create_user     # named imports
import utils                           # import * as utils

# Relative imports (within a package)
from .user import User                 # same directory
from ..common import helper            # parent directory
```

**`__init__.py` — package declaration file (similar to index.ts):**

```
mypackage/
├── __init__.py        # declares this is a Python package; can re-export here
├── user.py
└── utils.py
```

```python
# mypackage/__init__.py
from .user import User
from .utils import helper

__all__ = ["User", "helper"]  # controls what `from mypackage import *` exports
```

## 1.15 Null Handling

```typescript
// TypeScript
const name = user?.profile?.name;          // optional chaining
const fallback = value ?? "default";       // nullish coalescing
const len = arr?.length ?? 0;
```

```python
# Python — no ?. syntax
name = user.profile.name if user and user.profile else None  # manual

# For dicts, use .get()
name = data.get("profile", {}).get("name")   # safe access

# or operator (note: empty string and 0 are also falsy)
fallback = value or "default"

# To exclude only None (not 0 / ""), there's no built-in syntax
fallback = value if value is not None else "default"

# Walrus operator := (Python 3.8+)
if (m := re.match(r"(\d+)", text)) is not None:
    print(m.group(1))

# getattr for safe attribute access
name = getattr(user, "name", "unknown")
```

## 1.16 Pattern Matching

```typescript
// TypeScript — switch
function describe(status: Status): string {
  switch (status) {
    case "active": return "Active";
    case "inactive": return "Inactive";
    default: const _: never = status; return _;  // exhaustive check
  }
}
```

```python
# Python 3.10+ — match/case (much more powerful than switch)
def describe(status: Status) -> str:
    match status:
        case "active":
            return "Active"
        case "inactive":
            return "Inactive"
        case _:                   # default / exhaustive fallback
            raise ValueError(f"Unknown status: {status}")

# match can destructure
match command:
    case {"action": "move", "x": x, "y": y}:    # dict destructuring
        move(x, y)
    case {"action": "quit"}:
        quit()
    case [first, *rest]:                          # list destructuring
        process(first, rest)
```

## 1.17 Decorators

TS decorators are experimental; Python decorators are **first-class citizens**, used extensively.

```typescript
// TypeScript (requires experimentalDecorators)
function Log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling ${key}`);
    return original.apply(this, args);
  };
}

class Service {
  @Log
  process(data: string) { return data; }
}
```

```python
# Python — a decorator is just a higher-order function that takes a function and returns a function
from functools import wraps
from typing import Callable, TypeVar, ParamSpec

P = ParamSpec("P")
R = TypeVar("R")

def log(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log
def process(data: str) -> str:
    return data

# Decorator with arguments (decorator factory)
def retry(times: int = 3) -> Callable:
    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            for i in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception:
                    if i == times - 1:
                        raise
            raise RuntimeError("unreachable")
        return wrapper
    return decorator

@retry(times=5)
def flaky_call() -> str:
    ...
```

**Common built-in decorators**: `@property`, `@staticmethod`, `@classmethod`, `@dataclass`, `@functools.cache`, `@functools.lru_cache`, `@abstractmethod`

## 1.18 Context Managers (with statement)

TS has no direct equivalent. Python's `with` statement guarantees resource cleanup, similar to try/finally but more elegant.

```python
# File operations — file is automatically closed when leaving the with block
with open("data.txt", "r") as f:
    content = f.read()
# f is automatically closed, even if an exception occurred

# Database connections
with db.connect() as conn:
    conn.execute("SELECT 1")
# conn is automatically returned to the connection pool

# Custom context manager
from contextlib import contextmanager

@contextmanager
def timer(label: str):
    import time
    start = time.perf_counter()
    yield                              # <- this is where the with block executes
    elapsed = time.perf_counter() - start
    print(f"{label}: {elapsed:.3f}s")

with timer("query"):
    run_expensive_query()
```

In TS you'd typically use try/finally or the `using` declaration (Stage 3 proposal) for similar behavior.

## 1.19 Useful Standard Library Modules

Python's "batteries included" philosophy is a major advantage. Here are things that require npm packages in TS but are built into Python:

| Use Case | TS (requires npm package) | Python (built-in) |
|----------|--------------------------|-------------------|
| File path operations | `path` (node) | `pathlib` |
| JSON parsing | Built-in | `json` |
| HTTP requests | `fetch` / `axios` | `urllib` (but httpx recommended) |
| Date & time | `dayjs` / `date-fns` | `datetime`, `zoneinfo` |
| Regular expressions | Built-in | `re` |
| CLI arguments | `commander` / `yargs` | `argparse` |
| Temporary files | `tmp` | `tempfile` |
| Hashing / crypto | `crypto` (node) | `hashlib`, `hmac`, `secrets` |
| Concurrency / threads | `worker_threads` | `threading`, `multiprocessing`, `concurrent.futures` |
| Unit testing | `jest` / `vitest` | `unittest`, `doctest` (pytest recommended) |
| Logging | `winston` / `pino` | `logging` |
| Data serialization | — | `pickle`, `shelve` |
| Abstract base classes | — | `abc` |
| Higher-order function tools | `lodash` | `functools`, `itertools`, `operator` |
| High-performance containers | — | `collections` (Counter, defaultdict, deque, OrderedDict) |
| Runtime type inspection | — | `typing`, `types` |

```python
# pathlib — nicer than node's path module
from pathlib import Path

p = Path("data") / "users" / "alice.json"   # concatenation
p.exists()                                    # check existence
p.read_text()                                 # read file contents
p.suffix                                      # ".json"
p.stem                                        # "alice"
list(Path(".").glob("**/*.py"))               # recursively find all .py files

# collections — high-performance containers
from collections import Counter, defaultdict, deque

counter = Counter(["a", "b", "a", "c", "a"])  # Counter({"a": 3, "b": 1, "c": 1})
dd = defaultdict(list)
dd["key"].append("value")                      # no need to check if key exists first

# functools
from functools import cache, partial

@cache                                         # automatic caching (unlimited)
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)

add_ten = partial(add, b=10)                   # partial application
```

---

# Part 2: Project Engineering Comparison

## Toolchain Overview: TS Strongly-Typed Stack vs Python Strongly-Typed Stack

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

## 2.1 Package Manager

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

## 2.2 Dependency Declaration

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

## 2.3 Virtual Environments

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

## 2.4 Type Checking

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

## 2.5 Code Formatting & Linting

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

## 2.6 Python Version Management

```bash
# TypeScript uses nvm to manage Node versions
nvm install 20
nvm use 20

# Python — uv has built-in version management (pyenv also works)
uv python install 3.12        # install Python 3.12
uv python pin 3.12             # pin version for project (writes to .python-version)
```

## 2.7 Testing

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

## 2.8 Project Structure

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

## 2.9 Naming Conventions

| Context | TypeScript | Python (PEP 8) |
|---------|-----------|----------------|
| Variables / functions | `camelCase` | `snake_case` |
| Classes | `PascalCase` | `PascalCase` |
| Constants | `UPPER_CASE` | `UPPER_CASE` |
| Filenames | `camelCase.ts` or `kebab-case.ts` | `snake_case.py` |
| Packages / directories | `kebab-case` | `snake_case` (no hyphens allowed) |
| Private | `#field` or `_field` | `_field` (convention) / `__field` (name mangling) |
| Booleans | `isActive` | `is_active` |

## 2.10 Pre-commit & CI

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

---

# Part 3: Ecosystem Comparison

## 3.1 Common Library Comparison

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

## 3.2 FastAPI vs Express

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

## 3.3 Pydantic vs Zod

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

## 3.4 SQLAlchemy vs Prisma

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

## 3.5 Docker Packaging

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

---

# Part 4: Gotchas & Pitfalls

## 4.1 Mutable Default Argument Trap

This is Python's most infamous gotcha. TS doesn't have this problem.

```python
# Wrong — the default [] is created once at function definition time; all calls share the same list
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

add_item("a")  # ["a"]
add_item("b")  # ["a", "b"] — NOT ["b"]!!!

# Correct
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

**Rule**: Never use mutable objects (list, dict, set) as function default values. Use `None` instead.

## 4.2 `is` vs `==`

```python
# == compares values (similar to JS ===, but doesn't compare types)
# is compares object identity (memory address)

a = [1, 2, 3]
b = [1, 2, 3]
a == b    # True — same values
a is b    # False — not the same object

# Only use is in these scenarios:
x is None         # check for None (don't use == None)
x is True         # check boolean (rare)
type(x) is int    # check exact type (usually prefer isinstance)
```

## 4.3 Pass by Reference

```python
# list and dict assignment doesn't copy, just creates a reference (same as JS, but easy to forget)
a = [1, 2, 3]
b = a           # b and a point to the same list
b.append(4)
print(a)        # [1, 2, 3, 4] — a changed too!

# When you need a copy:
b = a.copy()            # shallow copy
b = list(a)             # shallow copy
b = a[:]                # shallow copy (slice syntax)

import copy
b = copy.deepcopy(a)    # deep copy (for nested structures)
```

## 4.4 GIL & Concurrency

Python's GIL (Global Interpreter Lock) is the most confusing concept for TS developers.

```
TypeScript (Node.js):
  Single-threaded + event loop -> naturally no locks needed
  CPU-intensive -> Worker Threads

Python:
  Threads exist, but the GIL prevents them from truly running Python code in parallel
  IO-intensive -> asyncio (similar to Node.js event loop) or threading
  CPU-intensive -> multiprocessing (multiple processes, bypasses GIL)
```

```python
# IO-intensive tasks — use asyncio (closest to the Node.js model)
import asyncio

async def fetch_all(urls: list[str]) -> list[str]:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.text for r in responses]

# CPU-intensive tasks — use multiprocessing
from concurrent.futures import ProcessPoolExecutor

def heavy_compute(data: bytes) -> int:
    return len(data)  # simulated

with ProcessPoolExecutor() as pool:
    results = list(pool.map(heavy_compute, chunks))
```

> Python 3.13 introduced an experimental free-threaded mode (no GIL); this problem will gradually disappear in the future.

## 4.5 No Block Scoping

```python
# Python variables "leak" out of if/for blocks (TS/JS let/const don't)
for i in range(5):
    x = i * 2

print(i)    # 4 — loop variable is still accessible outside the loop
print(x)    # 8

if True:
    y = 42
print(y)    # 42 — variable from if block is accessible outside

# Python scopes are only: function, class, module, comprehension
# Comprehensions have their own scope:
result = [x for x in range(5)]
# print(x)  — x here comes from the for loop above, not the comprehension
```

## 4.6 Circular Imports

```python
# a.py
from b import B     # imports b
class A:
    def get_b(self) -> B: ...

# b.py
from a import A     # imports a -> circular import! ImportError
class B:
    def get_a(self) -> A: ...

# Solution 1: TYPE_CHECKING (most common)
from __future__ import annotations   # makes all annotations strings (lazy evaluation)
from typing import TYPE_CHECKING

if TYPE_CHECKING:                    # False at runtime, True only during mypy checks
    from a import A

class B:
    def get_a(self) -> A: ...        # at runtime A is the string "A", doesn't trigger import

# Solution 2: extract shared types into a third file
```

## 4.7 Truthiness Differences

```python
# Python has more falsy values than JS:
# False, None, 0, 0.0, "", [], {}, set(), (), 0j

# Note: in JS, [] and {} are truthy; in Python they're falsy!
if []:
    print("won't print")     # empty list is falsy

if {}:
    print("won't print")     # empty dict is falsy

# This can cause bugs:
def process(items: list[str] | None = None) -> None:
    if not items:             # empty list also enters this branch!
        items = get_defaults()

    # Should explicitly check for None:
    if items is None:
        items = get_defaults()
```

## 4.8 `__init__.py` & Package Discovery

```python
# A directory without __init__.py is not a Python package (in some configurations)
# uv / pytest default to "namespace packages", which can work without __init__.py
# But it's recommended to always include one to avoid weird import issues

# What __init__.py does:
# 1. Declares the directory is a package
# 2. Controls re-exports (similar to index.ts)
# 3. Package-level initialization code

# my_app/__init__.py
from .models import User, Entity     # re-export
from .main import app

__all__ = ["User", "Entity", "app"]  # controls * imports
__version__ = "1.0.0"                # package version
```

## 4.9 Integer Division

```python
# Python 3 division differs from JS
10 / 3     # 3.3333... (float division, same as JS)
10 // 3    # 3 (integer division, JS doesn't have this)
10 % 3     # 1 (modulo, same as JS)

# Python doesn't have JS's floating-point precision issues (integers are arbitrary precision)
2 ** 100   # 1267650600228229401496703205376 (would overflow in JS)
```

## 4.10 Slice Syntax

This is a powerful Python-specific feature that JS/TS doesn't have.

```python
arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

arr[2:5]      # [2, 3, 4]        — from index 2 to 5 (exclusive)
arr[:3]       # [0, 1, 2]        — first 3
arr[-3:]      # [7, 8, 9]        — last 3
arr[::2]      # [0, 2, 4, 6, 8]  — every other element
arr[::-1]     # [9, 8, ..., 0]   — reversed

# Strings also support slicing
"Hello"[1:4]  # "ell"

# Slice assignment (modify a section of a list)
arr[2:5] = [20, 30, 40]
```

---

# Part 5: Learning Path

## Week 1: Language Basics

- Install uv, create your first project with `uv init`
- Read Part 1 of this guide, experimenting in the REPL (`uv run python`) as you go
- Focus on: type annotations, f-strings, list comprehensions, Pydantic BaseModel
- Translate an existing simple TS utility function into Python

## Week 2: Engineering Setup

- Configure mypy strict + ruff + pytest (following Part 2)
- Write your first Pydantic model + pytest test
- Understand virtual environments and `pyproject.toml`
- Set up pre-commit hooks

## Week 3: Web Development

- Build a CRUD API with FastAPI
- Use Pydantic for request validation
- Connect to a database with SQLAlchemy 2.0
- Run database migrations with Alembic
- Write pytest tests (using httpx TestClient)

## Week 4: Async & Production

- Understand the asyncio event loop
- Make async HTTP requests with httpx.AsyncClient
- Use dependency injection in FastAPI (`Depends`)
- Docker packaging and deployment

## Ongoing References

| Resource | Purpose |
|----------|---------|
| [Python Official Docs](https://docs.python.org/3/) | Standard library reference |
| [mypy Docs](https://mypy.readthedocs.io/) | Deep dive into the type system |
| [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/) | Web framework (excellent interactive tutorial) |
| [Pydantic Docs](https://docs.pydantic.dev/) | Data validation |
| [SQLAlchemy 2.0 Tutorial](https://docs.sqlalchemy.org/en/20/tutorial/) | ORM |
| [Real Python](https://realpython.com/) | High-quality Python tutorials |
