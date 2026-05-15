# 3. Markdown 渲染

LLM 的响应是 markdown。不是简单的 markdown——它们带着 fenced code block、GFM 表格、嵌套列表，有时还有 LaTeX 数学公式。你的任务是在流式到达的过程中增量渲染这一切，同时不把页面搞崩。

## 插件管线

`react-markdown` 是基座：它接收一个 markdown 字符串，返回 React 元素。单靠它能处理段落、标题、粗体、斜体、链接、图片和简单列表。其他一切靠插件。

```
markdown 字符串
  → remark 插件（操作 markdown AST）
    → rehype 插件（操作 HTML AST）
      → React 元素
```

处理 LLM 输出你需要的插件：

| 插件 | 功能 |
|---|---|
| `remark-gfm` | 表格、删除线、任务列表、自动链接 |
| `remark-math` | 解析 `$...$`（行内）和 `$$...$$`（块级）为数学节点 |
| `rehype-katex` | 用 KaTeX 渲染数学节点 |
| `rehype-highlight` | 基于 highlight.js 的语法高亮（更轻量） |
| `rehype-prism-plus` | 基于 Prism 的语法高亮（更多语言、支持行号） |

两个高亮方案选一个——不要同时用。

## 组件实现

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

import { CodeBlock } from './CodeBlock';

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
      components={{
        code: CodeBlock,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

这就是全部集成代码。`components` prop 让你覆盖任何 HTML 元素的渲染方式——这就是给代码块加复制按钮的方法。

## 自定义代码块

`code` 组件会收到 `className`（例如 `"language-python"`）和 `children`（代码字符串）。行内代码（反引号）没有 className；fenced block 有。

```tsx
'use client';

import { useState } from 'react';

export function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || '');
  const isBlock = !!match;

  if (!isBlock) {
    return <code className={className} {...props}>{children}</code>;
  }

  const language = match![1];
  const code = String(children).replace(/\n$/, '');

  return (
    <div className="relative group">
      <span className="absolute top-2 left-3 text-xs text-gray-400">
        {language}
      </span>
      <CopyButton text={code} />
      <pre><code className={className} {...props}>{children}</code></pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="absolute top-2 right-2 text-xs opacity-0 group-hover:opacity-100"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
```

## LaTeX

如果你的应用面向开发者或研究人员，LaTeX 支持是必须的——模型动不动就用它写数学公式。`remark-math` + `rehype-katex` 组合同时处理行内（`$E = mc^2$`）和块级公式：

```
$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
$$
```

唯一的配置成本是引入 KaTeX CSS。如果你漏了，公式会渲染成一堆没样式的乱码。

## 渐进渲染问题

在流式过程中，你的 `content` 字符串每收到一个 delta 就增长一截。如果你每次更新都把完整字符串扔给 `<ReactMarkdown>`，这个库会从头解析和渲染整个文档。每个 delta 的解析开销是 O(n)，n 个 delta 加起来就是 O(n²)。

对一个 2,000 token 的响应这通常没问题——React 的 reconciliation 会让 DOM 更新很小。但对一个包含代码块和表格的 20,000 token 响应，你会看到明显的卡顿。

**解决方案，从简单到复杂：**

1. **Debounce 更新（推荐）。** 缓冲到达的 delta，每 30–50 ms 更新一次 state。用户完全感知不到——人眼本来就跟不上 ~20 ms 以下的文字出现速度——但能把完整重新解析的次数降低 10 倍以上。

```tsx
const bufferRef = useRef('');
const [rendered, setRendered] = useState('');

const flush = useMemo(
  () => debounce(() => {
    setRendered(bufferRef.current);
  }, 40),
  []
);

// 在你的 stream handler 中：
function onDelta(text: string) {
  bufferRef.current += text;
  flush();
}
```

2. **Memoize 组件。** 用 `React.memo` 包裹 `MarkdownMessage`，这样只有 `content` 真正变化时才会 re-render（debounce 没有 flush 的时候它不会变）。

3. **流式 markdown 解析器。** 像 `marked` 这样的库可以增量解析。你喂给它 delta 字符串，它吐出 HTML 片段。这避免了重新解析整个文档。和 React 集成更复杂，而且如果你做了 debounce 通常也不需要。

实操建议：先用 40 ms debounce 加 `React.memo`。这能覆盖 99% 的真实场景，不会有任何可感知的延迟。

## MDX：在响应中嵌入交互式组件

如果你希望模型的输出里包含活的 React 组件——一个图表、一个可运行的代码沙盒、一个交互式测验——你需要 MDX。像 `next-mdx-remote` 这样的库可以在运行时编译 MDX 字符串，让你把自定义标签映射到 React 组件。

这很强大但也很危险：你在执行模型写出来的代码。如果要走这条路，务必做好沙盒隔离。对大多数 chat 应用来说，标准 markdown 渲染就够了。

下一节: [消息列表模式 →](./message-list-patterns)
