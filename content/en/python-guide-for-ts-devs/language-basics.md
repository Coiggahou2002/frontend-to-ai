# 1. Language Basics

This page covers the everyday surface of the Python language: variable declaration, type annotations, basic types, functions, strings, data structures, destructuring. None of it is conceptually surprising for a TS developer — but the spelling and the defaults differ enough that you should skim it once and look up the table later.

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

That covers Python's basic shapes. The next page is where things get distinctive: Python has **four** different ways to define a "data object" (vs TypeScript's one `interface`), and you need to know which one to reach for.

Next: [Data Modeling & Classes →](./data-modeling-and-classes)
