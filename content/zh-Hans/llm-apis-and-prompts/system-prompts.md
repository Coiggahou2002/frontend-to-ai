# 4. System Prompt

第 0 章 §3 里讲过，system prompt 不是一个独立的输入通道。它就是渲染好的对话模板里的一段文本，前面带了一个 `system` 角色标记。从机制上看，模型看到的就是 `system said: ...` 后面跟着 `user said: ...`，然后从 assistant 槽位续写下去。

但模型在后训练阶段（第 10 章）见过几百万段对话，那些对话里 system 槽位的文本就代表运营方的长期指令——一个人设、一种格式、一条政策。它学会了对这些指令加大权重，并在多轮中持续套用它们。所以 system prompt **表现起来**比 user 消息更"黏"，尽管架构上并没有强制力。

"尽管"很重要。一段足够长、足够强硬的 user 消息完全可能把 system prompt 盖过去。讨论 prompt 注入时（[§9](./failure-modes)）我们会回到这个话题。

## 三种真实世界的模式

**1. 人设（Persona）** —— 设定语气和专业级别。

```text
You are a senior code reviewer with deep experience in Python backend systems.
Be specific and direct. When you spot a bug, name it. When you spot a smell,
explain why it's a smell.
```

**2. 格式约束（Format constraint）** —— 钉住输出的形状。

```text
Always respond in valid JSON matching this schema:
{ "severity": "low" | "medium" | "high" | "critical",
  "summary": string,
  "next_actions": string[] }
Do not include markdown fences or commentary outside the JSON.
```

（[§5](./structured-output) 里我们会看到，强制这件事有更强的手段——schema 约束的生成。在 system prompt 里写格式约束是最弱的一层。）

**3. 行为护栏（Behavioral guardrail）** —— 处理失败情形。

```text
If you do not have enough information to answer, reply exactly with:
"I don't know — please provide more context."
Do not guess. Do not invent function names, package names, or API endpoints.
```

行为护栏是你在 prompt 这一层对抗幻觉的方式。不完美，但有用——见 [§9](./failure-modes)。

## 一个端到端的好例子

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

这段 system prompt 三件事都做了：人设（资深 reviewer）、格式约束（带标签的编号结构）、护栏（"Need more context" 这条退路）。温度调低，因为我们要的是格式被遵守，而不是被即兴发挥。

下一节: [结构化输出 →](./structured-output)
