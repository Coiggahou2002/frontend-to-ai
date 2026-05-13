# Python Quick Start Guide — For TypeScript Developers

> This guide assumes you're already proficient in TypeScript / Node.js full-stack development, using that as an anchor to quickly build a Python mental model.

You don't need to learn Python from scratch. Most concepts you already have a TS equivalent for: classes, async/await, generics, modules, enums, decorators (sort of). The friction is rarely "what does this concept mean" — it's "what does Python call it, and which of its three ways of doing it should I pick." This chapter front-loads exactly that mapping.

The structure is deliberate: language features first, then engineering setup (the tools that make a typed Python project feel like a typed TS project), then ecosystem (FastAPI, Pydantic, SQLAlchemy), then the gotchas that trip up every TS dev, and finally a 4-week learning path.

## What's in this chapter

1. [Language Basics](./language-basics) — variables, types, functions, strings, data structures, destructuring
2. [Data Modeling & Classes](./data-modeling-and-classes) — TypedDict / dataclass / Pydantic / Protocol, classes, enums
3. [Errors & Async](./errors-and-async) — exception handling, asyncio, iteration & comprehensions
4. [Modules & Standard Library](./modules-and-stdlib) — imports, null handling, match/case, decorators, `with`, batteries included
5. [Engineering Stack](./engineering-stack) — uv, mypy, ruff, pytest, pre-commit, project layout
6. [Ecosystem](./ecosystem) — FastAPI vs Express, Pydantic vs Zod, SQLAlchemy vs Prisma, Docker
7. [Gotchas](./gotchas) — mutable defaults, GIL, scoping, circular imports, truthiness
8. [Learning Path](./learning-path) — a 4-week plan and reference list

Once these are in place, the rest of this book (LLM APIs, RAG, agents, GPU sizing, KV cache) lands in Python without surprises — which is what the next chapter, [GPU & Model Sizing](../gpu-and-model-sizing), starts assuming.

Next: [Language Basics →](./language-basics)
