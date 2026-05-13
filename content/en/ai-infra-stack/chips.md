# 1. AI Chips

Chips are the core of AI computation. There are three major categories:

| Chip | Full Name | Made By | One-Liner | Where Available |
|------|-----------|---------|-----------|-----------------|
| **GPU** | Graphics Processing Unit | NVIDIA | The de facto standard for AI compute; most mature ecosystem | Nearly all cloud platforms |
| **TPU** | Tensor Processing Unit | Google | AI chip designed specifically for tensor operations | Google Cloud only |
| **CPU** | Central Processing Unit | Intel / AMD | General-purpose processor; suitable for small models or inference-only workloads | All platforms |

Analogy: GPUs are like Android phones (open, available everywhere, largest app ecosystem). TPUs are like iPhones (closed, only available in Google's "App Store," but excellent in specific scenarios).

> Additionally, various vendors are developing their own AI chips (e.g., Alibaba's PPU, Amazon's Trainium/Inferentia), typically optimized for cost-effectiveness on their own cloud platforms with some degree of CUDA compatibility. As a beginner, mastering the GPU ecosystem is sufficient.

## GPU — The De Facto Standard for AI Compute

GPUs (Graphics Processing Units) were originally designed for rendering game graphics, but their architecture — thousands of small cores computing in parallel — happens to be ideal for the matrix operations in deep learning.

**Why GPU instead of CPU?** A CPU is like one brilliant engineer, great at complex serial logic. A GPU is like a factory with thousands of workers — each one does simple tasks, but they all work simultaneously. Deep learning is fundamentally massive parallel matrix multiplication, making GPUs a natural accelerator.

NVIDIA's GPU ecosystem (CUDA + cuDNN + NCCL) holds a near-monopoly in AI. Common GPU models:

| Model | VRAM | Use Case |
|-------|------|----------|
| A100 | 40/80 GB | Training + inference (previous-gen flagship) |
| H100 | 80 GB | Current training flagship |
| H200 | 141 GB | Large-VRAM inference optimization |
| L4 | 24 GB | Cost-effective inference card |
| RTX 4090 | 24 GB | Best consumer-grade GPU (personal dev / small-scale inference) |

## TPU — Google's Dedicated AI Chip

TPU is Google's in-house AI accelerator chip, designed from day one specifically for neural network tensor operations — unlike GPUs, which were originally built for graphics rendering and only later discovered to be good at AI.

- Google's own large models (Gemini, PaLM) are all trained on TPUs
- External users can only rent TPUs through **Google Cloud** — you can't buy physical hardware like you can with NVIDIA GPUs
- Programming is primarily through the **JAX / XLA** framework; PyTorch can run but with less native support compared to GPU
- The latest generation **TPU v6e (Trillium)** has 32 GB HBM per chip, with primary advantages in large-scale cluster training

**Practical impact**: Unless you're working on Google Cloud, you won't encounter TPUs. The vast majority of developers' choice is NVIDIA GPU.

So in practice the rest of this chapter assumes you're on NVIDIA. The next layer up is what makes that GPU actually usable as a compute device — the runtime stack.

Next: [The NVIDIA Runtime Stack →](./runtime-stack)
