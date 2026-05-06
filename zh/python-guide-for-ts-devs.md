# Python 快速上手指南 — 写给 TypeScript 开发者

> 本指南假设你已经熟练掌握 TypeScript / Node.js 全栈开发，以此为锚点快速建立 Python 心智模型。

---

## 目录

- [Part 1: 语言特性对照](#part-1-语言特性对照)
- [Part 2: 工程项目对照](#part-2-工程项目对照)
- [Part 3: 生态对照](#part-3-生态对照)
- [Part 4: 踩坑指南](#part-4-踩坑指南)
- [Part 5: 学习路线](#part-5-学习路线)

---

# Part 1: 语言特性对照

## 1.1 变量声明与类型注解

TypeScript 用 `let` / `const` + 类型注解，Python 直接赋值 + 可选类型提示。Python 没有 `const`——约定全大写表示常量，但语言不强制。

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
# Python 没有 undefined，只有 None
```

Python 类型注解是**可选的元数据**，运行时不校验（除非用 Pydantic）。要强制检查需要 mypy。

## 1.2 基本类型映射

| TypeScript | Python | 备注 |
|-----------|--------|------|
| `string` | `str` | |
| `number` | `int` / `float` | Python 区分整数和浮点 |
| `boolean` | `bool` | `True` / `False` 首字母大写 |
| `null` | `None` | |
| `undefined` | 无 | Python 只有一个"空" |
| `bigint` | `int` | Python 原生支持任意精度整数 |
| `any` | `Any` | `from typing import Any` |
| `unknown` | `object` | 不完全等价，Python 无 unknown |
| `never` | `NoReturn` | `from typing import NoReturn` |
| `void` | `None` | 函数返回值 `-> None` |

## 1.3 类型注解进阶

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
MaybeUser: TypeAlias = User | None          # Python 3.10+，等价于 Optional[User]

A = TypeVar("A")
B = TypeVar("B")
Pair: TypeAlias = tuple[A, B]

def greet(name: str, loud: bool = False) -> str:
    return name.upper() if loud else name
```

常用 typing 工具对照：

| TypeScript | Python | 说明 |
|-----------|--------|------|
| `T \| null` | `T \| None` 或 `Optional[T]` | 可空 |
| `"a" \| "b"` | `Literal["a", "b"]` | 字面量联合 |
| `A & B` | 无直接等价 | 用多重继承或 Protocol |
| `Partial<T>` | 无内置 | 手动标 Optional 或用 Pydantic `model.model_copy(update=...)` |
| `Record<K, V>` | `dict[K, V]` | |
| `ReadonlyArray<T>` | `Sequence[T]` 或 `tuple[T, ...]` | |
| `Promise<T>` | `Coroutine` / `Awaitable[T]` | |

## 1.4 函数

```typescript
// TypeScript
// 箭头函数
const add = (a: number, b: number): number => a + b;

// 默认参数
function greet(name: string, prefix: string = "Hello"): string {
  return `${prefix}, ${name}`;
}

// 剩余参数
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// 解构参数
function createUser({ name, age }: { name: string; age: number }) {
  return { name, age };
}
```

```python
# Python
# lambda 是 Python 的"箭头函数"，但只能写一行表达式
add = lambda a, b: a + b

# 实际中更常用 def（Python 不纠结 function vs arrow）
def add(a: int, b: int) -> int:
    return a + b

# 默认参数
def greet(name: str, prefix: str = "Hello") -> str:
    return f"{prefix}, {name}"

# *args = 剩余位置参数，**kwargs = 剩余关键字参数
def total(*nums: int) -> int:
    return sum(nums)

# Python 没有解构参数语法，用 dataclass/TypedDict 或直接传
def create_user(name: str, age: int) -> dict[str, str | int]:
    return {"name": name, "age": age}
```

**核心区别**：Python 的 `lambda` 很弱（只能一行表达式），日常都用 `def`。Python 社区不像 JS 那样大量使用匿名函数——更偏好列表推导式。

## 1.5 字符串

```typescript
// TypeScript — 模板字符串
const name = "Alice";
const msg = `Hello, ${name}!`;
const multi = `
  line 1
  line 2
`;
```

```python
# Python — f-string（3.6+）
name = "Alice"
msg = f"Hello, {name}!"
multi = """
  line 1
  line 2
"""

# f-string 里可以写任意表达式
total = f"sum = {1 + 2}"             # "sum = 3"
debug = f"{name=}"                   # "name='Alice'"（调试神器）
```

## 1.6 数据结构

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
# Python 的 dict 是有序的（3.7+ 保证插入顺序），基本等价于 Map
s: set[int] = {1, 2, 3}
t: tuple[str, int] = ("Alice", 30)
frozen: frozenset[int] = frozenset({1, 2, 3})  # 不可变 set，可做 dict key
```

| TypeScript | Python | 可变? |
|-----------|--------|-------|
| `Array<T>` | `list[T]` | 可变 |
| `ReadonlyArray<T>` | `tuple[T, ...]` | 不可变 |
| `[A, B]` (tuple) | `tuple[A, B]` | 不可变 |
| `object / Record` | `dict[K, V]` | 可变 |
| `Map<K, V>` | `dict[K, V]` | 可变（Python dict 即 Map） |
| `Set<T>` | `set[T]` | 可变 |
| `ReadonlySet<T>` | `frozenset[T]` | 不可变 |

## 1.7 解构与展开

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

# dict 没有解构语法，直接取值
name = d["name"]

# 展开
merged = {**obj1, **obj2}             # dict 展开用 **
combined = [*arr1, *arr2]             # list 展开用 *

# Python 3.12+：更多展开场景
merged = obj1 | obj2                  # dict 合并运算符
```

## 1.8 定义数据结构的四种方式

这是 TS 开发者最困惑的地方——Python 有多种方式定义"数据对象"。

```typescript
// TypeScript — 就一种主流方式
interface User {
  id: string;
  name: string;
  age: number;
  email?: string;
}
```

Python 有四种，各有适用场景：

```python
# 方式 1: TypedDict — 最像 TS interface，给 dict 加类型
from typing import TypedDict

class User(TypedDict, total=False):
    id: str          # required（total=False 时需要用 Required[]）
    name: str
    age: int
    email: str       # optional（因为 total=False）

# 用法：就是个 dict
user: User = {"id": "1", "name": "Alice", "age": 30}
user["name"]  # 和普通 dict 一样访问
```

```python
# 方式 2: dataclass — 最像传统 OOP class，自动生成 __init__/__repr__/__eq__
from dataclasses import dataclass, field

@dataclass
class User:
    id: str
    name: str
    age: int
    email: str | None = None

# 用法：用构造函数
user = User(id="1", name="Alice", age=30)
user.name           # 属性访问
user.email = "a@b"  # 可变
```

```python
# 方式 3: Pydantic BaseModel — 带运行时校验的 dataclass（推荐用于 API 边界）
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    id: str
    name: str
    age: int
    email: EmailStr | None = None

# 用法：构造时自动校验
user = User(id="1", name="Alice", age=30)
user = User(id="1", name="Alice", age="abc")  # 运行时 ValidationError!

# 序列化
user.model_dump()       # → dict
user.model_dump_json()  # → JSON string
```

```python
# 方式 4: Protocol — 最像 TS interface 的"结构化类型"（鸭子类型）
from typing import Protocol

class HasName(Protocol):
    name: str
    def greet(self) -> str: ...

# 任何有 name 属性和 greet 方法的对象都满足 HasName，无需显式 implements
class Dog:
    def __init__(self, name: str):
        self.name = name
    def greet(self) -> str:
        return f"Woof, I'm {self.name}"

def hello(thing: HasName) -> None:
    print(thing.greet())

hello(Dog("Rex"))  # OK — Dog 结构上满足 HasName
```

**选择指南：**

| 场景 | 用什么 | 为什么 |
|------|--------|--------|
| API 请求/响应、数据库 model、配置 | **Pydantic BaseModel** | 运行时校验 + 序列化 |
| 纯内部数据传输（DTO） | **dataclass** | 轻量，无运行时开销 |
| 给已有 dict 加类型提示 | **TypedDict** | 最小侵入 |
| 定义抽象接口 | **Protocol** | 结构化子类型 |

## 1.9 Class

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
        self.species: str = species      # public（Python 没有真正的 private）
        self._name: str = name           # 约定：单下划线 = "请勿直接访问"

    @property                            # getter
    def name(self) -> str:
        return self._name

    @name.setter                         # setter
    def name(self, value: str) -> None:
        self._name = value

    def __str__(self) -> str:            # toString() 等价
        return f"{self.species}: {self._name}"

    def __repr__(self) -> str:           # 调试输出，JS 没有对应
        return f"Animal({self.species!r}, {self._name!r})"

    def __eq__(self, other: object) -> bool:  # == 运算符
        if not isinstance(other, Animal):
            return NotImplemented
        return self.species == other.species and self._name == other._name

    def __hash__(self) -> int:           # 可用作 dict key / set 元素
        return hash((self.species, self._name))

    @staticmethod                        # 不需要 cls 或 self
    def create(species: str, name: str) -> "Animal":
        return Animal(species, name)

    @classmethod                         # 第一个参数是类本身（TS 没有）
    def from_string(cls, s: str) -> "Animal":
        species, name = s.split(":")
        return cls(species.strip(), name.strip())
```

**`self` vs `this`：**
- TS 的 `this` 是隐式的，Python 的 `self` 必须显式写在第一个参数
- `self` 只是约定名称，叫 `this` 也行（但没人这么干）
- `@classmethod` 的第一个参数是 `cls`（类本身），用于实现工厂方法和继承链中的正确构造

**常用 dunder methods（魔法方法）：**

| Python | TypeScript 等价 | 用途 |
|--------|----------------|------|
| `__init__` | `constructor` | 初始化 |
| `__str__` | `toString()` | 给用户看的字符串 |
| `__repr__` | 无 | 给开发者看的字符串 |
| `__eq__` | 需手动实现 | `==` 运算符 |
| `__hash__` | 无 | 可哈希（用作 dict key） |
| `__len__` | `.length` | `len(obj)` |
| `__getitem__` | `[index]` | `obj[key]` |
| `__iter__` | `[Symbol.iterator]` | `for x in obj` |
| `__enter__/__exit__` | 无 | `with` 语句 |
| `__call__` | 无 | `obj()` 使实例可调用 |

## 1.10 枚举

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

# StrEnum（3.11+）——最接近 TS 的字符串枚举
class Status(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"

def check(s: Status) -> None:
    if s == Status.ACTIVE:
        ...

# StrEnum 可以直接当 str 用
print(f"status is {Status.ACTIVE}")  # "status is active"

# 普通 Enum（非字符串）
class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3
```

## 1.11 错误处理

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

## 1.12 异步编程

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

## 1.13 迭代与函数式操作

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

## 1.14 模块与导入

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

## 1.15 空值处理

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

## 1.16 模式匹配

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

## 1.17 装饰器

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

## 1.18 上下文管理器（with 语句）

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

## 1.19 常用标准库

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

---

# Part 2: 工程项目对照

## 工具栈总览：TS 强类型工程 vs Python 强类型工程

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

## 2.1 包管理器

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

## 2.2 依赖声明

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

## 2.3 虚拟环境

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

## 2.4 类型检查

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

## 2.5 代码格式化与检查

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

## 2.6 Python 版本管理

```bash
# TypeScript 用 nvm 管理 Node 版本
nvm install 20
nvm use 20

# Python — uv 内置版本管理（也可用 pyenv）
uv python install 3.12        # 安装 Python 3.12
uv python pin 3.12             # 项目锁定版本（写入 .python-version）
```

## 2.7 测试

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

## 2.8 项目结构

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

## 2.9 命名规范

| 场景 | TypeScript | Python (PEP 8) |
|------|-----------|----------------|
| 变量 / 函数 | `camelCase` | `snake_case` |
| 类 | `PascalCase` | `PascalCase` |
| 常量 | `UPPER_CASE` | `UPPER_CASE` |
| 文件名 | `camelCase.ts` 或 `kebab-case.ts` | `snake_case.py` |
| 包/目录 | `kebab-case` | `snake_case`（不能有连字符） |
| private | `#field` 或 `_field` | `_field`（约定）/ `__field`（name mangling） |
| 布尔变量 | `isActive` | `is_active` |

## 2.10 Pre-commit & CI

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

---

# Part 3: 生态对照

## 3.1 常用库对照表

| 类别 | TypeScript | Python | 备注 |
|------|-----------|--------|------|
| HTTP 框架 | Express / Fastify / Hono | **FastAPI** / Flask | FastAPI 自带 OpenAPI 文档 |
| ORM | Prisma / Drizzle | **SQLAlchemy 2.0** | SA 2.0 支持类型注解 |
| 数据校验 | Zod / Yup | **Pydantic v2** | Pydantic = Zod + 更多 |
| HTTP 客户端 | fetch / axios | **httpx** / requests | httpx 支持 sync + async |
| 任务队列 | BullMQ | **Celery** / arq | |
| WebSocket | ws / socket.io | websockets / python-socketio | |
| CLI 框架 | Commander / yargs | **typer** / click | typer 基于类型注解 |
| 环境配置 | dotenv | **pydantic-settings** | 类型安全的配置 |
| 日志 | pino / winston | **structlog** / loguru | |
| 定时任务 | node-cron | APScheduler | |
| JWT | jsonwebtoken | PyJWT | |
| LLM SDK | @anthropic-ai/sdk | **anthropic** | |
| AI 编排 | LangChain.js / Vercel AI | **LangChain** / LlamaIndex | Python 生态远更成熟 |
| Embedding | — | sentence-transformers | |
| 向量数据库 | — | chromadb / pgvector | |
| 数据处理 | — | **pandas** / polars | Python 独有优势 |

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
    name: str                     # Pydantic 自动校验
    age: int

class UserResponse(BaseModel):
    id: str
    name: str
    age: int

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate) -> UserResponse:
    # 请求体自动解析 + 校验，失败自动返回 422
    return UserResponse(id="1", name=user.name, age=user.age)

@app.get("/users/{user_id}")
async def get_user(user_id: str) -> UserResponse:
    return UserResponse(id=user_id, name="Alice", age=30)

# 运行：uvicorn main:app --reload
# 自动生成交互式 API 文档：http://localhost:8000/docs
```

**FastAPI 的优势**：
- 请求参数校验是声明式的（Pydantic model），不需要手动 `safeParse`
- 自动生成 OpenAPI 文档 + Swagger UI
- 原生 async，性能接近 Go
- 返回值类型注解直接成为响应 schema

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

# 校验 — 失败抛 ValidationError
user = User.model_validate(input_dict)
# 或直接构造
user = User(name="Alice", email="a@b.com", age=30, role="admin")

# 序列化
user.model_dump()        # → dict
user.model_dump_json()   # → JSON string

# 从 JSON 反序列化
user = User.model_validate_json('{"name": "Alice", ...}')
```

**Pydantic vs Zod 区别**：Pydantic 的 schema 就是 Python class（不需要 `z.infer`），类型定义和校验规则是同一个东西。

## 3.4 SQLAlchemy vs Prisma

```typescript
// Prisma — schema 文件（DSL）
// prisma/schema.prisma
// model User {
//   id    String @id @default(uuid())
//   name  String
//   email String @unique
//   posts Post[]
// }

// 查询
const user = await prisma.user.findUnique({ where: { id: "1" } });
const users = await prisma.user.findMany({
  where: { name: { contains: "Ali" } },
  include: { posts: true },
});
```

```python
# SQLAlchemy 2.0 — 用 Python class 定义 schema
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

# 查询
from sqlalchemy import select

stmt = select(User).where(User.id == "1")
user = session.scalars(stmt).one()

stmt = select(User).where(User.name.contains("Ali"))
users = session.scalars(stmt).all()
```

**SQLAlchemy vs Prisma**：SA 更底层、更灵活（支持复杂 JOIN、子查询、原生 SQL），学习曲线更陡。Prisma 的类型安全查询构造器在 SA 2.0 中通过 `Mapped[]` 注解也基本实现了。

数据库迁移用 **Alembic**（等价于 Prisma Migrate）：

```bash
uv add alembic
alembic init migrations
alembic revision --autogenerate -m "add users table"
alembic upgrade head
```

## 3.5 Docker 打包

```dockerfile
# TypeScript — 典型 Node Dockerfile
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
# Python — 用 uv 的多阶段构建
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

# uv 创建的 venv 在 .venv 目录
ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "my_app"]
```

---

# Part 4: 踩坑指南

## 4.1 可变默认参数陷阱

这是 Python 最臭名昭著的坑，TS 不会有这个问题。

```python
# 错误 — 默认值 [] 在函数定义时创建一次，所有调用共享同一个 list
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

add_item("a")  # ["a"]
add_item("b")  # ["a", "b"] — 不是 ["b"]！！！

# 正确
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

**规则**：永远不要用可变对象（list, dict, set）作为函数默认值。用 `None` 代替。

## 4.2 `is` vs `==`

```python
# == 比较值（类似 JS 的 ===，但不比较类型）
# is 比较对象身份（内存地址）

a = [1, 2, 3]
b = [1, 2, 3]
a == b    # True — 值相同
a is b    # False — 不是同一个对象

# 只在这些场景用 is：
x is None         # 判断 None（不要用 == None）
x is True         # 判断布尔值（罕见）
type(x) is int    # 判断精确类型（通常用 isinstance 代替）
```

## 4.3 引用传递

```python
# list 和 dict 赋值不会复制，只是创建引用（JS 也一样，但容易忘）
a = [1, 2, 3]
b = a           # b 和 a 指向同一个 list
b.append(4)
print(a)        # [1, 2, 3, 4] — a 也变了！

# 需要复制时：
b = a.copy()            # 浅拷贝
b = list(a)             # 浅拷贝
b = a[:]                # 浅拷贝（切片语法）

import copy
b = copy.deepcopy(a)    # 深拷贝（嵌套结构）
```

## 4.4 GIL 与并发

Python 的 GIL（全局解释器锁）是 TS 开发者最困惑的概念。

```
TypeScript (Node.js):
  单线程 + 事件循环 → 天然不需要锁
  CPU 密集 → Worker Threads

Python:
  多线程存在，但 GIL 让它们无法真正并行执行 Python 代码
  IO 密集 → asyncio（类似 Node.js 的事件循环）或 threading
  CPU 密集 → multiprocessing（多进程，绕过 GIL）
```

```python
# IO 密集任务 — 用 asyncio（最接近 Node.js 的模型）
import asyncio

async def fetch_all(urls: list[str]) -> list[str]:
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.text for r in responses]

# CPU 密集任务 — 用 multiprocessing
from concurrent.futures import ProcessPoolExecutor

def heavy_compute(data: bytes) -> int:
    return len(data)  # 模拟

with ProcessPoolExecutor() as pool:
    results = list(pool.map(heavy_compute, chunks))
```

> Python 3.13 引入了实验性的 free-threaded 模式（无 GIL），未来这个问题会逐渐消失。

## 4.5 没有块级作用域

```python
# Python 变量会"泄漏"出 if/for 块（TS/JS 的 let/const 不会）
for i in range(5):
    x = i * 2

print(i)    # 4 — 循环变量在循环外仍然可用
print(x)    # 8

if True:
    y = 42
print(y)    # 42 — if 块内的变量在外面可用

# Python 的作用域只有：函数、类、模块、推导式
# 推导式有自己的作用域：
result = [x for x in range(5)]
# print(x)  — 这里的 x 来自上面的 for 循环，不是推导式里的 x
```

## 4.6 循环导入

```python
# a.py
from b import B     # 导入 b
class A:
    def get_b(self) -> B: ...

# b.py
from a import A     # 导入 a → 循环导入！ImportError
class B:
    def get_a(self) -> A: ...

# 解决方案 1: TYPE_CHECKING（最常用）
from __future__ import annotations   # 使所有注解变成字符串（延迟求值）
from typing import TYPE_CHECKING

if TYPE_CHECKING:                    # 运行时为 False，只在 mypy 检查时为 True
    from a import A

class B:
    def get_a(self) -> A: ...        # 运行时 A 是字符串 "A"，不会触发导入

# 解决方案 2: 把共享类型提到第三个文件
```

## 4.7 Truthiness 差异

```python
# Python 的 falsy 值比 JS 多：
# False, None, 0, 0.0, "", [], {}, set(), (), 0j

# 注意：JS 中 [] 和 {} 是 truthy，Python 中是 falsy！
if []:
    print("won't print")     # 空 list 是 falsy

if {}:
    print("won't print")     # 空 dict 是 falsy

# 这会造成 bug：
def process(items: list[str] | None = None) -> None:
    if not items:             # 空 list 也会进这个分支！
        items = get_defaults()

    # 应该明确判断 None：
    if items is None:
        items = get_defaults()
```

## 4.8 `__init__.py` 与包发现

```python
# 没有 __init__.py 的目录不是 Python 包（在某些配置下）
# uv / pytest 默认用 "namespace packages"，可以没有 __init__.py
# 但建议总是加上，避免奇怪的导入问题

# __init__.py 的作用：
# 1. 声明目录是一个包
# 2. 控制 re-export（类似 index.ts）
# 3. 包级别的初始化代码

# my_app/__init__.py
from .models import User, Entity     # re-export
from .main import app

__all__ = ["User", "Entity", "app"]  # 控制 * 导入
__version__ = "1.0.0"                # 包版本
```

## 4.9 整数除法

```python
# Python 3 的除法和 JS 不同
10 / 3     # 3.3333...（浮点除法，和 JS 一样）
10 // 3    # 3（整数除法，JS 没有）
10 % 3     # 1（取余，和 JS 一样）

# Python 没有 JS 的浮点数精度问题（整数任意精度）
2 ** 100   # 1267650600228229401496703205376（JS 中会溢出）
```

## 4.10 切片语法

这是 Python 独有的强大特性，JS/TS 没有。

```python
arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

arr[2:5]      # [2, 3, 4]        — 从索引 2 到 5（不含 5）
arr[:3]       # [0, 1, 2]        — 前 3 个
arr[-3:]      # [7, 8, 9]        — 后 3 个
arr[::2]      # [0, 2, 4, 6, 8]  — 每隔一个取
arr[::-1]     # [9, 8, ..., 0]   — 反转

# 字符串也支持切片
"Hello"[1:4]  # "ell"

# 切片赋值（修改 list 的一段）
arr[2:5] = [20, 30, 40]
```

---

# Part 5: 学习路线

## Week 1：语言基础

- 安装 uv，创建第一个项目 `uv init`
- 阅读本指南 Part 1，边看边在 REPL（`uv run python`）中实验
- 重点掌握：类型注解、f-string、列表推导式、Pydantic BaseModel
- 把现有一个简单的 TS 工具函数翻译成 Python

## Week 2：工程化

- 配置 mypy strict + ruff + pytest（参照 Part 2）
- 写第一个 Pydantic model + pytest 测试
- 理解虚拟环境和 `pyproject.toml`
- 配置 pre-commit hooks

## Week 3：Web 开发

- 用 FastAPI 写一个 CRUD API
- 用 Pydantic 做请求校验
- 用 SQLAlchemy 2.0 连数据库
- 用 Alembic 做数据库迁移
- 写 pytest 测试（用 httpx TestClient）

## Week 4：异步与实战

- 理解 asyncio 事件循环
- 用 httpx.AsyncClient 做异步 HTTP 请求
- 在 FastAPI 中使用依赖注入（`Depends`）
- Docker 打包部署

## 持续参考

| 资源 | 用途 |
|------|------|
| [Python 官方文档](https://docs.python.org/3/) | 标准库参考 |
| [mypy 文档](https://mypy.readthedocs.io/) | 类型系统深入 |
| [FastAPI 教程](https://fastapi.tiangolo.com/tutorial/) | Web 框架（交互式教程非常好） |
| [Pydantic 文档](https://docs.pydantic.dev/) | 数据校验 |
| [SQLAlchemy 2.0 教程](https://docs.sqlalchemy.org/en/20/tutorial/) | ORM |
| [Real Python](https://realpython.com/) | 高质量 Python 教程站 |
