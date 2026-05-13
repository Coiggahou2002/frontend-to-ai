# 1. 语言基础

这一页讲 Python 语言每天会用到的表层：变量声明、类型注解、基本类型、函数、字符串、数据结构、解构。对一个 TS 开发者来说概念上没什么意外——但拼写和默认行为差得够多，值得过一遍，再把表格留着以后查。

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

这就把 Python 的基本形状走完了。下一页是真正有特色的地方：Python 有**四种**定义"数据对象"的方式（TypeScript 只有一种 `interface`），你需要知道什么时候用哪一种。

下一节: [数据建模与类 →](./data-modeling-and-classes)
