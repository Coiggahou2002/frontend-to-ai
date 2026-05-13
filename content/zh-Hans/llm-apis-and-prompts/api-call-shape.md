# 1. LLM API 调用的结构

第 0 章 §4 我们从概念上展示了 `messages` 数组。现在我们真正把它发出去。

一次 chat completion 就是一次 HTTPS 请求。它带着一组带角色标记的 messages、可选的采样参数，以及一个模型标识。响应里带着模型的续写，以及一些你将逐渐学会关心的元数据。

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

返回回来的内容（精简版）：

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

最重要的三个字段：

- `choices[0].message.content` —— 模型生成的文本。
- `usage` —— 输入和输出的 token 数。**这是你测算成本的依据**（[§8](./cost-and-latency)）。每次调用都把它记下来。
- `choices[0].finish_reason` —— `"stop"` 是正常结束；`"length"` 表示撞到了 `max_tokens`；`"tool_calls"` 表示模型想调一个函数（[§6](./tool-use)）。

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

响应：

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

## 并排对比：哪些是通用的，哪些是厂商特定的

| 概念 | OpenAI | Anthropic | 通用吗？ |
|---|---|---|---|
| 模型标识 | `model="gpt-4.1"` | `model="claude-sonnet-4-6"` | 通用——每家都有这个 |
| System prompt | 第一条消息，`role: "system"` | 顶层 `system=` 参数 | 概念通用，位置不同 |
| User / assistant 轮次 | `messages=[{role, content}, ...]` | `messages=[{role, content}, ...]` | 通用 |
| 采样控制 | `temperature`、`top_p`、`frequency_penalty`、... | `temperature`、`top_p`、`top_k` | 大部分通用 |
| 输出上限 | `max_tokens` | `max_tokens`（必填） | 通用 |
| 响应里的 token 用量 | `usage.prompt_tokens` / `completion_tokens` | `usage.input_tokens` / `output_tokens` | 概念通用，字段名不同 |
| 停止原因 | `finish_reason`（`stop`、`length`、`tool_calls`） | `stop_reason`（`end_turn`、`max_tokens`、`tool_use`） | 概念通用，取值不同 |
| 响应结构 | `choices[].message.content`（字符串） | `content[]` 是一组带类型的 block | 不通用——Anthropic 的 content 从一开始就是 block 列表（text、tool\_use、image……） |

心智模型完全一样：你拼一组 messages，发出去，读模型的续写和它的 usage 统计。线上传输的字节不一样，但你写一层薄薄的适配层，一个下午就能在两家之间切换。多数生产团队就是这么做的——在两家之上做一层小抽象，遇到限流或宕机就 fallback。

## 为什么 messages 数组对应到第 0 章

当你发送 `messages=[{role: "system", content: "..."}, {role: "user", content: "..."}]` 时，SDK **并不是**把 JSON 发给模型。它按模型的对话模板（第 0 章 §3）把你的 messages 渲染成一大段 token 序列，停在 assistant 角色标记之后。模型从那里开始续写，直到吐出停止 token。`messages` 数组只是把模型在训练时学过去续写的那种 prompt，用一种结构化的方式写出来而已。

下一节: [选择提供商 →](./choosing-provider)
