---
sidebar_position: 0
slug: /
---

# Frontend to AI Engineer

A collection of guides and resources for front-end developers transitioning into AI engineering.

## Why this exists

The AI engineering landscape moves fast, but it doesn't require starting from scratch. Front-end developers already have strong foundations — JavaScript/TypeScript fluency, API design intuition, product thinking, and shipping muscle. What's missing are specific bridges: a new language (Python), new paradigms (ML pipelines, prompt engineering, embeddings), and a new ecosystem.

This repo provides those bridges — practical, opinionated guides written from the perspective of someone who's made the transition.

## Learning path

Start from the top and work your way down:

| # | Guide | What you'll learn |
|---|-------|-------------------|
| 1 | [Python for TypeScript Developers](./python-guide-for-ts-devs) | Pick up Python fast by mapping it to TypeScript concepts you already know |
| 2 | [GPU and Model Sizing](./gpu-and-model-sizing) | VRAM, quantization, model tiers, and how to choose the right GPU |
| 3 | [AI Infrastructure Stack](./ai-infra-stack) | CUDA, cuDNN, NCCL, inference frameworks, and how they fit together |
| 4 | [KV Cache: From Theory to Engineering](./kv-cache) | How Transformer attention caching works and why it matters for deployment |
| 5 | [LLM Inference and Concurrency](./inference-concurrency) | Prefill vs decode, memory bandwidth, and how to estimate serving capacity |
| 6 | [LLM Post-Training: SFT to GRPO](./post-training) | How models go from pre-trained weights to useful assistants |

## Who is this for

- Front-end / full-stack developers who want to move into AI engineering
- TypeScript developers picking up Python for the first time
- Anyone building AI-powered products who comes from a web development background
