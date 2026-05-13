# 2. 数据建模与类

Python 的基本形状你已经看过了。下面是 TS 开发者真正会被绕晕的部分：Python 有**四种**定义"数据对象"的方式，选哪种取决于数据是不是要穿过外部边界、是只在内部用、还是只需要结构化类型。讲完这四种之后，再覆盖完整的 class（`self`、dunder 方法、property）和枚举。

## 2.1 定义数据结构的四种方式

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

## 2.2 Class

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

## 2.3 枚举

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

形状有了（数据类），行为也有了（普通类）。下一页讲 Python 怎么处理失败路径和并发——`try/except`、`asyncio`，以及取代 `.map`/`.filter` 链的推导式惯用法。

下一节: [错误与异步 →](./errors-and-async)
