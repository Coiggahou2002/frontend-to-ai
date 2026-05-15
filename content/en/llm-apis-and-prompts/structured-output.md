# 5. Structured Output

Real systems don't want prose. They want data: a JSON object their next function can consume. Three levels of "make the model produce JSON," from weakest to strongest.

## Level 1: Ask Nicely (Don't)

```text
Respond ONLY with valid JSON. Do not include markdown fences. The schema is...
```

This works most of the time, with a low-temperature model, with a careful prompt. It also fails 1–5% of the time — extra prose around the JSON, a stray markdown fence, a hallucinated field, a trailing comma. At any meaningful scale that failure rate is unacceptable. **Don't rely on prompt-based JSON.**

## Level 2: JSON Mode

OpenAI exposes `response_format={"type": "json_object"}`. The decoder is constrained at the token level so it can only emit characters that form syntactically valid JSON. You still need to describe your schema in the prompt, but the output is guaranteed to parse.

```python
resp = client.chat.completions.create(
    model="gpt-4.1",
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": "Respond as JSON: { city, country, population }."},
        {"role": "user",   "content": "Tokyo"},
    ],
)
data = json.loads(resp.choices[0].message.content)
```

JSON mode guarantees parseability. It does **not** guarantee the JSON has the right keys, the right types, or the right shape. The model can still hallucinate `{"location": "Tokyo"}` instead of `{"city": "Tokyo", ...}`.

## Level 3: Schema-Constrained Generation

This is the real answer. You define a schema (JSON Schema or, more commonly, a Pydantic model). The provider's decoder is constrained at every step to only emit tokens that keep the output valid against the schema. The output is **guaranteed by construction** to match the schema's shape, types, and required fields.

A frontend dev knows Zod from TypeScript. **Pydantic is Python's Zod**: declarative schemas with runtime validation, IDE-friendly types, and integration with everything in the Python ecosystem (FastAPI, agents, ORMs).

```python
from pydantic import BaseModel, Field
from typing import Literal

class TicketTriage(BaseModel):
    severity: Literal["low", "medium", "high", "critical"]
    summary: str = Field(..., max_length=200)
    next_actions: list[str] = Field(..., min_length=1, max_length=5)
    needs_human: bool
```

### OpenAI Structured Outputs

```python
resp = client.chat.completions.parse(
    model="gpt-4.1",
    response_format=TicketTriage,
    messages=[
        {"role": "system", "content": "Triage support tickets into the schema."},
        {"role": "user",   "content": ticket_text},
    ],
)
triage: TicketTriage = resp.choices[0].message.parsed
print(triage.severity, triage.summary)
```

`parse` is a convenience wrapper. Under the hood OpenAI converts the Pydantic model to JSON Schema, sends it as the `response_format`, gets back a guaranteed-valid JSON string, and parses it back into the Pydantic instance. You write a Python class, you get a Python instance — the JSON wire format is invisible.

### Anthropic: Tool-Use as Structured Output

Anthropic doesn't have a separate "structured output" mode. Instead, they overload **tool use**: declare a "tool" whose input schema is your desired output shape, and ask the model to call it. The model returns a `tool_use` block whose `input` field matches your schema exactly.

```python
import anthropic, json

triage_tool = {
    "name": "submit_triage",
    "description": "Submit triage for a support ticket.",
    "input_schema": TicketTriage.model_json_schema(),
}

resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=512,
    tools=[triage_tool],
    tool_choice={"type": "tool", "name": "submit_triage"},  # force the call
    messages=[{"role": "user", "content": ticket_text}],
)

tool_use_block = next(b for b in resp.content if b.type == "tool_use")
triage = TicketTriage.model_validate(tool_use_block.input)
```

Different mechanism, same outcome: a Pydantic instance you can pass to your downstream code with confidence.

## Self-Hosted Equivalents

If you serve open models on vLLM or SGLang, you have first-class structured output too — using libraries like **outlines** or **lm-format-enforcer**, or vLLM's built-in `guided_json` parameter. These libraries do the same thing closed-API providers do internally: at every decoding step, mask out tokens that would violate the schema. We'll touch on the inference-server side in Chapter 8.

## Why This Matters Beyond the Current Chapter

Schema-constrained output is a building block for two later chapters:

- **Chapter 3 (RAG)** — when the user asks "What did our Q3 numbers look like?", a RAG system often first asks the model to produce a structured query plan (entities to look up, time range, sub-questions). That plan goes to a Pydantic schema, the schema goes to the retriever, and reliable retrieval depends on reliable plan structure.
- **Chapter 4 (Agents)** — every tool call is, fundamentally, a schema-constrained generation. The model writes a JSON object that matches the tool's input schema, your code parses and dispatches.

If you've ever shipped a `JSON.parse` that throws once a week in production, this section is the thing you wished you had.

Next: [Function Calling / Tool Use →](./tool-use)
