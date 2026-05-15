# 3. Prompt Engineering as Software Engineering

A prompt is code. It defines the behavior of your system. It has bugs. It regresses when you change it. It needs to be diffable, reviewable, and testable.

This sounds obvious. The anti-pattern below is what people actually ship.

## Anti-Pattern: Prompts Buried in Business Logic

```python
# DON'T do this
def summarize_ticket(ticket: dict) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{
            "role": "user",
            "content": f"""You are an SRE.  Summarize this ticket in 3 bullets,
            mention severity if present, ignore PII.  Ticket: {ticket['title']}\n\n{ticket['body']}
            Note: do not invent fields not in the source. Be terse.""",
        }],
    )
    return resp.content[0].text
```

What's wrong:

- The prompt is concatenated with user input via f-string. A user-controlled `ticket['body']` can override your instructions (prompt injection — [§9](./failure-modes)).
- The prompt is invisible to source control diff tools as a coherent unit; it lives spread across indentation and string literals.
- You can't run this prompt against a fixture without spinning up the whole function.
- Two engineers editing this file in parallel will silently fight each other over wording.
- You can't A/B test "this prompt vs. that prompt" without changing code.

## Pattern: Prompts Are Files

Move the prompt out:

```
prompts/
  summarize_ticket.md          # the system prompt, with placeholders
  summarize_ticket.fixtures/   # input/expected pairs for eval
    severe_outage.json
    low_priority_typo.json
```

```markdown
<!-- prompts/summarize_ticket.md -->
You are an SRE assistant. Given a support ticket, produce exactly three
bullet points summarizing it. Mention severity if specified.

Rules:
- Do not invent fields not present in the source.
- Do not include PII (names, emails, phone numbers).
- Output only the three bullets — no preamble, no closing.
```

Load it by name:

```python
from pathlib import Path

PROMPTS = Path(__file__).parent / "prompts"

def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text()

def summarize_ticket(ticket: dict) -> str:
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=load_prompt("summarize_ticket"),
        messages=[{
            "role": "user",
            "content": f"Title: {ticket['title']}\n\nBody:\n{ticket['body']}",
        }],
    )
    return resp.content[0].text
```

Now the prompt is a first-class artifact. You can:

- Diff it cleanly across PRs.
- Lint it (length, forbidden phrases).
- Run a test harness that loads the prompt + each fixture + the live model + a grader and reports pass rates.
- Ship two prompts behind a feature flag and compare them on real traffic.
- Have a non-engineer (a domain expert, an editor) edit the prompt without touching code.

This is the entry point to prompt evaluation. We'll go deep on that side — graders, regression tracking, judge models — in **Chapter 13 (Evaluation and Observability)**. For now, the rule is: **prompts live in their own files, are loaded by name, and have fixtures next to them.**

Next: [System Prompts →](./system-prompts)
