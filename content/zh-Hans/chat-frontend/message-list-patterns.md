# 4. 消息列表模式

你已经能流式输出 token 并渲染 Markdown 了。现在需要的是承载这一切的容器——消息列表。这是所有聊天应用的核心 UI 界面，做不好就会产生让用户直接关掉标签页的卡顿感。

## 消息数据模型

对话中的每条消息对应一个对象：

```typescript
interface Message {
  id: string;           // UUID — needed for React keys and branching
  role: "user" | "assistant" | "system" | "tool";
  content: string;      // Markdown text (or tool output for role=tool)
  status: "pending" | "streaming" | "done" | "error";
  toolCalls?: ToolCall[];
  createdAt: number;    // Unix ms
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;    // JSON string
  result?: string;      // Populated when the tool returns
}
```

`status` 字段承担了大部分工作。它决定了 UI 的呈现方式：`pending` 时显示加载动画，`streaming` 时显示动态光标，`done` 时展示最终文本，`error` 时展示重试按钮。

## 渲染不同类型的消息

每条消息的外观不尽相同。一个最简实现：

```tsx
function MessageBubble({ message }: { message: Message }) {
  switch (message.role) {
    case "user":
      return <div className="msg msg-user">{message.content}</div>;
    case "assistant":
      return (
        <div className="msg msg-assistant">
          <MarkdownRenderer content={message.content} />
          {message.status === "streaming" && <StreamingCursor />}
        </div>
      );
    case "tool":
      return (
        <div className="msg msg-tool">
          <ToolResultCard content={message.content} />
        </div>
      );
    case "system":
      return null; // System messages are invisible to the user
  }
}
```

用户消息是靠右对齐的纯文本气泡。助手消息是靠左对齐的 Markdown 渲染内容。工具调用结果用一个可折叠的卡片展示工具名称和输出——用户想看到 agent 做了什么，但不需要它占据视觉中心。

## 乐观更新

当用户点击发送时，不要等待服务器确认。立刻把消息追加到列表中：

```typescript
function sendMessage(text: string) {
  const userMsg: Message = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    status: "done",
    createdAt: Date.now(),
  };

  // Show the user message instantly
  setMessages((prev) => [...prev, userMsg]);

  // Then start the assistant stream
  const assistantMsg: Message = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    status: "streaming",
    createdAt: Date.now(),
  };
  setMessages((prev) => [...prev, assistantMsg]);

  // Begin streaming — each delta updates assistantMsg.content
  streamResponse(userMsg, assistantMsg.id);
}
```

用户按下回车的瞬间就能看到自己的消息。助手消息以空气泡加打字指示器的形式出现，随后随着 token 到达逐步填充。如果网络请求失败，将 `status` 切换为 `"error"` 并显示重试入口——绝不删除用户已发送的消息。

## 流式状态

流式输出过程中，助手消息逐 token 增长。两种 UI 方案：

1. **闪烁光标** —— 在最后一个 token 后追加一个 `▌` 字符（或一个 CSS 动画的色块）。当 `status` 变为 `"done"` 时移除。
2. **打字指示器** —— 在气泡中显示三个动画圆点，直到第一个 token 到达后切换为逐步增长的文本。

大多数生产级应用使用闪烁光标。它清晰地告诉用户内容仍在到达，并标示出下一个 token 将出现的位置。

一个容易踩的坑：不要每收到一个 token 就调用一次 `setMessages()`。用 `requestAnimationFrame` 或简单的 debounce 将增量合并到 50-100ms 的帧里。React 的重新渲染很快，但对一个长消息列表每秒触发 60 次重渲染开销并不小。

## 重试与重新生成

用户期望在最后一条助手消息上看到"重新生成"按钮。实现方式：

```typescript
function regenerate() {
  setMessages((prev) => {
    // Pop the last assistant message
    const withoutLast = prev.slice(0, -1);
    return withoutLast;
  });
  // Re-send the last user message to get a new response
  const lastUserMsg = messages.findLast((m) => m.role === "user");
  if (lastUserMsg) streamResponse(lastUserMsg);
}
```

移除最后一条助手消息，然后基于同一条用户消息重新发起流式请求。用户会得到一个全新的回复。如果你想保留旧的回复（让用户可以在多个版本之间切换），那就进入了分支对话的领域。

## 分支对话（简述）

有些 UI ——ChatGPT 的"编辑"功能是最典型的例子——允许用户回到对话中的任意位置，编辑消息并产生分支。数据模型从扁平数组变成了一棵**树**：

```
         user: "explain HNSW"
              |
     assistant: "HNSW is..."
           /          \
  user: "simpler"   user: "more detail"
       |                   |
  assistant: ...     assistant: ...
```

每个节点用 `parentId` 代替位置索引。UI 每次只展示树中的一条路径，通过左右箭头切换分支。

这带来了相当大的复杂度——树遍历、路径选择、为 API 调用重建扁平数组（API 依然期望接收扁平数组）。大多数应用完全跳过了这个功能。如果你确实需要，就把消息建模为链式树结构，在发送时再派生出扁平数组。

## 长对话的虚拟化列表

一个 500+ 条消息的对话意味着 500+ 个 DOM 节点，每个节点都包含渲染后的 Markdown 和语法高亮的代码块，总共可达数千个元素。滚动性能会严重下降。

解决方案是虚拟化：只渲染当前视口内可见的消息（加上少量的 overscan 缓冲区）。`react-virtuoso` 是聊天场景的最佳选择，因为它开箱即用地支持反向滚动和动态行高：

```tsx
import { Virtuoso } from "react-virtuoso";

function ChatList({ messages }: { messages: Message[] }) {
  return (
    <Virtuoso
      data={messages}
      initialTopMostItemIndex={messages.length - 1}
      followOutput="smooth"          // auto-scroll on new items
      overscan={200}                 // pixels of off-screen pre-render
      itemContent={(index, msg) => <MessageBubble message={msg} />}
    />
  );
}
```

`followOutput="smooth"` 免费提供了自动滚动行为。`initialTopMostItemIndex` 让列表从底部开始——聊天对话总是从底部开始的。

对于较短的对话（<100 条消息），跳过虚拟化。在没有实际性能问题之前，动态高度测量的开销并不值得。

## 自动滚动

如果你没有使用 `react-virtuoso`（它内置了这个功能），你需要手动实现自动滚动逻辑。规则如下：

- **有新内容到达 + 用户处于底部** -> 滚动到底部。
- **有新内容到达 + 用户已向上滚动** -> 不滚动。他们正在阅读历史记录。

```typescript
function useAutoScroll(containerRef: RefObject<HTMLDivElement>, deps: any[]) {
  const isAtBottom = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      // "At bottom" = within 50px of the end
      isAtBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isAtBottom.current) {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, deps); // deps = [messages.length, latestContent]
}
```

50px 的阈值是宽容的——"差不多"在底部的用户仍然会被自动滚动。只要稍微向上滚动过的用户就不会被打扰。当他们滚回底部时，自动滚动重新生效。

还有一个细节：当用户已向上滚动且有新内容到达时，显示一个"滚动到底部"按钮。这是一个小小的交互提示，但每个省略了它的聊天应用都会收到用户投诉。

下一节：[主题与深色模式 →](./theming-and-dark-mode)
