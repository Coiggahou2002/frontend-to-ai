# 2. VRAM and Precision

The previous section ended on a question: how many GB of VRAM does a given model need? This section answers it concretely, then introduces the GPU lineup you'll choose from.

## What Is VRAM, Again

GPU VRAM (Video RAM) is the GPU's own dedicated memory. All model parameters (weights) must be loaded into VRAM before the model can run. **VRAM size determines how large a model you can run** -- this is the single most important spec when choosing hardware.

Key distinction:
- **System RAM**: the CPU's memory -- e.g. 30 GiB / 60 GiB / 128 GiB
- **GPU VRAM**: determined by GPU model -- e.g. A10 = 24 GB, A100 = 80 GB

## How Model Parameters Map to VRAM

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
- **KV Cache**: the model needs to remember conversation context; this also lives in VRAM, and grows with context length (the [KV cache chapter](../kv-cache) goes deep on this)
- **Inference framework**: vLLM, TGI, etc. each consume some VRAM
- **OS reservation**: GPUs typically reserve 0.5-1 GB

Rule of thumb: **actual VRAM needed = model weight size x 1.2** (20% headroom for KV Cache, etc.).

## Is Lower Precision Always Better?

No. Reducing precision (quantization) is fundamentally **trading quality for VRAM and speed**:

| Precision | Quality Loss | Best Use Case |
|-----------|-------------|---------------|
| FP16 / BF16 | None | First choice when budget allows |
| FP8 | Negligible (usually imperceptible) | **Best price/performance, recommended** |
| INT8 | Slight | Practical choice when VRAM is tight |
| INT4 | Noticeable (complex reasoning and subtle semantics degrade) | Only when VRAM is truly insufficient |

For most production workloads (entity extraction, text generation, summarization, etc.), FP8 is more than sufficient.

## Common GPU Models at a Glance

Mainstream GPU models available on cloud platforms:

| GPU | VRAM | Generation | Performance Tier | Suitable Model Scale |
|-----|------|-----------|-----------------|---------------------|
| **T4** | 16 GB | 2018 (older) | Entry-level | ≤7B (FP16) |
| **A10** | 24 GB | 2021 | Mid-range | ≤8B (FP16) or ≤14B (INT8) |
| **V100** | 16/32 GB | 2017 (old) | Upper-mid | Worse price/perf than A10; not recommended for new projects |
| **A100** | **40 GB or 80 GB** | 2020 | High-end | ≤32B (FP8@80GB) or ≤70B (multi-GPU) |
| **H100/H800** | 80 GB | 2023 | Flagship | Large-scale models |

You will see these names everywhere in cloud GPU pricing pages, vendor benchmarks, and infra discussions. The mental shortcut: **A10 = 24 GB, A100 = 80 GB**. Almost every sizing decision in this chapter will reduce to "fits on A10" vs "needs A100" vs "needs multi-GPU."

Next: [Multi-GPU, MoE, and the rest →](./multi-gpu-and-moe)
