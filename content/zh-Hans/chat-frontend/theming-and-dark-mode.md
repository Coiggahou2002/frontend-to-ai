# 5. 主题与深色模式

一个只能在桌面端亮色模式下工作的聊天 UI 是 demo，不是产品。本节介绍主题层的实现：CSS 变量、深色模式、响应式布局和无障碍访问。

## 以 CSS 自定义属性为基础

在 `:root` 上定义颜色 token 作为 CSS 变量。所有组件都引用这些变量——永远不要硬编码十六进制颜色值。

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-user-bubble: #e3f2fd;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --code-bg: #f6f8fa;
  --border: #e0e0e0;
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --bg-user-bubble: #1a3a5c;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --code-bg: #2d2d2d;
  --border: #404040;
}
```

切换主题只需在 `<html>` 元素上切换 `data-theme` 属性。所有组件瞬间更新——无需 prop 透传，无需 context 重渲染。

## 深色模式：系统偏好 + 手动切换

检测系统偏好，但允许用户手动覆盖。将用户的选择存储在 `localStorage` 中。

```typescript
function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Apply before React hydrates — put this in a <script> in <head>
// to prevent the white flash on dark-mode loads.
document.documentElement.dataset.theme = getInitialTheme();
```

在 `<head>` 中放置 `<script>` 至关重要。如果等到 React hydrate 之后再设置主题，深色模式用户在每次页面加载时都会看到一次白色闪屏。

## 代码块主题

语法高亮的代码需要两套主题。使用 `data-theme` 进行切换：

```css
[data-theme="light"] pre code { /* github-light via Shiki or Prism */ }
[data-theme="dark"]  pre code { /* one-dark-pro or similar */ }
```

如果你使用 Shiki（Nextra 站点推荐使用），在 `getHighlighter()` 中传入两套主题，根据属性值切换当前激活的主题。如果你使用 `react-syntax-highlighter`，其 `style` prop 接受主题对象——用三元表达式切换即可。

## 响应式布局

桌面端：侧边栏（对话列表）+ 主聊天区域。移动端：全宽聊天区域，侧边栏变为抽屉。

```css
.app-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
}
```

侧边栏是可选的 UI。消息列表和输入框才是核心——它们需要在 320px 以上的任何宽度下正常工作。

## 不要从零搭建设计系统

你是在做聊天产品，不是在做组件库。选用以下方案之一：

- **shadcn/ui** —— 可复制粘贴的 Tailwind 组件。代码归你所有，没有依赖。按钮、对话框、下拉菜单和输入区域都有很好的默认样式。
- **Radix Primitives** —— 无样式、可访问的基础组件（对话框、弹出层、下拉菜单）。当 shadcn/ui 没有你需要的组件时使用。

两者都开箱支持键盘导航和 ARIA 属性，这引出了最后一个话题。

## 无障碍基础

对聊天 UI 最重要的三件事：

1. **ARIA 角色。** 消息列表应设置 `role="log"` 和 `aria-live="polite"`，这样屏幕阅读器会播报新消息，同时不会打断用户当前的操作。
2. **焦点管理。** 发送消息后，将焦点返回到输入框。对话框打开时，将焦点锁定在其内部。
3. **色彩对比度。** WCAG AA 标准要求正文文本的对比度至少为 4.5:1。两套主题都要测试。深色模式的调色板是大多数应用翻车的地方——灰色配深灰色对正常视力用户来说很舒适，但对低视力用户来说几乎不可见。

---

至此，你已经拥有了一个完整的应用技术栈——LLM 调用、RAG、agent、数据层和前端。接下来的章节将深入探讨支撑这一切的硬件与基础设施。

下一节：[GPU 与模型选型 →](../gpu-and-model-sizing)
