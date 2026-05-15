# 5. 结构化输出

真正的系统不要散文。它们要数据：一个 JSON 对象，让下游函数能直接吃。下面是"让模型输出 JSON"的三个层次，从最弱到最强。

## 第 1 级：好言相劝（别这么干）

```text
Respond ONLY with valid JSON. Do not include markdown fences. The schema is...
```

这种做法大多数时候能用——配合一个低温度的模型、一份小心写的 prompt。但它也会在 1–5% 的时候失败：JSON 周围多出来的散文、漏出来的 markdown 围栏、幻觉出来的字段、一个尾随逗号。在任何有意义的规模上，这个失败率都不可接受。**别依赖 prompt 让模型输出 JSON。**

## 第 2 级：JSON 模式

OpenAI 暴露了 `response_format={"type": "json_object"}`。解码器在 token 级别被约束，只能吐出能构成语法合法 JSON 的字符。你仍然需要在 prompt 里描述你的 schema，但输出保证能被 parse。

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

JSON 模式保证可解析。它**不**保证 JSON 有正确的 key、正确的类型或正确的形状。模型仍然可以幻觉出 `{"location": "Tokyo"}`，而不是你想要的 `{"city": "Tokyo", ...}`。

## 第 3 级：Schema 约束生成

这才是真正的答案。你定义一个 schema（JSON Schema，或者更常见的，一个 Pydantic 模型）。提供商的解码器在每一步都被约束，只能吐出能让输出对 schema 仍然合法的 token。输出**在构造层面就被保证**符合 schema 的形状、类型和必填字段。

前端开发者在 TypeScript 里都熟 Zod。**Pydantic 就是 Python 的 Zod**：声明式 schema，运行时校验，IDE 友好的类型，并且和 Python 生态里几乎所有东西（FastAPI、agent 框架、ORM）打通。

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

`parse` 是一个便捷封装。底层 OpenAI 把 Pydantic 模型转成 JSON Schema，作为 `response_format` 发出去，拿回保证合法的 JSON 字符串，再把它 parse 回 Pydantic 实例。你写一个 Python 类，拿到一个 Python 实例——JSON 这层线上格式对你不可见。

### Anthropic：用工具调用作为结构化输出

Anthropic 没有单独的"结构化输出"模式。他们直接复用了**工具调用**：声明一个"tool"，它的 input schema 就是你想要的输出形状，然后让模型调用它。模型返回一个 `tool_use` block，它的 `input` 字段会精确匹配你的 schema。

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

机制不同，结果一样：一个 Pydantic 实例，可以放心交给下游代码。

## 自部署的等价物

如果你在 vLLM 或 SGLang 上服务开源模型，你也有一等公民级的结构化输出——可以用 **outlines** 或 **lm-format-enforcer** 这样的库，或者 vLLM 内置的 `guided_json` 参数。这些库做的事情和闭源 API 提供商内部做的是一样的：在解码的每一步，把会破坏 schema 的 token 屏蔽掉。推理服务这一侧的事情第 8 章会讲一些。

## 为什么这件事在本章之外也很重要

Schema 约束输出是后面两章的基石：

- **第 3 章（RAG）** —— 当用户问"我们 Q3 的数字怎么样？"时，一个 RAG 系统通常会先让模型产出一个结构化的查询计划（要查的实体、时间范围、子问题）。这个计划走 Pydantic schema，schema 走到检索器，可靠的检索依赖于可靠的计划结构。
- **第 4 章（Agent）** —— 每一次工具调用本质上就是一次 schema 约束的生成。模型写出一个匹配工具 input schema 的 JSON 对象，你的代码 parse 并分发。

如果你曾经线上跑着一个每周 throw 一次的 `JSON.parse`，这一节就是你那时候希望自己有的东西。

下一节: [Function Calling / 工具调用 →](./tool-use)
