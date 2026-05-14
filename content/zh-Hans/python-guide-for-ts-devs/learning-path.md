# 9. 学习路线

一个 4 周计划，从"读完这份指南"到"能上线一个有类型的 Python 服务"。每周一个刻意的切片——语言、工具、Web 栈、异步/生产——按和你当年搭建 TS 心智模型差不多的顺序，让你在 Python 上也搭起一套类似的心智模型。

## Week 1：语言基础

- 安装 uv，创建第一个项目 `uv init`
- 阅读本指南 Part 1，边看边在 REPL（`uv run python`）中实验
- 重点掌握：类型注解、f-string、列表推导式、Pydantic BaseModel
- 把现有一个简单的 TS 工具函数翻译成 Python

## Week 2：工程化

- 配置 mypy strict + ruff + pytest（参照工程化工具链一节）
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
| [Real Python](https://realpython.com/) | 高质量 Python 教程 |

一旦 Python 对你来说不再像是一门陌生语言、而是一个能干活的环境，这本书后面的内容就不再是关于语法的、而是开始关于 LLM 的了。下一章——GPU 与大模型选型——是我们离开通用工程、开始处理"跑模型这件事独有的东西"的第一站。

下一节: [GPU 与大模型选型 →](../gpu-and-model-sizing)
