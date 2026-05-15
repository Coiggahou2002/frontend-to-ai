# 1. 流式传输协议

在[第 2 章 §7](../llm-apis-and-prompts/streaming)中，你从后端视角了解了流式传输——Python SDK 逐个迭代 token delta。本节切换到浏览器视角：传输这些 token 的协议是什么，为什么选择它，以及如何在 TypeScript 中消费它？

## SSE vs WebSocket

所有主流 LLM API（OpenAI、Anthropic、Google、Mistral）都通过 **Server-Sent Events (SSE)** 而非 WebSocket 来流式传输响应。这是一个刻意的选择，而非技术限制：

| 因素 | SSE | WebSocket |
|--------|-----|-----------|
| 方向 | 服务器 → 客户端（单向） | 双向 |
| 传输层 | 普通 HTTP——兼容 CDN、代理、负载均衡器 | 需要 Upgrade 握手——部分代理不支持 |
| 重连 | 规范内置（`Last-Event-ID`，自动重试） | 需要自己实现 |
| 认证 | 标准 `Authorization` 请求头（配合 `fetch`） | 把 token 放 URL 或用首条消息做认证 |
| 基础设施复杂度 | 零——就是一个 HTTP 响应 | 需要连接状态服务器、会话粘滞 |

LLM 推理本质上是请求-响应模式：你发送 prompt，得到一串 token 流。这是单向的。SSE 完美契合。WebSocket 的双向通道在这里是不必要的开销。

## 30 秒了解 SSE 协议

一个 SSE 响应的 `Content-Type` 为 `text/event-stream`，响应体的格式如下：

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01X",...}}

data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}

event: message_stop
data: {"type":"message_stop"}

```

规则：每个字段格式为 `field: value\n`。事件块之间用空行（`\n\n`）分隔。`data` 字段承载有效负载。`event` 字段是可选的——如果省略，事件类型默认为 `"message"`。整个协议就这么多。

## 在浏览器中消费 SSE

### 方案 A：`EventSource`

浏览器内置了 `EventSource` API：

```typescript
const es = new EventSource("/api/chat");
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

简单。但对 LLM API 来说有致命的限制：

- **只支持 GET。** 你无法发送包含对话历史的 POST 请求体。
- **不支持自定义请求头。** 你无法设置 `Authorization: Bearer ...`。
- **没有请求体。** 整个 prompt 只能编码到 URL 查询参数里。

做一个简单的 demo，`EventSource` 够用。但要做任何正式的东西，你需要下面的方案。

### 方案 B：`fetch()` + `ReadableStream`（实际方案）

`fetch()` 让你完全控制请求方法、请求头和请求体。响应体是一个 `ReadableStream`，你可以逐块读取：

```typescript
async function readSSE(url: string, body: object, onEvent: (data: string) => void) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!; // last element is incomplete — keep it

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") return; // OpenAI convention
        onEvent(payload);
      }
    }
  }
}
```

这就是每个生产级 Chat 前端实际使用的方案。在[§2](./consuming-the-stream)中你会看到它被封装进一个 React Hook。

## 对比总结

| 能力 | `EventSource` | `fetch` + `ReadableStream` |
|------------|---------------|----------------------------|
| HTTP 方法 | 仅 GET | 任意（POST、PUT 等） |
| 自定义请求头 | 不支持 | 支持 |
| 请求体 | 不支持 | 支持 |
| 自动重连 | 内置 | 需要手动实现（但你本来就需要手动控制） |
| 二进制数据 | 不支持 | 支持 |
| 取消 | `es.close()` | `AbortController` |
| 浏览器兼容性 | 所有现代浏览器 | 所有现代浏览器 |
| 用于 LLM API | 不行（无法 POST prompt） | 可以 |

## 什么时候 WebSocket 才是正确选择

SSE 覆盖了 LLM Chat 的需求。但有些功能确实需要双向通信：

- **语音/实时音频。** 客户端向服务器流式发送音频片段，同时接收转录文本或 TTS 音频。OpenAI 的 Realtime API 正是因此使用 WebSocket。
- **协同编辑。** 多个用户编辑同一文档，需要同时推送和接收变更。
- **多人状态同步。** 游戏、白板、光标状态——任何双方在不可预测的时间点都会产生事件的场景。

如果你的功能是"用户发送消息，模型返回一段流式响应"，SSE 更简单、成本更低、也更可靠。只有当你确实需要客户端在服务器响应*过程中*推送数据时，才应该选择 WebSocket。

---

现在你已经了解了线路上传输的内容。下一节将深入那些 `data:` 负载的*内部结构*——Anthropic 和 OpenAI 的事件格式——以及如何把它们转化为 React 友好的消息流。

下一节：[消费流式响应 →](./consuming-the-stream)
