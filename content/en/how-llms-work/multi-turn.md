# 4. Multi-Turn Conversations — The Model Is Stateless

This is the single most important section in this chapter for a frontend developer to internalize.

> **The model has no memory between API calls.** It is a pure function: tokens in -> distribution out. Two consecutive calls share no state.

Multi-turn chat works because the **client** (your app, ChatGPT's UI, the SDK) **sends the entire conversation history with every single request**.

## What Turn 3 Actually Looks Like

Imagine a three-turn conversation. You think it's:

```
Turn 1: user says A, model says B
Turn 2: user says C, model says D
Turn 3: user says E, model says F
```

What actually goes over the wire on turn 3:

```jsonc
// POST /v1/chat/completions  (turn 3 request)
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system",    "content": "You are a helpful assistant." },
    { "role": "user",      "content": "A" },   // turn 1 user
    { "role": "assistant", "content": "B" },   // turn 1 model reply, replayed by client
    { "role": "user",      "content": "C" },   // turn 2 user
    { "role": "assistant", "content": "D" },   // turn 2 model reply, replayed by client
    { "role": "user",      "content": "E" }    // turn 3 user (the only "new" message)
  ]
}
```

The client is sending all six messages every turn. The server-side model has no idea this is "turn 3" — as far as the model is concerned, this is a single forward pass over a long token sequence, ending with an empty assistant slot for it to fill.

If you stopped sending the prior turns, the model would have no idea what you were talking about. It is not "remembering" you between calls. The transcript is the memory, and the client maintains it.

## Why This Matters

Three direct consequences:

**1. Every turn is more expensive than the last.** Input grows monotonically. By turn 20 of a long conversation, your prompt might be 50K tokens — every one of them billed, every one of them processed by the model on every turn. This is why a "long chat" conversation can have surprisingly high cost despite each user message being short.

**2. Conversation history is your problem.** The server doesn't store it (with rare opt-in exceptions like OpenAI's stateful Assistants API or Anthropic's beta Memory feature). If your tab reloads and you don't have local state, the conversation is gone. This is why you need a database the moment you build a real chat app, even if the LLM API itself is "stateless and free."

**3. You decide what counts as "history."** You are not obligated to send the full transcript. You can:
- Truncate old turns (drop the oldest messages once context is filling up).
- Summarize old turns (replace 20 messages with a 200-token summary written by the model itself).
- Selectively retrieve relevant past messages (proto-RAG over conversation history).
- Inject system-side information (tool outputs, retrieved documents) as messages.

The `messages` array is your scratchpad. The model's "memory" is whatever you put there.

## Forward Reference

Two later chapters build directly on this:

- **Chapter 2 (LLM APIs and Prompt Engineering)** is largely about how to design `messages` arrays well — what to put in the system role, how to manage history, how to inject tool results, how to structure few-shot examples.
- **Chapters 7 (KV Cache) and 8 (Inference Concurrency)** address the "growing prompt" cost problem. Even though you re-send the whole history every turn, the inference engine can recognize the shared prefix and reuse the cached intermediate state for it instead of recomputing from scratch. This is called **prefix caching**, and it's why "growing prompts" are not as catastrophic as they sound — but the fact that the optimization exists is itself evidence that yes, you are conceptually re-sending the whole transcript every time.

Next: [Context Window →](./context-window)
