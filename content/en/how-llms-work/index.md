# How LLMs Actually Work

Before you can build with LLMs, you need to know what an LLM actually does — mechanically, at the level of a single API call. Most of the confusion that frontend developers have about LLMs (Why does it forget? Why does it cost so much? Why is the answer different every time? Why is there a context limit?) comes from missing this foundation.

This chapter is the foundation. Six concepts:

1. [Tokens](./tokens) — what the model actually reads
2. [Next-token prediction](./next-token-prediction) — the entire mechanism
3. [From completion to chat](./completion-to-conversation) — how a "completion-only" model talks
4. [Multi-turn conversations](./multi-turn) — the model is stateless; the client replays history
5. [Context window](./context-window) — what 1M tokens actually feels like
6. [Sampling](./sampling) — temperature, top-p, and why the same prompt gives different answers

Once these are clear, everything else in this guide (RAG, agents, fine-tuning, KV cache, GPU sizing) becomes a question of "where does this fit on top of the basic loop." This chapter intentionally skips the internals of the transformer architecture — what matters is **what the model does**, not how the matrix multiplications are arranged inside it.

Closing: [Putting it all together](./putting-it-together) — one full API call, end to end, plus pointers into the rest of the book.

Next: [Tokens →](./tokens)
