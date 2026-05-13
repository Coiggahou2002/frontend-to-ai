# 3. Errors & Async

Three things that look very similar across TS and Python on paper, but have meaningful differences in mechanics: exception handling, async/await, and iteration. Async in particular is where the Node.js mental model leaks: in TS the event loop is "always already running"; in Python you have to explicitly start it.

## 3.1 Error Handling

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

## 3.2 Async Programming

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

## 3.3 Iteration & Functional Operations

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

That covers control flow. Next we wrap up Part 1 with the rest of Python's everyday surface — modules, null handling, pattern matching, decorators, context managers, and the standard library "batteries" that mean fewer npm dependencies.

Next: [Modules & Standard Library →](./modules-and-stdlib)
