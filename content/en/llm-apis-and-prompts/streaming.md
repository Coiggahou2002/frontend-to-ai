# 7. Streaming

For chat UIs, **time-to-first-token (TTFT)** matters more than total latency. A user who sees text appearing within 300 ms perceives the system as fast, even if the full response takes 8 seconds. A 4-second blank screen followed by 4 seconds of instant text feels broken, even though the total work is the same.

Streaming is the answer.

## How It Works

Under the hood, an LLM API streams responses over **Server-Sent Events (SSE)**. If you've used `EventSource` on the browser, you already know the protocol:

- One HTTP connection, kept open.
- Server sends `data: {...}\n\n` chunks as it has them.
- Connection closes when the response is complete.

Each chunk is one token (or a small handful of tokens, batched). The Python SDK exposes this as an iterator.

## A Streaming Request

```python
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a haiku about kubectl."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
    final = stream.get_final_message()

print()
print(final.usage)  # Usage(input_tokens=14, output_tokens=23)
```

OpenAI's flavor:

```python
stream = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "Write a haiku about kubectl."}],
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    delta = chunk.choices[0].delta if chunk.choices else None
    if delta and delta.content:
        print(delta.content, end="", flush=True)
print()
```

## Batch vs. Stream — When to Use Which

| Use case | Mode |
|---|---|
| Chat UI rendering tokens to a user | Stream |
| Backend pipeline (summarize, classify, extract) | Batch |
| Tool-using agent | Batch (each turn); stream the final text turn if shown to a user |
| Latency-sensitive endpoint where caller waits for the full result | Batch (streaming has slight overhead) |
| Voice / TTS pipeline (downstream wants tokens ASAP) | Stream |

The rule of thumb: **stream when a human is watching, batch when a function is.**

## Streaming + Tool Calls Is Fiddly

When a tool call is being generated, the model emits the JSON arguments token by token. Streaming gives you partial JSON: `{"ci`, then `ty": "T`, then `okyo"}`. You cannot parse it until it's complete. The SDKs help — Anthropic's `stream` exposes high-level events like `input_json_delta` that accumulate the JSON for you, and an `on_tool_use` callback that fires when the block is fully assembled. OpenAI exposes `delta.tool_calls` in chunks that you concatenate.

If you're streaming tool-using output to a UI, the practical pattern is:

1. Stream and render text deltas as they arrive (the user sees the assistant typing).
2. **Buffer** any tool-use deltas — don't show partial JSON to the user.
3. When a tool-use block is complete, dispatch it; show a "calling tool" indicator.
4. After the tool returns, start the next streaming turn.

## Forward Reference

Why is the second turn in a streaming chat so often faster than the first? The server has cached the KV state for the shared prefix between calls — system prompt, prior turns, retrieved context — and only has to do the prefill work for the new tokens. **Chapter 9 (KV Cache)** is the mechanism. **Chapter 10 (Inference Concurrency)** is how a serving stack manages that cache across many concurrent users.

Next: [Cost & Latency Basics →](./cost-and-latency)
