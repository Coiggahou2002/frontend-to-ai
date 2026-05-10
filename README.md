# Frontend to AI Engineer

A collection of guides and resources for front-end developers transitioning into AI engineering.

**📖 Read the guides:** https://coiggahou2002.github.io/frontend-to-ai/

## Why this exists

The AI engineering landscape moves fast, but it doesn't require starting from scratch. Front-end developers already have strong foundations — JavaScript/TypeScript fluency, API design intuition, product thinking, and shipping muscle. What's missing are specific bridges: a new language (Python), new paradigms (ML pipelines, prompt engineering, embeddings), and a new ecosystem.

This repo provides those bridges — practical, opinionated guides written from the perspective of someone who's made the transition.

## Repo layout

- `content/en/` — English chapters
- `content/zh-Hans/` — 中文章节
- `app/` — Next.js App Router routes (Nextra docs theme)
- `next.config.mjs`, `mdx-components.tsx` — Nextra configuration

## Local development

```bash
npm install
npm run dev          # http://localhost:3000/frontend-to-ai/
npm run build        # static export to ./out/
```

The site is built with [Nextra](https://nextra.site) and deployed to GitHub Pages via GitHub Actions on every push to `main`.

## Who is this for

- Front-end / full-stack developers who want to move into AI engineering
- TypeScript developers picking up Python for the first time
- Anyone building AI-powered products who comes from a web development background

## Contributing

PRs welcome. If you've navigated this transition and have hard-won knowledge to share, open an issue or submit a guide.

## License

[CC BY-SA 4.0](./LICENSE)
