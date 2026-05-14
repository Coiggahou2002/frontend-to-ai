# 8. 踩坑指南

九件会各坑你一次的事。先扫一眼，遇到再认出来。最大的几个——可变默认值、没有块级作用域——不是你的代码 bug，而是 Python 和 Node.js 在你不会注意到的层面有差别造成的结果。（GIL 和并发有专门的章节，见第 4 章。）

## 8.1 可变默认参数陷阱

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

## 8.2 `is` vs `==`

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

## 8.3 引用传递

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

## 8.4 没有块级作用域

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

## 8.5 循环导入

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

## 8.6 Truthiness 差异

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

## 8.7 `__init__.py` 与包发现

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

## 8.8 整数除法

```python
# Python 3 的除法和 JS 不同
10 / 3     # 3.3333...（浮点除法，和 JS 一样）
10 // 3    # 3（整数除法，JS 没有）
10 % 3     # 1（取余，和 JS 一样）

# Python 没有 JS 的浮点数精度问题（整数任意精度）
2 ** 100   # 1267650600228229401496703205376（JS 中会溢出）
```

## 8.9 切片语法

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

完整清单就这些。任何一个一旦你知道它存在，概念上都不难——只是 TS 里不存在的几颗地雷。最后一页：一个 4 周的动手计划，加一份短的参考清单。

下一节: [学习路线 →](./learning-path)
