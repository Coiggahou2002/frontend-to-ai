# 3. 把 Prompt 工程当作软件工程

Prompt 是代码。它定义了你系统的行为。它会有 bug。你改它的时候它会回归。它需要能 diff、能 review、能测试。

听上去是常识。下面这个反模式才是大家真正在线上写的样子。

## 反模式：Prompt 埋在业务逻辑里

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

错在哪：

- Prompt 通过 f-string 和用户输入拼接在一起。一个用户控制的 `ticket['body']` 可以覆盖你的指令（prompt 注入——见 [§9](./failure-modes)）。
- Prompt 在源码 diff 工具里看不到一个完整的单元；它散落在缩进和字符串字面量之间。
- 你没法不启动整个函数就拿一个 fixture 去跑这个 prompt。
- 两位工程师并行改这个文件时，会在措辞上互相打架而不自觉。
- 不改代码，你就没法 A/B 测"这版 prompt vs 那版 prompt"。

## 模式：Prompt 是文件

把 prompt 拎出来：

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

按名字加载：

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

现在 prompt 就是一等公民产物了。你可以：

- 在 PR 里把它干净地 diff 出来。
- Lint 它（长度、禁用短语）。
- 跑一个测试套件：加载 prompt + 每个 fixture + 真实模型 + 一个评分器，给出通过率。
- 在 feature flag 后面同时上线两版 prompt，在真实流量上做对比。
- 让一个非工程师（领域专家、编辑）不碰代码就能改 prompt。

这就是 prompt 评测的入口。我们会把这一面讲深——评分器、回归追踪、judge 模型——放在**第 11 章（评测与可观测性）**。眼下，规则是：**prompt 住在自己的文件里，按名字加载，旁边放着 fixtures。**

下一节: [System Prompt →](./system-prompts)
