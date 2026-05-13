# 1. The Shape of an LLM API Call

In Chapter 0 §4 we showed the `messages` array conceptually. Now we send it.

A chat completion is a single HTTPS request. It carries a list of messages with role markers, optional sampling parameters, and a model identifier. The response carries the model's continuation, plus metadata you'll learn to care about.

## OpenAI: Chat Completions

```python
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY from env

resp = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user",   "content": "What is the capital of France?"},
    ],
    temperature=0.2,
    max_tokens=128,
)

print(resp.choices[0].message.content)
# -> "Paris."
```

What you got back, trimmed:

```python
ChatCompletion(
    id="chatcmpl-9xY...",
    model="gpt-4.1-2025-04-14",
    choices=[
        Choice(
            index=0,
            finish_reason="stop",
            message=ChatCompletionMessage(role="assistant", content="Paris."),
        ),
    ],
    usage=CompletionUsage(
        prompt_tokens=23,
        completion_tokens=2,
        total_tokens=25,
    ),
)
```

Three fields matter most:

- `choices[0].message.content` — the text the model generated.
- `usage` — input and output token counts. **This is how you measure cost** ([§8](./cost-and-latency)). Log it on every call.
- `choices[0].finish_reason` — `"stop"` is normal completion; `"length"` means you hit `max_tokens`; `"tool_calls"` means the model wants to call a function ([§6](./tool-use)).

## Anthropic: Messages

```python
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

resp = client.messages.create(
    model="claude-sonnet-4-6",
    system="You are a concise assistant.",
    messages=[
        {"role": "user", "content": "What is the capital of France?"},
    ],
    temperature=0.2,
    max_tokens=128,
)

print(resp.content[0].text)
# -> "Paris."
```

And the response:

```python
Message(
    id="msg_01ABC...",
    model="claude-sonnet-4-6",
    role="assistant",
    stop_reason="end_turn",
    content=[TextBlock(type="text", text="Paris.")],
    usage=Usage(input_tokens=18, output_tokens=2),
)
```

## Side-by-Side: What's Universal vs. Vendor-Specific

| Concept | OpenAI | Anthropic | Universal? |
|---|---|---|---|
| Model identifier | `model="gpt-4.1"` | `model="claude-sonnet-4-6"` | Yes — every provider has this |
| System prompt | First message with `role: "system"` | Top-level `system=` parameter | Concept yes, location no |
| User / assistant turns | `messages=[{role, content}, ...]` | `messages=[{role, content}, ...]` | Yes |
| Sampling controls | `temperature`, `top_p`, `frequency_penalty`, ... | `temperature`, `top_p`, `top_k` | Mostly yes |
| Output cap | `max_tokens` | `max_tokens` (required) | Yes |
| Token usage in response | `usage.prompt_tokens` / `completion_tokens` | `usage.input_tokens` / `output_tokens` | Concept yes, names differ |
| Stop reason | `finish_reason` (`stop`, `length`, `tool_calls`) | `stop_reason` (`end_turn`, `max_tokens`, `tool_use`) | Concept yes, values differ |
| Response shape | `choices[].message.content` (string) | `content[]` array of typed blocks | No — Anthropic's content is a list of blocks (text, tool\_use, image, ...) from day one |

The mental model is identical: you build a list of messages, you send it, you read the model's continuation and its usage stats. The bytes on the wire differ, but you can write a thin adapter and swap providers in an afternoon. Most production teams do exactly that — keep a small abstraction over both, fall back from one to the other on rate limits or outages.

## Why the messages array maps onto Chapter 0

When you send `messages=[{role: "system", content: "..."}, {role: "user", content: "..."}]`, the SDK does not send JSON to the model. It renders your messages into one big tokenized string using the model's chat template (Chapter 0 §3), ending right after the assistant role marker. The model continues from there until it emits a stop token. The `messages` array is a structured way to write the same prompt the model has been trained to continue from.

Next: [Choosing a Provider →](./choosing-provider)
