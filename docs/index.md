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
| 0 | [How LLMs Actually Work](./how-llms-work) | Tokens, next-token prediction, multi-turn conversation, context windows, and sampling |
| 1 | [Python for TypeScript Developers](./python-guide-for-ts-devs) | Pick up Python fast by mapping it to TypeScript concepts you already know |
| 2 | [LLM APIs & Prompt Engineering](./llm-apis-and-prompts) | Calling LLMs from code: messages, system prompts, structured output, function calling |
| 3 | Embeddings, Vector Search & RAG *(coming soon)* | Give the model knowledge it wasn't trained on |
| 4 | Agents, Tool Use & Orchestration *(coming soon)* | Multi-step LLM systems that can take actions |
| 5 | [GPU and Model Sizing](./gpu-and-model-sizing) | VRAM, quantization, model tiers, and how to choose the right GPU |
| 6 | [AI Infrastructure Stack](./ai-infra-stack) | CUDA, cuDNN, NCCL, inference frameworks, and how they fit together |
| 7 | [KV Cache: From Theory to Engineering](./kv-cache) | How Transformer attention caching works and why it matters for deployment |
| 8 | [LLM Inference and Concurrency](./inference-concurrency) | Prefill vs decode, memory bandwidth, and how to estimate serving capacity |
| 9 | Fine-Tuning in Practice *(coming soon)* | Hands-on LoRA/QLoRA fine-tune of Qwen-3B |
| 10 | [LLM Post-Training: SFT to GRPO](./post-training) | How models go from pre-trained weights to useful assistants |
| 11 | Evaluation & Observability *(coming soon)* | Testing and monitoring non-deterministic LLM systems |

## Who is this for

- Front-end / full-stack developers who want to move into AI engineering
- TypeScript developers picking up Python for the first time
- Anyone building AI-powered products who comes from a web development background
