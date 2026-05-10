# 前端开发者转型 AI 工程师

面向前端开发者的 AI 工程转型指南与资源合集。

## 为什么做这个

AI 工程领域发展很快，但你不需要从零开始。前端开发者已经有了很强的基础——JavaScript/TypeScript 的熟练运用、API 设计的直觉、产品思维和交付能力。缺少的只是一些特定的桥梁：一门新语言（Python）、新的范式（ML 流水线、提示工程、嵌入向量），以及一个新的生态系统。

这个仓库提供这些桥梁——实用的、有观点的指南，从一个已经完成转型的人的视角出发。

## 学习路径

从上到下按顺序学习：

| # | 指南 | 你会学到什么 |
|---|------|-------------|
| 1 | [写给 TypeScript 开发者的 Python 指南](./python-guide-for-ts-devs) | 通过映射你已熟悉的 TypeScript 概念来快速上手 Python |
| 2 | [GPU 与大模型选型](./gpu-and-model-sizing) | 显存、量化、模型规模分档，以及如何选择 GPU |
| 3 | [AI 基础设施技术栈](./ai-infra-stack) | CUDA、cuDNN、NCCL、推理框架，以及它们如何协同工作 |
| 4 | [KV Cache：从原理到工程优化](./kv-cache) | Transformer 注意力缓存的工作原理及其对部署的影响 |
| 5 | [LLM 推理并发估算](./inference-concurrency) | Prefill 与 Decode、显存带宽，以及如何估算服务容量 |
| 6 | [大模型后训练：从 SFT 到 GRPO](./post-training) | 模型如何从预训练权重变成好用的助手 |

## 适合谁

- 想转型 AI 工程的前端/全栈开发者
- 第一次学 Python 的 TypeScript 开发者
- 任何来自 Web 开发背景、正在构建 AI 产品的人
