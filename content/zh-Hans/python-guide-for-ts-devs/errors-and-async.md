# 3. 错误与异步

三件事在 TS 和 Python 纸面上看起来很像，但机制上差别不小：异常处理、async/await、迭代。其中异步是 Node.js 心智模型最容易漏的地方——TS 里事件循环"早就在跑了"，Python 里你必须显式启动它。

## 3.1 错误处理

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
except AppError as e:          # catch → except ... as
    print(e.code)
except (ValueError, KeyError): # 可以捕获多种
    print("value or key error")
except Exception as e:         # 兜底
    print(f"unexpected: {e}")
finally:
    cleanup()
```

**区别**：Python 可以在 `except` 后面精确匹配异常类型，不需要 `instanceof` 判断。

## 3.2 异步编程

```typescript
// TypeScript
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// 并发
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

# 并发
user, posts = await asyncio.gather(
    fetch_user("1"),
    fetch_posts("1"),
)
```

**关键区别：**

| | TypeScript | Python |
|-|-----------|--------|
| 运行时 | 事件循环内置于 Node.js | 需要显式启动 `asyncio.run()` |
| HTTP 客户端 | `fetch` 内置 | 需要第三方库（httpx / aiohttp） |
| 并发原语 | `Promise.all` / `Promise.race` | `asyncio.gather` / `asyncio.wait` |
| 生态 | 几乎所有库都是 async | 很多库仍然是同步的，async 版本可能是另一个包 |

```python
# 启动 async 程序的入口
async def main() -> None:
    user = await fetch_user("1")
    print(user)

asyncio.run(main())  # ← Node.js 里不需要这一步
```

## 3.3 迭代与函数式操作

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
# Python — 列表推导式是主流，不是 .map/.filter
nums = [1, 2, 3, 4, 5]

doubled = [n * 2 for n in nums]                    # map
evens = [n for n in nums if n % 2 == 0]            # filter
total = sum(nums)                                   # reduce (sum 内置)
found = next((n for n in nums if n > 3), None)     # find（没有内置 .find）
has_even = any(n % 2 == 0 for n in nums)           # some
all_positive = all(n > 0 for n in nums)            # every

# 嵌套推导（flatMap 等价）
matrix = [[1, 2], [3, 4]]
flat = [x for row in matrix for x in row]          # [1, 2, 3, 4]

# dict 推导式
scores = {"a": 1, "b": 2, "c": 3}
doubled_scores = {k: v * 2 for k, v in scores.items()}

# set 推导式
unique_lengths = {len(s) for s in ["hi", "hello", "hey"]}
```

**核心区别**：Python 社区偏好推导式而非 `.map()` / `.filter()` 链。推导式更快（C 层面优化）且更易读（Python 风格）。

控制流就这些了。下一页把 Part 1 收尾——剩下的 Python 日常表层：模块、空值处理、模式匹配、装饰器、上下文管理器，以及让你少装一堆 npm 依赖的标准库"电池"。

下一节: [并发模型 →](./concurrency)
