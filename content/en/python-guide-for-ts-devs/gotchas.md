# 8. Gotchas & Pitfalls

Nine things that will bite you exactly once each. Skim now, recognize later. The big ones — mutable defaults, the lack of block scoping — aren't bugs in your code; they're consequences of how Python differs from Node.js at a level you won't notice until something breaks. (GIL and concurrency get a dedicated chapter: see Chapter 4.)

## 8.1 Mutable Default Argument Trap

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

## 8.2 `is` vs `==`

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

## 8.3 Pass by Reference

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

## 8.4 No Block Scoping

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

## 8.5 Circular Imports

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

## 8.6 Truthiness Differences

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

## 8.7 `__init__.py` & Package Discovery

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

## 8.8 Integer Division

```python
# Python 3 division differs from JS
10 / 3     # 3.3333... (float division, same as JS)
10 // 3    # 3 (integer division, JS doesn't have this)
10 % 3     # 1 (modulo, same as JS)

# Python doesn't have JS's floating-point precision issues (integers are arbitrary precision)
2 ** 100   # 1267650600228229401496703205376 (would overflow in JS)
```

## 8.9 Slice Syntax

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

That's the full set. None of these are conceptually hard once you know they exist — they're just landmines that don't exist in TS. Final page: a 4-week plan for actually getting hands-on, plus a short reference list.

Next: [Learning Path →](./learning-path)
