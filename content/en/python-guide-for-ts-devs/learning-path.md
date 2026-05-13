# 8. Learning Path

A four-week plan for going from "I read this guide" to "I can ship a typed Python service." Each week is a deliberate slice — language, tooling, web stack, async/prod — so you build the same kind of mental model you have for TS, in roughly the same order you originally built the TS one.

## Week 1: Language Basics

- Install uv, create your first project with `uv init`
- Read Part 1 of this guide, experimenting in the REPL (`uv run python`) as you go
- Focus on: type annotations, f-strings, list comprehensions, Pydantic BaseModel
- Translate an existing simple TS utility function into Python

## Week 2: Engineering Setup

- Configure mypy strict + ruff + pytest (following the Engineering Stack page)
- Write your first Pydantic model + pytest test
- Understand virtual environments and `pyproject.toml`
- Set up pre-commit hooks

## Week 3: Web Development

- Build a CRUD API with FastAPI
- Use Pydantic for request validation
- Connect to a database with SQLAlchemy 2.0
- Run database migrations with Alembic
- Write pytest tests (using httpx TestClient)

## Week 4: Async & Production

- Understand the asyncio event loop
- Make async HTTP requests with httpx.AsyncClient
- Use dependency injection in FastAPI (`Depends`)
- Docker packaging and deployment

## Ongoing References

| Resource | Purpose |
|----------|---------|
| [Python Official Docs](https://docs.python.org/3/) | Standard library reference |
| [mypy Docs](https://mypy.readthedocs.io/) | Deep dive into the type system |
| [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/) | Web framework (excellent interactive tutorial) |
| [Pydantic Docs](https://docs.pydantic.dev/) | Data validation |
| [SQLAlchemy 2.0 Tutorial](https://docs.sqlalchemy.org/en/20/tutorial/) | ORM |
| [Real Python](https://realpython.com/) | High-quality Python tutorials |

Once Python feels like a working environment rather than a foreign language, the rest of this book stops being about syntax and starts being about LLMs. The next chapter — GPU and model sizing — is the first place we leave general-purpose engineering and start dealing with what's specific to running models.

Next: [GPU & Model Sizing →](../gpu-and-model-sizing)
