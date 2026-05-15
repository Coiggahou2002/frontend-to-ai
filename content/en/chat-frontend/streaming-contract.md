# 1. The Streaming Contract

In [Chapter 2 §7](../llm-apis-and-prompts/streaming) you saw streaming from the backend's perspective — Python SDKs iterating over token deltas. This section flips to the browser. What protocol carries those tokens, why was it chosen, and how do you consume it in TypeScript?

## SSE vs WebSocket

Every major LLM API (OpenAI, Anthropic, Google, Mistral) streams responses over **Server-Sent Events (SSE)**, not WebSockets. This is a deliberate choice, not a limitation:

| Factor | SSE | WebSocket |
|--------|-----|-----------|
| Direction | Server → client (unidirectional) | Bidirectional |
| Transport | Plain HTTP — works with CDNs, proxies, load balancers | Upgrade handshake — some proxies choke |
| Reconnection | Built into the spec (`Last-Event-ID`, auto-retry) | You build it yourself |
| Auth | Standard `Authorization` header (with `fetch`) | Token-in-URL or first-message auth hack |
| Infra complexity | Zero — it's just an HTTP response | Connection-state server, sticky sessions |

LLM inference is inherently request-response: you send a prompt, you get a stream of tokens back. That's unidirectional. SSE fits perfectly. WebSocket's bidirectional channel is overhead you don't need.

## The SSE Protocol in 30 Seconds

An SSE response has `Content-Type: text/event-stream` and a body that looks like this:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01X",...}}

data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}

event: message_stop
data: {"type":"message_stop"}

```

Rules: each field is `field: value\n`. Blocks are separated by a blank line (`\n\n`). The `data` field carries the payload. The `event` field is optional — if omitted, the event type defaults to `"message"`. That's the entire protocol.

## Consuming SSE in the Browser

### Option A: `EventSource`

The browser has a built-in `EventSource` API:

```typescript
const es = new EventSource("/api/chat");
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

Simple. But fatally limited for LLM APIs:

- **GET only.** You can't send a POST body with the conversation history.
- **No custom headers.** You can't set `Authorization: Bearer ...`.
- **No request body.** The entire prompt would have to be URL-encoded into query params.

For a trivial demo, `EventSource` works. For anything real, you need the next approach.

### Option B: `fetch()` + `ReadableStream` (the real approach)

`fetch()` gives you full control over the request method, headers, and body. The response body is a `ReadableStream` that you can read chunk by chunk:

```typescript
async function readSSE(url: string, body: object, onEvent: (data: string) => void) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // last element is incomplete — keep it

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return; // OpenAI convention
        onEvent(payload);
      }
    }
  }
}
```

This is the approach every production chat frontend uses. You'll see it wrapped in a React hook in [§2](./consuming-the-stream).

## Side-by-Side Comparison

| Capability | `EventSource` | `fetch` + `ReadableStream` |
|------------|---------------|----------------------------|
| HTTP method | GET only | Any (POST, PUT, etc.) |
| Custom headers | No | Yes |
| Request body | No | Yes |
| Auto-reconnect | Built-in | Manual (but you want manual control anyway) |
| Binary data | No | Yes |
| Cancellation | `es.close()` | `AbortController` |
| Browser support | All modern browsers | All modern browsers |
| Use for LLM APIs | No (can't POST the prompt) | Yes |

## When WebSocket IS the Right Choice

SSE covers LLM chat. But some features genuinely need bidirectional communication:

- **Voice / real-time audio.** The client streams audio chunks to the server while simultaneously receiving transcription or TTS audio back. OpenAI's Realtime API uses WebSocket for exactly this.
- **Collaborative editing.** Multiple users editing the same document need to push and receive changes simultaneously.
- **Multiplayer state sync.** Games, whiteboards, cursor presence — anything where both sides generate events at unpredictable times.

If your feature is "user sends a message, model responds with a stream," SSE is simpler, cheaper, and more reliable. Reach for WebSocket only when you genuinely need the client to push data *during* the server's response.

---

You now know what's on the wire. The next section covers what's *inside* those `data:` payloads — the event shapes from Anthropic and OpenAI — and how to turn them into a React-friendly message stream.

Next: [Consuming the Stream →](./consuming-the-stream)
