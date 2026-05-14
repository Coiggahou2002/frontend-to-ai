# 5. Modules & Standard Library

The last bundle of language-level material: how Python organizes code into modules and packages, what to do without `?.` and `??`, the `match` statement, decorators (a first-class citizen, unlike in TS), context managers, and the surprisingly fat standard library that means a typical Python project pulls in fewer dependencies than a TS one.

## 5.1 Modules & Imports

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

## 5.2 Null Handling

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

## 5.3 Pattern Matching

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

## 5.4 Decorators

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

## 5.5 Context Managers (with statement)

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

## 5.6 Useful Standard Library Modules

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

That closes out Part 1 — the language itself. Knowing the language is half the battle; the other half is getting a Python project to feel as buttoned-up as a typed pnpm + tsc + zod + eslint + vitest TS project. That's what the next page covers: the Python equivalent of the strongly-typed TS toolchain.

Next: [Engineering Stack →](./engineering-stack)
