# 4. Message List Patterns

You can stream tokens and render Markdown. Now you need the container that holds it all — the message list. This is the core UI surface of any chat app, and getting it wrong produces the kind of jank that makes users close the tab.

## The message data model

Every message in the conversation is one object:

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

`status` is doing most of the work. It drives what the UI shows: a spinner for `pending`, an animated cursor for `streaming`, the final text for `done`, and a retry button for `error`.

## Rendering different message types

Not every message looks the same. A minimal approach:

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

User messages are plain text bubbles aligned right. Assistant messages are rendered Markdown aligned left. Tool results get a collapsible card showing the tool name and output — users want to see what the agent did, but don't need it front-and-center.

## Optimistic UI

When the user hits Send, don't wait for the server to acknowledge the message. Append it to the list immediately:

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

The user sees their message the instant they press Enter. The assistant message appears as an empty bubble with a typing indicator, then fills in as tokens arrive. If the network request fails, you flip `status` to `"error"` and show a retry affordance — you never remove the user's message.

## Streaming state

While streaming, the assistant message grows token by token. Two UI choices:

1. **Blinking cursor** — append a `▌` character (or a CSS-animated block) after the last token. Remove it when `status` flips to `"done"`.
2. **Typing indicator** — three animated dots in the bubble until the first token arrives, then switch to the growing text.

Most production apps use the blinking cursor. It gives the user a clear signal that content is still arriving and shows exactly where the next token will appear.

A subtle gotcha: don't call `setMessages()` on every single token. Batch deltas into 50-100ms frames using `requestAnimationFrame` or a simple debounce. React re-renders are fast, but 60 re-renders per second across a long message list is not free.

## Retry and regenerate

Users expect a "Regenerate" button on the last assistant message. Implementation:

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

Pop the last assistant message, then re-stream from the same user message. The user gets a fresh response. If you want to keep the old response (so the user can toggle between alternatives), you're entering branching territory.

## Branching (brief)

Some UIs — ChatGPT's "edit" feature is the canonical example — let users go back to any point in the conversation, edit a message, and fork. The data model changes from a flat array to a **tree**:

```
         user: "explain HNSW"
              |
     assistant: "HNSW is..."
           /          \
  user: "simpler"   user: "more detail"
       |                   |
  assistant: ...     assistant: ...
```

Each node has a `parentId` instead of a position index. The UI shows one path through the tree at a time, with left/right arrows to switch branches.

This is significant complexity — tree traversal, path selection, re-indexing for the API call (which still expects a flat array). Most apps skip it entirely. If you need it, model messages as a linked tree and derive the flat array at send time.

## Virtualized lists for long conversations

A conversation with 500+ messages means 500+ DOM nodes, each containing rendered Markdown with syntax-highlighted code blocks. That's thousands of elements. Scroll performance degrades badly.

The fix is virtualization: only render the messages currently visible in the viewport (plus a small overscan buffer). `react-virtuoso` is the best option for chat because it handles reverse-scrolling and dynamic item heights out of the box:

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

`followOutput="smooth"` gives you auto-scroll behavior for free. `initialTopMostItemIndex` starts the list at the bottom — where chat conversations always begin.

For shorter conversations (<100 messages), skip virtualization. The overhead of measuring dynamic heights isn't worth it until you actually have a performance problem.

## Auto-scroll

If you're not using `react-virtuoso` (which handles this), you need manual auto-scroll logic. The rule:

- **New content arrives + user is at the bottom** -> scroll to bottom.
- **New content arrives + user has scrolled up** -> don't scroll. They're reading history.

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

The 50px threshold is forgiving — a user who's "almost" at the bottom still gets auto-scrolled. A user who has scrolled up even slightly is left alone. When they scroll back down to the bottom, auto-scroll re-engages.

One more detail: show a "scroll to bottom" button when the user is scrolled up and new content has arrived. It's a small affordance, but every chat app that omits it gets complaints.

Next: [Theming & Dark Mode →](./theming-and-dark-mode)
