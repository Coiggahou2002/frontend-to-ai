# GPU and Model Sizing Guide

## Why LLMs Need GPUs

CPUs are great at complex logic and branching (a few powerful cores), while GPUs excel at massive parallel computation (thousands of small cores working simultaneously). At its core, running an LLM is just a huge amount of matrix multiplication -- exactly what GPUs are built for.

Analogy: a CPU is like one world-class chef (can cook anything, but only one dish at a time). A GPU is like 5,000 kitchen apprentices chopping vegetables at once (each one can only do simple tasks, but the parallelism makes them blazing fast together).

---

## The Most Important GPU Spec: VRAM

### What Is VRAM?

GPU VRAM (Video RAM) is the GPU's own dedicated memory. All model parameters (weights) must be loaded into VRAM before the model can run. **VRAM size determines how large a model you can run** -- this is the single most important spec when choosing hardware.

Key distinction:
- **System RAM**: the CPU's memory -- e.g. 30 GiB / 60 GiB / 128 GiB
- **GPU VRAM**: determined by GPU model -- e.g. A10 = 24 GB, A100 = 80 GB

### How Model Parameters Map to VRAM

The "7B" or "32B" in model names stands for Billion parameters. Each parameter takes up a certain amount of storage, depending on the **precision (data type)**:

| Precision | Bytes per Param | Meaning | 7B Model VRAM | 32B Model VRAM |
|-----------|----------------|---------|---------------|----------------|
| FP32 | 4 bytes | 32-bit float (training; rarely used for inference) | 28 GB | 128 GB |
| FP16 / BF16 | 2 bytes | 16-bit float (standard inference precision) | **14 GB** | **64 GB** |
| FP8 | 1 byte | 8-bit float (quality close to FP16, half the VRAM) | 7 GB | **32 GB** |
| INT8 | 1 byte | 8-bit integer quantization | 7 GB | 32 GB |
| INT4 | 0.5 bytes | 4-bit integer quantization (noticeable quality loss) | 3.5 GB | 16 GB |

**Simple formula: VRAM needed = parameter count x bytes per parameter + overhead**

Overhead includes:
- **KV Cache**: the model needs to remember conversation context; this also lives in VRAM, and grows with context length
- **Inference framework**: vLLM, TGI, etc. each consume some VRAM
- **OS reservation**: GPUs typically reserve 0.5-1 GB

Rule of thumb: **actual VRAM needed = model weight size x 1.2** (20% headroom for KV Cache, etc.).

### Is Lower Precision Always Better?

No. Reducing precision (quantization) is fundamentally **trading quality for VRAM and speed**:

| Precision | Quality Loss | Best Use Case |
|-----------|-------------|---------------|
| FP16 / BF16 | None | First choice when budget allows |
| FP8 | Negligible (usually imperceptible) | **Best price/performance, recommended** |
| INT8 | Slight | Practical choice when VRAM is tight |
| INT4 | Noticeable (complex reasoning and subtle semantics degrade) | Only when VRAM is truly insufficient |

For most production workloads (entity extraction, text generation, summarization, etc.), FP8 is more than sufficient.

---

## Common GPU Models at a Glance

Mainstream GPU models available on cloud platforms:

| GPU | VRAM | Generation | Performance Tier | Suitable Model Scale |
|-----|------|-----------|-----------------|---------------------|
| **T4** | 16 GB | 2018 (older) | Entry-level | ≤7B (FP16) |
| **A10** | 24 GB | 2021 | Mid-range | ≤8B (FP16) or ≤14B (INT8) |
| **V100** | 16/32 GB | 2017 (old) | Upper-mid | Worse price/perf than A10; not recommended for new projects |
| **A100** | **40 GB or 80 GB** | 2020 | High-end | ≤32B (FP8@80GB) or ≤70B (multi-GPU) |
| **H100/H800** | 80 GB | 2023 | Flagship | Large-scale models |

---

## Multi-GPU Deployment: When You Need More Than One Card

When a single GPU's VRAM can't fit the entire model, you split the model across multiple GPUs. This is called **Tensor Parallelism**.

| Situation | Approach |
|-----------|----------|
| Model < single GPU VRAM | 1 GPU, simplest setup |
| Model > single GPU VRAM | Multiple GPUs with tensor parallelism; model is sliced across cards |

Examples:
- Qwen3-32B FP16 needs ~64 GB → 1x A100 80GB (fits) or 2x A100 40GB (split)
- Qwen3-235B FP8 needs ~235 GB → at least 4x A100 80GB (320 GB total)

**The cost of multi-GPU**:
1. Inter-card communication adds overhead; speedup is not linear
2. Pricing is usually linear or super-linear (a 4-GPU instance costs more than 4x a single GPU)
3. Configuration and debugging are more complex

**If you can solve it with a single card, don't use multiple cards.**

---

## The MoE Catch

You may have heard of models like Qwen3-235B-A22B. Its architecture is called **MoE (Mixture of Experts)**.

Dense model: every parameter participates in every inference pass.
MoE model: the model is split into many "experts," and only a small subset is activated per inference.

Qwen3-235B-A22B means:
- **235B**: total parameter count (235 billion)
- **A22B**: only 22 billion parameters activated per inference

Sounds efficient, but there's a catch: **all 235B parameters must stay resident in VRAM**, even though only 22B are used each time. So VRAM requirements are based on the full 235B, not 22B.

| Metric | Qwen3-32B (Dense) | Qwen3-235B-A22B (MoE) |
|--------|-------------------|----------------------|
| Inference speed feel | Similar to 32B speed | Similar to 22B speed (faster) |
| VRAM requirement | Based on 32B | **Based on 235B** (much larger) |
| Output quality | Very good | Better (but marginal difference for most tasks) |
| Deployment cost | Moderate | Very high (roughly 4x+ the cost of the Dense model) |

---

## Beyond VRAM: What Else Matters

### System RAM

System RAM should be >= GPU VRAM, because the model is first loaded into system memory before being transferred to the GPU. If system RAM is too small, model loading will fail.

Most cloud GPU instances already come with enough system RAM -- you generally don't need to worry about this.

### vCPUs

The CPU's role during inference is mainly: data preprocessing (tokenization), network I/O, and scheduling. It doesn't significantly affect inference speed. Typically **8-16 vCPUs** per GPU is plenty.

### Disk

Model files need to be stored on disk, and large models can be tens of GB. For example:
- 8B model: ~16 GB model file
- 32B model: ~64 GB model file (FP16 weights)

Cloud server default system disks are usually 40-100 GB, which may not be enough. **Attach a separate SSD data disk of 200 GB or more**.

---

## Choosing the Right LLM Size

### Overview of Major Open-Source Models

As of April 2026, the open-source LLM landscape has shifted significantly. Here are the top 10 by performance and the available sizes from each vendor:

#### Open-Source LLM Performance Rankings -- Top 10 (April 2026)

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

#### Qwen (Tongyi Qianwen) Full Version Line

| Model | Architecture | Parameters | Released | Notes |
|-------|-------------|-----------|----------|-------|
| Qwen3 (0.6B-32B) | Dense | 0.6B, 1.7B, 4B, 8B, 14B, 32B | 2025.04 | Previous generation |
| Qwen3-235B-A22B | MoE | 235B / 22B active | 2025.04 | Previous gen flagship |
| **Qwen3.5-397B-A17B** | MoE | 397B / 17B active | 2026.02 | Current flagship MoE |
| **Qwen3.6-27B** | Dense | 27B | 2026.03-04 | **Latest dense, recommended** |
| **Qwen3.6-35B-A3B** | MoE | 35B / 3B active | 2026.03-04 | Lightweight MoE (few active params, good for simple tasks) |

#### Available Sizes from Major Vendors

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

#### Size Tiers and GPU Requirements

| Tier | Typical Size | GPU Needed | Positioning |
|------|-------------|-----------|------------|
| Tiny | 1-4B | Can run on CPU | Edge / embedded |
| Small | **7-9B** | 1x A10 | Best value; sufficient for most tasks |
| Medium | **14B** | 1x A10 (INT8) or 1x A100 | **Sweet spot** |
| Large | **27-32B** | 1x A100 | Strong capability, fits on a single card |
| X-Large | 70B | 1-2x A100 | Approaches closed-source model quality |
| Flagship | 200B-1.6T MoE | 4-8x A100 or more | Maximum performance |

**7-8B and 27-32B remain the two most popular self-hosted sizes** -- the former is synonymous with "good enough and cheap," the latter with "the strongest model that fits on a single card."

### Model Size vs. Capability Tiers

| Parameters | Capability | Handles Well | Struggles With |
|-----------|-----------|-------------|---------------|
| 1.5B-4B | Junior | Simple classification, keyword extraction, short summaries | Complex reasoning, long-form writing, style mimicry |
| **7B-8B** | Intermediate | Entity extraction, basic Q&A, template-based generation | Nuanced tone control, multi-turn complex reasoning |
| **14B** | Upper-intermediate | Most NLP tasks | Extremely complex chain-of-thought reasoning |
| **32B** | Strong | Complex writing, style mimicry, multi-factor reasoning | Nearly no weaknesses |
| 70B+ | Very strong | Full capability approaching closed-source models | Extremely high cost and deployment barrier |

The bigger the model, the better the comprehension and generation quality -- but the higher the cost. The key is to **find the smallest size that's "just good enough."**

### Sizing Principle: Let the Hardest Task Decide

A typical system has multiple LLM tasks. Model size should be determined by **the hardest task**. Running easy tasks on a big model is fine (just wasteful), but running hard tasks on a model that's too small will produce unacceptable quality.

Take a typical AI application that needs entity extraction, content summarization, style rewriting, and long-form generation:

| Task | Complexity | Minimum Viable | Recommended | Why |
|------|-----------|---------------|-------------|-----|
| Entity extraction (names, locations, etc.) | Low-Medium | 7B | 7B-14B | Structured output, fixed patterns |
| Content summarization | Low-Medium | 7B | 7B-14B | Extracting key information, relatively fixed patterns |
| Style rewriting (mimicking a specific tone) | Medium-High | 14B | 14B-32B | Needs to understand subtle stylistic differences |
| **Long-form generation** (synthesizing multiple contexts) | **Highest** | 14B | **32B** | Must combine multiple information sources while maintaining coherence and consistent style |

The bottleneck is long-form generation -- it needs to weave together diverse information and produce natural output in a specific style, demanding the most from the model's overall capabilities.

### Size vs. Cost: The GPU Tier Jump

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

### How to Make the Final Call: Benchmarking

Theoretical analysis can only narrow the options. The most reliable approach is to **test with real data**:

1. Prepare 20-30 representative test cases (simple, complex, and edge cases)
2. Call different model sizes via API (costs pennies)
3. Focus on comparing output quality for **the hardest task**
4. If the smaller model's quality is acceptable → save money, pick the smaller one; if noticeably worse → pick the larger one

Benchmarking helps you avoid two mistakes: choosing too large (overspending every month) or too small (quality gaps that require rework).

---

## GPU Selection Decision Tree

```
What model are you deploying?
│
├── Embedding model (≤8B)
│   └── FP16 VRAM ≤ 16 GB
│       └── Pick 1x A10 (24GB)
│           └── Choose the cheapest CPU/RAM config available
│
├── LLM ≤ 14B
│   └── FP8 VRAM ≤ 14 GB
│       └── Pick 1x A10 (24GB)
│
├── LLM 14B-32B
│   └── FP8 VRAM 16-38 GB
│       └── Won't fit on A10 → Pick 1x A100 80GB
│
├── LLM 32B-70B
│   └── FP8 VRAM 32-70 GB
│       └── Pick 1x A100 80GB (FP8/INT8)
│       └── Or 2x A100 80GB (FP16)
│
└── LLM > 70B (e.g. 235B MoE)
    └── FP8 VRAM > 100 GB
        └── Multi-GPU A100 or H100 → Very expensive; consider whether you truly need this
```

---

## Summary: Two-Step Sizing Method

1. **Calculate VRAM first**: parameter count x bytes per precision x 1.2 = VRAM needed
2. **Then pick the card**: find the cheapest single-GPU option that fits that VRAM requirement
