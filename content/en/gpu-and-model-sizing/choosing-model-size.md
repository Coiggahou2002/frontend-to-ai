# 4. Choosing Model Size

So far the question has been "given a model, which GPU?" This section flips it: **which model in the first place?** Pick wrong here and the GPU question becomes irrelevant — you'll either burn money or ship something that doesn't work.

## Overview of Major Open-Source Models

As of April 2026, the open-source LLM landscape has shifted significantly. Here are the top 10 by performance and the available sizes from each vendor:

### Open-Source LLM Performance Rankings -- Top 10 (April 2026)

| Rank | Model | Vendor | Total / Active Params | Architecture | Released |
|------|-------|--------|----------------------|-------------|----------|
| 1 | **DeepSeek-V4 Pro** | DeepSeek | 1.6T / 49B | MoE | 2026.04 |
| 2 | **Kimi K2.6** | Moonshot AI | 1T / 32B | MoE | 2026.04 |
| 3 | **GLM-5.1** | Zhipu AI | 744B / 40B | MoE | 2026.04 |
| 4 | **GLM-5** | Zhipu AI | 745B / 44B | MoE | 2026 Q1 |
| 5 | **Qwen3.5-397B-A17B** | Alibaba | 397B / 17B | MoE | 2026.02 |
| 6 | **MiniMax M2.7** | MiniMax | 230B / 10B | MoE | 2026.03 |
| 7 | **Step-3.5-Flash** | StepFun | 196B / 11B | MoE | 2026.02 |
| 8 | **MiMo-V2.5** | Xiaomi | 310B / 15B | MoE | 2026.04 |
| 9 | **Gemma 4** | Google | 31B (dense) / 26B-A4B (MoE) | Hybrid | 2026.04 |
| 10 | **GPT-oss-120B** | OpenAI | 117B / 5.1B | MoE | 2026 |

**Industry trend**: 9 out of 10 use MoE architecture. The competition has shifted from "biggest model" to "fewest active parameters with best results." Chinese vendors hold 7 of the top 10 spots.

### Qwen (Tongyi Qianwen) Full Version Line

| Model | Architecture | Parameters | Released | Notes |
|-------|-------------|-----------|----------|-------|
| Qwen3 (0.6B-32B) | Dense | 0.6B, 1.7B, 4B, 8B, 14B, 32B | 2025.04 | Previous generation |
| Qwen3-235B-A22B | MoE | 235B / 22B active | 2025.04 | Previous gen flagship |
| **Qwen3.5-397B-A17B** | MoE | 397B / 17B active | 2026.02 | Current flagship MoE |
| **Qwen3.6-27B** | Dense | 27B | 2026.03-04 | **Latest dense, recommended** |
| **Qwen3.6-35B-A3B** | MoE | 35B / 3B active | 2026.03-04 | Lightweight MoE (few active params, good for simple tasks) |

### Available Sizes from Major Vendors

| Model Series | Vendor | Available Sizes | Notes |
|-------------|--------|----------------|-------|
| **Qwen3.5/3.6** | Alibaba | **27B** (dense), 35B-A3B, **397B-A17B** | Latest generation |
| **Llama 4** | Meta | 1B, 3B, **8B**, **70B**, 400B-A17B (Maverick) | Maverick is MoE |
| **DeepSeek-V4** | DeepSeek | **1.6T-A49B** (Pro), 284T-A13B (Flash) | Current #1 open-source |
| **GLM-5/5.1** | Zhipu AI | **744B-A40B**, 745B-A44B | Trained on Huawei Ascend chips |
| **Gemma 4** | Google | 2B, 4B, **31B** (dense), 26B-A4B | Multimodal support |
| **GPT-oss** | OpenAI | 20B-A3.6B, **120B-A5.1B** | OpenAI's first open-source |
| **Mistral** | Mistral AI | 7B, 8B, **24B**, 675B-A41B (Large 3) | -- |
| **MiMo-V2.5** | Xiaomi | **310B-A15B** | 1M context |
| **Phi-4** | Microsoft | 3.8B, **14B** | Exceptional small model performance |

### Size Tiers and GPU Requirements

| Tier | Typical Size | GPU Needed | Positioning |
|------|-------------|-----------|------------|
| Tiny | 1-4B | Can run on CPU | Edge / embedded |
| Small | **7-9B** | 1x A10 | Best value; sufficient for most tasks |
| Medium | **14B** | 1x A10 (INT8) or 1x A100 | **Sweet spot** |
| Large | **27-32B** | 1x A100 | Strong capability, fits on a single card |
| X-Large | 70B | 1-2x A100 | Approaches closed-source model quality |
| Flagship | 200B-1.6T MoE | 4-8x A100 or more | Maximum performance |

**7-8B and 27-32B remain the two most popular self-hosted sizes** -- the former is synonymous with "good enough and cheap," the latter with "the strongest model that fits on a single card."

## Model Size vs. Capability Tiers

| Parameters | Capability | Handles Well | Struggles With |
|-----------|-----------|-------------|---------------|
| 1.5B-4B | Junior | Simple classification, keyword extraction, short summaries | Complex reasoning, long-form writing, style mimicry |
| **7B-8B** | Intermediate | Entity extraction, basic Q&A, template-based generation | Nuanced tone control, multi-turn complex reasoning |
| **14B** | Upper-intermediate | Most NLP tasks | Extremely complex chain-of-thought reasoning |
| **32B** | Strong | Complex writing, style mimicry, multi-factor reasoning | Nearly no weaknesses |
| 70B+ | Very strong | Full capability approaching closed-source models | Extremely high cost and deployment barrier |

The bigger the model, the better the comprehension and generation quality -- but the higher the cost. The key is to **find the smallest size that's "just good enough."**

## Sizing Principle: Let the Hardest Task Decide

A typical system has multiple LLM tasks. Model size should be determined by **the hardest task**. Running easy tasks on a big model is fine (just wasteful), but running hard tasks on a model that's too small will produce unacceptable quality.

Take a typical AI application that needs entity extraction, content summarization, style rewriting, and long-form generation:

| Task | Complexity | Minimum Viable | Recommended | Why |
|------|-----------|---------------|-------------|-----|
| Entity extraction (names, locations, etc.) | Low-Medium | 7B | 7B-14B | Structured output, fixed patterns |
| Content summarization | Low-Medium | 7B | 7B-14B | Extracting key information, relatively fixed patterns |
| Style rewriting (mimicking a specific tone) | Medium-High | 14B | 14B-32B | Needs to understand subtle stylistic differences |
| **Long-form generation** (synthesizing multiple contexts) | **Highest** | 14B | **32B** | Must combine multiple information sources while maintaining coherence and consistent style |

The bottleneck is long-form generation -- it needs to weave together diverse information and produce natural output in a specific style, demanding the most from the model's overall capabilities.

## Size vs. Cost: The GPU Tier Jump

Model size doesn't affect cost linearly. Instead, there are **GPU tier jumps**:

| Model Size | Minimum GPU | Key Jump |
|-----------|------------|---------|
| 7B-8B | 1x A10 (24GB) | -- |
| 14B (INT8) | 1x A10 (24GB) | Still fits on A10 |
| 14B (FP8) | 1x A100 (80GB) | **Jumps to A100, roughly 5-6x the cost of A10** |
| 32B (FP8) | 1x A100 (80GB) | Same A100; same cost as 14B FP8 |
| 70B (FP8) | 1x A100 (80GB) | Barely fits, very little headroom |
| 235B MoE (FP8) | 4x A100 (80GB) | **Another tier jump, 4x+ a single A100** |

Key insight: **14B (INT8) is a cost sweet spot**. It can squeeze onto an A10 (24GB), performs much better than 7B, yet costs the same. But once you exceed A10's VRAM ceiling, you must jump to A100 -- and the monthly bill jumps roughly 5-6x.

Conversely, **if you've already committed to an A100, running 14B or 32B costs the same** -- it's one A100 either way. At that point, there's no reason to pick the smaller model.

## How to Make the Final Call: Benchmarking

Theoretical analysis can only narrow the options. The most reliable approach is to **test with real data**:

1. Prepare 20-30 representative test cases (simple, complex, and edge cases)
2. Call different model sizes via API (costs pennies)
3. Focus on comparing output quality for **the hardest task**
4. If the smaller model's quality is acceptable → save money, pick the smaller one; if noticeably worse → pick the larger one

Benchmarking helps you avoid two mistakes: choosing too large (overspending every month) or too small (quality gaps that require rework). The [evaluation chapter](../evaluation) goes deeper on how to do this systematically.

Next: [Decision tree →](./decision-tree)
