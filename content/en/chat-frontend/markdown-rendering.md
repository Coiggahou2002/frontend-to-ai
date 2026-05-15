# 3. Markdown Rendering

LLM responses are markdown. Not simple markdown — they come with fenced code blocks, GFM tables, nested lists, and sometimes LaTeX math. Your job is to render all of this incrementally, as the stream arrives, without the page melting.

## The Plugin Pipeline

`react-markdown` is the base: it takes a markdown string and returns React elements. On its own it handles paragraphs, headings, bold, italic, links, images, and simple lists. Everything else is plugins.

```
markdown string
  → remark plugins (operate on the markdown AST)
    → rehype plugins (operate on the HTML AST)
      → React elements
```

The plugins you need for LLM output:

| Plugin | What it adds |
|---|---|
| `remark-gfm` | Tables, strikethrough, task lists, autolinks |
| `remark-math` | Parses `$...$` (inline) and `$$...$$` (display) into math nodes |
| `rehype-katex` | Renders math nodes with KaTeX |
| `rehype-highlight` | Syntax highlighting via highlight.js (lighter) |
| `rehype-prism-plus` | Syntax highlighting via Prism (more languages, line numbers) |

Pick one of the two highlighting options — not both.

## The Component

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

That's the entire integration. The `components` prop lets you override how any HTML element is rendered — which is how you add a copy button to code blocks.

## Custom Code Block

The `code` component receives `className` (e.g. `"language-python"`) and `children` (the code string). Inline code (`backticks`) has no className; fenced blocks do.

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

If your app targets developers or researchers, LaTeX support is non-negotiable — models use it constantly for math. The `remark-math` + `rehype-katex` combo handles both inline (`$E = mc^2$`) and display mode:

```
$$
\nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
$$
```

The only setup cost is importing the KaTeX CSS. If you skip it, the math renders as unstyled garbage.

## The Progressive Rendering Problem

During streaming, your `content` string grows with every delta. If you pass the full string to `<ReactMarkdown>` on every update, the library re-parses and re-renders the entire document from scratch. That's O(n) parse work per delta, and with n deltas the total is O(n²).

For a 2,000-token response this is usually fine — React's reconciliation keeps the DOM updates small. For a 20,000-token response with code blocks and tables, you'll see visible jank.

**Solutions, from simplest to hardest:**

1. **Debounce updates (recommended).** Buffer incoming deltas and update state every 30–50 ms. This is imperceptible to users — the eye can't track text appearing faster than ~20 ms anyway — but cuts the number of full re-parses by 10x or more.

```tsx
const bufferRef = useRef('');
const [rendered, setRendered] = useState('');

const flush = useMemo(
  () => debounce(() => {
    setRendered(bufferRef.current);
  }, 40),
  []
);

// In your stream handler:
function onDelta(text: string) {
  bufferRef.current += text;
  flush();
}
```

2. **Memoize the component.** Wrap `MarkdownMessage` in `React.memo` so it only re-renders when `content` actually changes (it won't if the debounce hasn't flushed yet).

3. **Streaming markdown parser.** Libraries like `marked` can parse incrementally. You feed it delta strings and it emits HTML fragments. This avoids re-parsing the entire document. More complex to integrate with React, and rarely necessary if you debounce.

The practical recommendation: start with debounce at 40 ms and `React.memo`. You'll handle 99% of real-world responses without any perceptible delay.

## MDX: Interactive Components in Responses

If you want the model's output to contain live React components — a chart, a runnable code sandbox, an interactive quiz — you need MDX. Libraries like `next-mdx-remote` can compile MDX strings at runtime, letting you map custom tags to React components.

This is powerful but dangerous: you're executing code the model wrote. Sandbox it aggressively if you go down this path. For most chat apps, standard markdown rendering is all you need.

Next: [Message List Patterns →](./message-list-patterns)
