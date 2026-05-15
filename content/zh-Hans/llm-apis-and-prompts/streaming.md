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

下一节: [成本与延迟基础 →](./cost-and-latency)
