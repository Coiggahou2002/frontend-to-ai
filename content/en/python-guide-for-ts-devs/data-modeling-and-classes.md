# 2. Data Modeling & Classes

You've seen Python's basic shapes. Now the part TS developers find genuinely confusing: Python has **four** different ways to define a "data object," and the one you reach for depends on whether the data crosses an external boundary, lives internally, or just needs structural typing. Then we cover full-blown classes (with `self`, dunder methods, properties) and enums.

## 2.1 Four Ways to Define Data Structures

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

## 2.2 Classes

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

## 2.3 Enums

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

You now have shapes (data classes) and behavior (regular classes). Next we look at how Python handles failure paths and concurrency — `try/except`, `asyncio`, and the comprehension idioms that replace `.map`/`.filter` chains.

Next: [Errors & Async →](./errors-and-async)
