# Python 快速上手指南 — 写给 TypeScript 开发者

> 本指南假设你已经熟练掌握 TypeScript / Node.js 全栈开发，以此为锚点快速建立 Python 心智模型。

你不需要从零开始学 Python。绝大多数概念你都已经有 TS 的对应物了：class、async/await、泛型、模块、enum、装饰器（差不多）。真正的摩擦很少是"这个概念是什么意思"——而是"Python 把它叫什么名字、它的三种写法你该选哪一种"。本章就是把这种映射前置补齐。

章节结构是有意为之：先讲语言特性，再讲工程化（让一个强类型 Python 项目用起来像强类型 TS 项目的那一套工具），然后是生态（FastAPI / Pydantic / SQLAlchemy），再是每个 TS 开发者都会踩到的坑，最后一份四周学习路线。

## 本章内容

1. [语言基础](./language-basics) — 变量、类型、函数、字符串、数据结构、解构
2. [数据建模与类](./data-modeling-and-classes) — TypedDict / dataclass / Pydantic / Protocol、class、enum
3. [错误与异步](./errors-and-async) — 异常处理、asyncio、迭代与推导式
4. [模块与标准库](./modules-and-stdlib) — 导入、空值处理、match/case、装饰器、`with`、batteries included
5. [工程栈](./engineering-stack) — uv、mypy、ruff、pytest、pre-commit、项目布局
6. [生态](./ecosystem) — FastAPI vs Express、Pydantic vs Zod、SQLAlchemy vs Prisma、Docker
7. [踩坑指南](./gotchas) — 可变默认值、GIL、作用域、循环导入、truthiness
8. [学习路线](./learning-path) — 4 周计划与参考资料

把这一套搭起来后，本书剩下的内容（LLM API、RAG、Agent、GPU sizing、KV cache）在 Python 里就不会再有惊喜——下一章 [GPU & Model Sizing](../gpu-and-model-sizing) 正是从这里开始。

下一节：[语言基础 →](./language-basics)
