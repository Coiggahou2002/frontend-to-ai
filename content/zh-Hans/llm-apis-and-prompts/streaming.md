# 7. 流式输出

对 chat UI 来说，**首 token 时间（TTFT）** 比总延迟更重要。一个用户在 300 ms 内看到文字开始出现，会觉得系统反应快，哪怕完整响应要花 8 秒。一个 4 秒空白屏幕之后再瞬间冒出 4 秒文字，会让人觉得系统坏了，尽管两者总工作量一样。

流式输出就是答案。

## 它是怎么工作的

底层上，LLM API 通过 **Server-Sent Events（SSE）**流式返回响应。如果你在浏览器里用过 `EventSource`，这套协议你已经懂了：

- 一条 HTTP 连接，一直开着。
- 服务端有数据就发一段 `data: {...}\n\n` chunk。
- 响应完成时连接关闭。

每一段 chunk 是一个 token（或者一小批 token）。Python SDK 把这层暴露成一个迭代器。

## 一个流式请求

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

OpenAI 风格的写法：

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

## Batch vs Stream —— 各自什么时候用

| 场景 | 模式 |
|---|---|
| Chat UI 把 token 渲染给用户 | Stream |
| 后端流水线（摘要、分类、抽取） | Batch |
| 用工具的 agent | Batch（每一轮都是）；如果最终一轮要给用户看文本，就 stream 那一轮 |
| 延迟敏感的接口，调用方等完整结果 | Batch（streaming 有些许开销） |
| 语音 / TTS 流水线（下游希望尽快拿到 token） | Stream |

经验法则：**有人盯着看就 stream，是函数在调用就 batch。**

## 流式 + 工具调用很麻烦

当模型在生成一次工具调用时，它一个 token 一个 token 地吐 JSON 参数。流式给你的是部分 JSON：先是 `{"ci`，再是 `ty": "T`，再是 `okyo"}`。在它完整之前你没法 parse。SDK 会帮你——Anthropic 的 `stream` 暴露了像 `input_json_delta` 这样的高级事件，会自动把 JSON 累起来；还有一个 `on_tool_use` 回调，在 block 完整组装好之后触发。OpenAI 暴露的是 chunk 里一段段的 `delta.tool_calls`，由你来拼接。

如果你要把工具调用的输出流式渲染到 UI 上，实操模式是：

1. 文本 delta 来了就渲染（用户看到 assistant 在打字）。
2. **缓冲**所有工具调用相关的 delta —— 别把部分 JSON 给用户看。
3. 当一个 tool-use block 完整时，分发它；显示一个"调用工具中"的指示。
4. 工具返回后，开始下一轮的流式输出。

## 前向引用

为什么流式聊天里第二轮往往比第一轮快得多？因为服务端把两次调用之间共享前缀（system prompt、之前的轮次、检索到的上下文）的 KV 状态缓存住了，只需要给新增 token 做 prefill 就行。**第 9 章（KV Cache）**讲机制。**第 10 章（推理并发）**讲一个服务栈如何在大量并发用户之间管理这份缓存。

## `create` vs `stream` —— 两种 API 调用

每个 LLM SDK 都给你两种拿响应的方式。区别就一件事：HTTP 行为不同。

| | `messages.create(...)` | `messages.stream(...)` |
|---|---|---|
| HTTP 行为 | 发请求，等着，收到一整个 JSON 响应 | 发请求，收到一连串 SSE 事件 |
| 返回类型 | `Message` 对象 | 迭代器 / 上下文管理器，逐个 yield 事件 |
| 什么时候拿到第一个 token | 所有 token 生成完之后 | 第一个 token 生成完就拿到 |
| 什么时候用 | 后端流水线、eval、批量分类 | Chat UI、语音流水线、一切有人盯着看的场景 |

请求体完全一样——同一个 model、同一组 messages、同样的参数。唯一的差别是服务端要不要保持连接、分批推送结果。

### 对比示例：`create` vs `stream`（Anthropic Python SDK）

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

两种调用消耗的 token 数量一样，费用一样。唯一的 trade-off 是延迟曲线：`create` 在全部生成完之前什么都不给你；`stream` 大概 200-400 ms 就能拿到第一个 token。

## SSE Event Types 详解

当你用 stream 时，底层 HTTP 响应是一连串 `data:` 行。SDK 会帮你解析成有类型的 event 对象，但了解原始格式在你用 `curl` 调试或写自定义 client 时很有帮助。

**Anthropic event 序列：**

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

要点：
- `message_start` 带着 input token 数（output 还没开始你就知道输入成本了）。
- 每个 `content_block_delta` 带一小段 text，拼起来就是完整回复。
- `message_delta` 在最后，带 `stop_reason` 和 `output_tokens`。
- 如果模型在调工具，你会看到 `content_block_start` 的 `type` 是 `"tool_use"`，`content_block_delta` 的 `type` 是 `"input_json_delta"`。

**OpenAI event 序列：**

```
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"role":"assistant","content":""},...}]}
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":"BGP"},...}]}
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{"content":" is"},...}]}
  ... more data lines ...
data: {"id":"chatcmpl-...","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{...}}
data: [DONE]
```

要点：
- 每行都是 `data: <json>`。没有命名 event type——靠检查 `delta.content`、`delta.tool_calls`、`finish_reason` 来区分。
- Usage 只在最后一个 chunk 里，而且需要你设了 `stream_options={"include_usage": True}` 才有。
- 字面量 `data: [DONE]` 表示流结束。

两套协议都是标准 SSE，任何语言只要有 HTTP client 就能消费——不一定非得用官方 SDK。但 SDK 会帮你处理重连、解析、类型化对象，没有特殊理由就用 SDK。

下一节: [成本与延迟基础 →](./cost-and-latency)
