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

| Model | VRAM | FP16 Compute | Use Case |
|-------|------|--------------|----------|
| T4 | 16 GB | 65 TFLOPS | Cost-optimised inference (common legacy cloud instance) |
| V100 | 16 / 32 GB | 112 TFLOPS | Training (two gens back, high historical availability) |
| L4 | 24 GB | 121 TFLOPS | Efficient inference, very low power (72 W) |
| RTX 4090 | 24 GB | 165 TFLOPS | Consumer flagship, personal dev / small-scale fine-tuning |
| L20 | 48 GB | ~181 TFLOPS | Inference, double the VRAM of L4 |
| A100 | 40 / 80 GB | 312 TFLOPS | Training + inference (previous-gen flagship) |
| H100 | 80 GB | 989 TFLOPS | Current training flagship |
| H200 | 141 GB | 989 TFLOPS | H100 compute + HBM3e memory, inference-first |
| B200 | 192 GB | ~2,250 TFLOPS | Blackwell flagship, next-gen training standard |
| B300 | 288 GB | > 4,000 TFLOPS | Blackwell Ultra, extreme-scale training |

## TPU — Google's Dedicated AI Chip

TPU is Google's in-house AI accelerator chip, designed from day one specifically for neural network tensor operations — unlike GPUs, which were originally built for graphics rendering and only later discovered to be good at AI.

- Google's own large models (Gemini, PaLM) are all trained on TPUs
- External users can only rent TPUs through **Google Cloud** — you can't buy physical hardware like you can with NVIDIA GPUs
- Programming is primarily through the **JAX / XLA** framework; PyTorch can run but with less native support compared to GPU
- The latest generation **TPU v6e (Trillium)** has 32 GB HBM per chip, with primary advantages in large-scale cluster training

**Practical impact**: Unless you're working on Google Cloud, you won't encounter TPUs. The vast majority of developers' choice is NVIDIA GPU.

So in practice the rest of this chapter assumes you're on NVIDIA. The next layer up is what makes that GPU actually usable as a compute device — the runtime stack.

Next: [The NVIDIA Runtime Stack →](./runtime-stack)
