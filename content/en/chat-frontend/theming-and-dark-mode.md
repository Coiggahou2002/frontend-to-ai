# 5. Theming & Dark Mode

A chat UI that only works in light mode on a desktop screen is a demo, not a product. This section covers the theming layer: CSS variables, dark mode, responsive layout, and accessibility.

## CSS custom properties as the foundation

Define your color tokens as CSS variables on `:root`. Every component references these — never hard-code hex values.

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

Switching themes means toggling `data-theme` on the `<html>` element. Every component updates instantly — no prop drilling, no context re-renders.

## Dark mode: system preference + manual toggle

Detect the system preference, but let the user override it. Store the choice in `localStorage`.

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

The `<script>` in `<head>` is critical. If you set the theme after React hydrates, dark-mode users see a white flash on every page load.

## Code block themes

Syntax-highlighted code needs two themes. Use `data-theme` to switch:

```css
[data-theme="light"] pre code { /* github-light via Shiki or Prism */ }
[data-theme="dark"]  pre code { /* one-dark-pro or similar */ }
```

If you're using Shiki (recommended for Nextra sites), pass both themes to `getHighlighter()` and swap the active one based on the attribute. If you're using `react-syntax-highlighter`, the `style` prop accepts a theme object — switch it with a ternary.

## Responsive layout

Desktop: sidebar (conversation list) + main chat area. Mobile: full-width chat, sidebar becomes a drawer.

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

The sidebar is optional UI. The message list and input are the core — they should work at any width from 320px up.

## Don't build a design system from scratch

You're building a chat product, not a component library. Use one of:

- **shadcn/ui** — copy-paste Tailwind components. You own the code, no dependency. Great defaults for buttons, dialogs, dropdowns, and the input area.
- **Radix Primitives** — unstyled, accessible primitives (dialog, popover, dropdown menu). Use these when shadcn/ui doesn't have what you need.

Both handle keyboard navigation and ARIA attributes out of the box, which brings us to the last point.

## Accessibility basics

Three things that matter most for a chat UI:

1. **ARIA roles.** The message list should be `role="log"` with `aria-live="polite"` so screen readers announce new messages without interrupting the user.
2. **Focus management.** After sending a message, return focus to the input. When a dialog opens, trap focus inside it.
3. **Color contrast.** WCAG AA requires 4.5:1 contrast for body text. Test both themes. The dark-mode palette is where most apps fail — gray-on-dark-gray is comfortable for sighted users but invisible to low-vision users.

---

You now have a complete application stack — LLM calls, RAG, agents, a data layer, and a frontend. The next chapters go deeper into the hardware and infrastructure that powers all of it.

Next: [GPU & Model Sizing →](../gpu-and-model-sizing)
