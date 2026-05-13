# 4. System Prompts

You saw in Chapter 0 §3 that the system prompt is not a separate channel. It is text inside the rendered chat template, prefixed with a `system` role marker. Mechanically, the model sees `system said: ...` followed by `user said: ...` and continues from the assistant slot.

But the model was post-trained (Chapter 10) on millions of conversations where text in the system slot represented the operator's enduring instructions — a persona, a format, a policy. It learned to weight those instructions heavily and to keep applying them across many turns. So the system prompt **acts** stickier than a user message, even though there's no architectural enforcement.

The "even though" is important. A long, insistent user message can absolutely override the system prompt. We'll come back to this when we discuss prompt injection ([§9](./failure-modes)).

## Three Real-World Patterns

**1. Persona** — set the voice and expertise level.

```text
You are a senior code reviewer with deep experience in Python backend systems.
Be specific and direct. When you spot a bug, name it. When you spot a smell,
explain why it's a smell.
```

**2. Format constraint** — pin the output shape.

```text
Always respond in valid JSON matching this schema:
{ "severity": "low" | "medium" | "high" | "critical",
  "summary": string,
  "next_actions": string[] }
Do not include markdown fences or commentary outside the JSON.
```

(We'll see in [§5](./structured-output) that there are stronger ways to enforce this — schema-constrained generation. Format constraints in the system prompt are the weakest layer.)

**3. Behavioral guardrail** — handle the failure cases.

```text
If you do not have enough information to answer, reply exactly with:
"I don't know — please provide more context."
Do not guess. Do not invent function names, package names, or API endpoints.
```

Behavioral guardrails are how you fight hallucination at the prompt layer. They're not perfect, but they help — see [§9](./failure-modes).

## One Good Example, End to End

```python
SYSTEM = """
You are a senior code reviewer for a Python backend team.

For each change you review, produce exactly:
1. A one-sentence summary of what changed.
2. A bulleted list of issues, ordered by severity (critical -> nit).
   Each bullet starts with a tag in square brackets:
   [bug], [perf], [security], [style], [nit].
3. A final line: "LGTM" if there are no [bug] or [security] issues, otherwise "Request changes".

Rules:
- Be specific. Point to file and line if possible.
- Do not praise unless there's something genuinely notable.
- If you don't understand the code (missing context, unfamiliar framework),
  say so explicitly instead of guessing. Reply: "Need more context: <reason>".
""".strip()

def review(diff: str) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        temperature=0.1,
        system=SYSTEM,
        messages=[{"role": "user", "content": f"Review this diff:\n\n```diff\n{diff}\n```"}],
    )
    return resp.content[0].text
```

This system prompt does all three things: persona (senior reviewer), format constraint (numbered structure with tags), and guardrail (the "Need more context" escape hatch). Low temperature because we want the format respected, not improvised on.

Next: [Structured Output →](./structured-output)
