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

## `create` vs `stream` — The Two API Calls

Every LLM SDK gives you two ways to get a response. The difference is one HTTP behavior:

| | `messages.create(...)` | `messages.stream(...)` |
|---|---|---|
| HTTP behavior | Send request, wait, receive one JSON response | Send request, receive a stream of SSE events |
| Return type | `Message` object | Iterator / context manager yielding events |
| When you get the first token | After *all* tokens are generated | After the *first* token is generated |
| Use when | Backend pipelines, evals, batch classification | Chat UIs, voice pipelines, anything a human watches |

The request body is identical — same model, same messages, same parameters. The only difference is whether the server holds the connection open and pushes incremental results.

### Side-by-side: `create` vs `stream` (Anthropic Python SDK)

```python
import anthropic

client = anthropic.Anthropic()
params = dict(
    model="claude-sonnet-4-6",
    max_tokens=256,
    messages=[{"role": "user", "content": "Explain BGP in two sentences."}],
)

# ── Synchronous create ──────────────────────────────────
response = client.messages.create(**params)
print(response.content[0].text)   # full text, available only after generation completes
print(response.usage)             # Usage(input_tokens=..., output_tokens=...)

# ── Streaming ────────────────────────────────────────────
with client.messages.stream(**params) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)   # tokens arrive one-by-one
    final = stream.get_final_message()

print()
print(final.usage)                # same Usage object, available after stream ends
```

Both calls consume the same number of tokens and cost the same amount. The only trade-off is latency profile: `create` gives you nothing until everything is ready; `stream` gives you the first token in ~200-400 ms.

## SSE Event Types Under the Hood

When you stream, the raw HTTP response is a sequence of `data:` lines. Each SDK parses these into typed event objects, but knowing the raw shape helps when you're debugging with `curl` or writing a custom client.

**Anthropic event sequence:**

```
event: message_start       → { message: { id, model, usage: {input_tokens} } }
event: content_block_start → { index: 0, content_block: { type: "text", text: "" } }
event: content_block_delta → { index: 0, delta: { type: "text_delta", text: "BGP" } }
event: content_block_delta → { index: 0, delta: { type: "text_delta", text: " is" } }
  ... more content_block_delta events ...
event: content_block_stop  → { index: 0 }
event: message_delta       → { delta: { stop_reason: "end_turn" }, usage: {output_tokens} }
event: message_stop        → {}
```

Key points:
- `message_start` carries input token count (so you know cost before output begins).
- Each `content_block_delta` carries a small piece of text. Concatenate them.
- `message_delta` at the end carries `stop_reason` and `output_tokens`.
- If the model calls a tool, you'll see a `content_block_start` with `type: "tool_use"` and `content_block_delta` events with `type: "input_json_delta"` instead.

**OpenAI event sequence:**

```
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"role":"assistant","content":""},...}]}
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":"BGP"},...}]}
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":" is"},...}]}
  ... more data lines ...
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{...}}
data: [DONE]
```

Key points:
- Every line is `data: <json>`. No named event types — you distinguish by checking `delta.content`, `delta.tool_calls`, and `finish_reason`.
- Usage is only included in the final chunk, and only if you set `stream_options={"include_usage": True}`.
- The literal string `data: [DONE]` signals the stream is over.

Both protocols use standard SSE, so any language with an HTTP client can consume them — you don't need the official SDK. But the SDKs handle reconnection, parsing, and typed objects, so use them unless you have a reason not to.

Next: [Cost & Latency Basics →](./cost-and-latency)
