# 4. 模块与标准库

语言层面的最后一捆东西：Python 怎么把代码组织成模块和包、没有 `?.` 和 `??` 怎么办、`match` 语句、装饰器（在 TS 里还是实验性的，在这里是一等公民）、上下文管理器，以及让典型 Python 项目比 TS 项目依赖更少的那个意外丰满的标准库。

## 4.1 模块与导入

```typescript
// TypeScript
// 导出
export interface User { name: string; }
export function createUser(name: string): User { return { name }; }
export default class App { }

// 导入
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

# --- 导入 ---
from app import App                    # import default → 没有 default 概念
from user import User, create_user     # named imports
import utils                           # import * as utils

# 相对导入（包内部）
from .user import User                 # 同级目录
from ..common import helper            # 上级目录
```

**`__init__.py` — 包声明文件（类似 index.ts）：**

```
mypackage/
├── __init__.py        # 声明这是一个 Python 包，可以在这里 re-export
├── user.py
└── utils.py
```

```python
# mypackage/__init__.py
from .user import User
from .utils import helper

__all__ = ["User", "helper"]  # 控制 `from mypackage import *` 导出什么
```

## 4.2 空值处理

```typescript
// TypeScript
const name = user?.profile?.name;          // optional chaining
const fallback = value ?? "default";       // nullish coalescing
const len = arr?.length ?? 0;
```

```python
# Python — 没有 ?. 语法
name = user.profile.name if user and user.profile else None  # 手动写

# 对 dict 用 .get()
name = data.get("profile", {}).get("name")   # 安全取值

# or 运算符（注意：空字符串和 0 也是 falsy）
fallback = value or "default"

# 如果只想排除 None（不排除 0 / ""），没有内置语法
fallback = value if value is not None else "default"

# 海象运算符 :=（Python 3.8+）
if (m := re.match(r"(\d+)", text)) is not None:
    print(m.group(1))

# getattr 安全访问属性
name = getattr(user, "name", "unknown")
```

## 4.3 模式匹配

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
# Python 3.10+ — match/case（比 switch 强大得多）
def describe(status: Status) -> str:
    match status:
        case "active":
            return "Active"
        case "inactive":
            return "Inactive"
        case _:                   # default / exhaustive fallback
            raise ValueError(f"Unknown status: {status}")

# match 可以解构
match command:
    case {"action": "move", "x": x, "y": y}:    # dict 解构
        move(x, y)
    case {"action": "quit"}:
        quit()
    case [first, *rest]:                          # list 解构
        process(first, rest)
```

## 4.4 装饰器

TS 装饰器是实验性的，Python 装饰器是**一等公民**，大量使用。

```typescript
// TypeScript（需要开启 experimentalDecorators）
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
# Python — 装饰器就是一个接收函数、返回函数的高阶函数
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

# 带参数的装饰器（装饰器工厂）
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

**Python 内置常用装饰器**：`@property`, `@staticmethod`, `@classmethod`, `@dataclass`, `@functools.cache`, `@functools.lru_cache`, `@abstractmethod`

## 4.5 上下文管理器（with 语句）

TS 没有对应的语言特性。Python 的 `with` 语句保证资源清理，类似 try/finally 但更优雅。

```python
# 文件操作 — 离开 with 块自动关闭文件
with open("data.txt", "r") as f:
    content = f.read()
# f 已自动关闭，即使发生异常

# 数据库连接
with db.connect() as conn:
    conn.execute("SELECT 1")
# conn 已自动归还连接池

# 自定义上下文管理器
from contextlib import contextmanager

@contextmanager
def timer(label: str):
    import time
    start = time.perf_counter()
    yield                              # ← 这里是 with 块的执行点
    elapsed = time.perf_counter() - start
    print(f"{label}: {elapsed:.3f}s")

with timer("query"):
    run_expensive_query()
```

TS 中你通常用 try/finally 或 `using` 声明（Stage 3 提案）来做类似的事。

## 4.6 常用标准库

Python 的"电池充足"（batteries included）是一大优势。以下是 TS 中需要装第三方包但 Python 内置的功能：

| 用途 | TS（需要 npm 包） | Python（内置） |
|------|------------------|--------------|
| 文件路径操作 | `path` (node) | `pathlib` |
| JSON 解析 | 内置 | `json` |
| HTTP 请求 | `fetch` / `axios` | `urllib`（但建议用 httpx） |
| 日期时间 | `dayjs` / `date-fns` | `datetime`, `zoneinfo` |
| 正则表达式 | 内置 | `re` |
| 命令行参数 | `commander` / `yargs` | `argparse` |
| 临时文件 | `tmp` | `tempfile` |
| 哈希/加密 | `crypto` (node) | `hashlib`, `hmac`, `secrets` |
| 并发/线程 | `worker_threads` | `threading`, `multiprocessing`, `concurrent.futures` |
| 单元测试 | `jest` / `vitest` | `unittest`, `doctest`（建议用 pytest） |
| 日志 | `winston` / `pino` | `logging` |
| 数据序列化 | — | `pickle`, `shelve` |
| 抽象基类 | — | `abc` |
| 高阶函数工具 | `lodash` | `functools`, `itertools`, `operator` |
| 高性能容器 | — | `collections` (Counter, defaultdict, deque, OrderedDict) |
| 类型运行时检查 | — | `typing`, `types` |

```python
# pathlib — 比 node 的 path 好用
from pathlib import Path

p = Path("data") / "users" / "alice.json"   # 拼接
p.exists()                                    # 是否存在
p.read_text()                                 # 读文件内容
p.suffix                                      # ".json"
p.stem                                        # "alice"
list(Path(".").glob("**/*.py"))               # 递归查找所有 .py

# collections — 高性能容器
from collections import Counter, defaultdict, deque

counter = Counter(["a", "b", "a", "c", "a"])  # Counter({"a": 3, "b": 1, "c": 1})
dd = defaultdict(list)
dd["key"].append("value")                      # 不需要先判断 key 是否存在

# functools
from functools import cache, partial

@cache                                         # 自动缓存（无限制）
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)

add_ten = partial(add, b=10)                   # 偏函数
```

Part 1 到这里就讲完了——这是语言本身。会用语言只是一半；另一半是把 Python 项目调成跟"类型化的 pnpm + tsc + zod + eslint + vitest"TS 项目一样规整。下一页讲那个：Python 这一侧的强类型工程化工具链。

下一节: [工程化工具链 →](./engineering-stack)
