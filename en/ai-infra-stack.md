# AI Infrastructure Stack: From Hardware to Frameworks

> This guide assumes you're a TypeScript / Node.js full-stack developer transitioning into AI engineering. It explains the hardware, runtimes, and frameworks behind AI systems — what they are and what they do.

---

## Table of Contents

- [Layered Architecture Overview](#layered-architecture-overview)
- [AI Chips](#ai-chips)
- [The NVIDIA Runtime Stack: CUDA, cuDNN, NCCL](#the-nvidia-runtime-stack-cuda-cudnn-nccl)
- [Inference Frameworks](#inference-frameworks)
- [Training Frameworks](#training-frameworks)
- [Other Frameworks](#other-frameworks)
- [Container Images and Deployment Environments](#container-images-and-deployment-environments)

---

## Layered Architecture Overview

The AI deployment software stack is layered like an onion. From the lowest-level hardware to the application code you write, each layer depends on the one below it:

```
Your code (API services, web apps...)
        |
        v
    Framework layer (vLLM / DeepSpeed / ComfyUI...)
        |
        v
    Runtime layer (CUDA / cuDNN / NCCL...)
        |
        v
    Hardware (GPU / TPU / CPU)
```

**Analogy: If AI deployment were running a restaurant —**
- **Chips (GPU / TPU / CPU)** = Kitchen stoves (hardware compute power)
- **Runtimes (CUDA, cuDNN, NCCL...)** = Gas pipes and electrical wiring (low-level drivers that make the stoves usable)
- **Frameworks (vLLM, ComfyUI, DeepSpeed...)** = Recipes and workflows (tell the stoves how to cook)
- **Container images** = A pre-packaged "kitchen" with drivers installed and recipes configured — ready to cook on startup

For TypeScript developers, here's a mapping: hardware = physical server, runtimes = the Node.js runtime, frameworks = Express / Next.js, container images = Docker images.

---

## AI Chips

Chips are the core of AI computation. There are three major categories:

| Chip | Full Name | Made By | One-Liner | Where Available |
|------|-----------|---------|-----------|-----------------|
| **GPU** | Graphics Processing Unit | NVIDIA | The de facto standard for AI compute; most mature ecosystem | Nearly all cloud platforms |
| **TPU** | Tensor Processing Unit | Google | AI chip designed specifically for tensor operations | Google Cloud only |
| **CPU** | Central Processing Unit | Intel / AMD | General-purpose processor; suitable for small models or inference-only workloads | All platforms |

Analogy: GPUs are like Android phones (open, available everywhere, largest app ecosystem). TPUs are like iPhones (closed, only available in Google's "App Store," but excellent in specific scenarios).

> Additionally, various vendors are developing their own AI chips (e.g., Alibaba's PPU, Amazon's Trainium/Inferentia), typically optimized for cost-effectiveness on their own cloud platforms with some degree of CUDA compatibility. As a beginner, mastering the GPU ecosystem is sufficient.

### GPU — The De Facto Standard for AI Compute

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

### TPU — Google's Dedicated AI Chip

TPU is Google's in-house AI accelerator chip, designed from day one specifically for neural network tensor operations — unlike GPUs, which were originally built for graphics rendering and only later discovered to be good at AI.

- Google's own large models (Gemini, PaLM) are all trained on TPUs
- External users can only rent TPUs through **Google Cloud** — you can't buy physical hardware like you can with NVIDIA GPUs
- Programming is primarily through the **JAX / XLA** framework; PyTorch can run but with less native support compared to GPU
- The latest generation **TPU v6e (Trillium)** has 32 GB HBM per chip, with primary advantages in large-scale cluster training

**Practical impact**: Unless you're working on Google Cloud, you won't encounter TPUs. The vast majority of developers' choice is NVIDIA GPU.

---

## The NVIDIA Runtime Stack: CUDA, cuDNN, NCCL

These three are the foundational infrastructure for running AI on NVIDIA GPUs — virtually every AI framework depends on them. They serve as the "translation layer" between frameworks and chips: the framework says "I need to do a matrix multiplication," and the runtime translates that request into instructions the chip can execute.

| Runtime | Vendor | One-Liner | Analogy |
|---------|--------|-----------|---------|
| **CUDA** | NVIDIA | General-purpose GPU computing platform; the cornerstone of AI compute | The operating system — without it, the GPU is just a brick |
| **cuDNN** | NVIDIA | Deep learning acceleration library (convolution, attention, etc.) | A built-in "calculator app" — purpose-built to speed up neural network operations |
| **NCCL** | NVIDIA | Multi-GPU/multi-node communication library (AllReduce, etc.) | Walkie-talkies between trucks — coordinating distributed training |

How the three work together:

```
Your code (PyTorch / vLLM / ComfyUI...)
        |
        v
    Framework layer (PyTorch)
        |
        |-- Neural network ops --> cuDNN (optimized convolution, attention, activation functions)
        |-- Multi-GPU comms ----> NCCL (synchronize gradients, distribute data across GPUs)
        |
        v
      CUDA (general-purpose GPU computing platform; entry point for all GPU computation)
        |
        v
    NVIDIA GPU Hardware
```

**You don't need to use them directly** — they're already built into container images and frameworks. But understanding this hierarchy helps you read image descriptions with version numbers like `CUDA 12.4 + cuDNN 9.1 + NCCL 2.21`.

### CUDA

- **Full name**: Compute Unified Device Architecture
- **Purpose**: Enables developers to run general-purpose computing tasks on NVIDIA GPUs (not just graphics rendering)
- **Status**: The de facto standard for AI compute. PyTorch, TensorFlow, vLLM, and nearly all AI frameworks are built on CUDA
- **Where you'll encounter it**: Docker image names frequently include version numbers like `cuda12.4`

TypeScript developer analogy: CUDA is to GPUs what the V8 engine is to Chrome — the underlying execution engine that lets GPUs run general-purpose compute code.

### cuDNN

- **Full name**: CUDA Deep Neural Network Library
- **Purpose**: Provides highly optimized implementations of fundamental deep learning operations (convolution, pooling, normalization, attention mechanisms, etc.)
- **Why it's needed**: You could write convolution operations in raw CUDA, but cuDNN's implementations are 2-10x faster than hand-written code — NVIDIA's engineers do deep tuning for each GPU architecture generation

### NCCL

- **Full name**: NVIDIA Collective Communications Library
- **Purpose**: During multi-GPU distributed training, GPUs need to frequently exchange data (synchronize gradients, gather results). NCCL provides highly efficient implementations of these collective communication operations
- **When it's used**: Required for multi-GPU deployment (tensor parallelism). If you deploy on a single GPU, NCCL isn't involved

---

## Inference Frameworks

Inference is using a trained model to get predictions — feeding it input and getting output. For large language models, that means giving it a prompt and getting a response back.

The core job of inference frameworks is: **make the model run fast while using fewer resources**. They implement extensive low-level optimizations (KV cache, continuous batching, tensor parallelism, etc.) so you don't have to.

| Framework | Developer | One-Liner |
|-----------|-----------|-----------|
| **vLLM** | UC Berkeley | Most popular LLM inference engine; uses PagedAttention for high throughput |
| **SGLang** | Stanford / UC Berkeley | High-performance LLM inference engine; excels at structured generation and multi-turn scheduling |
| **TGI** | Hugging Face | Text Generation Inference — Hugging Face's official inference server |
| **llama.cpp** | Georgi Gerganov | Pure C/C++ LLM inference; runs on CPU (no GPU required) |
| **Ollama** | Ollama | Built on llama.cpp; provides a Docker-like experience for running LLMs locally |

### vLLM

vLLM is currently the most widely used LLM inference engine. Its core innovation is **PagedAttention** — borrowing the virtual memory paging technique from operating systems to manage KV cache, dramatically improving VRAM utilization and throughput.

**Key features**:
- OpenAI-compatible API — your frontend can connect directly without code changes
- Continuous batching — unlike traditional approaches that wait for a batch of requests to accumulate before processing
- Tensor parallelism — split one model across multiple GPUs
- Supports nearly all mainstream open-source LLMs (Qwen, Llama, Mistral, DeepSeek, etc.)

TypeScript developer analogy: vLLM is like pm2 or Nginx — you wouldn't write an HTTP server from scratch to handle concurrency; you use a dedicated tool. vLLM is the "pm2" of LLM inference.

### SGLang

SGLang is a direct competitor to vLLM, also from academia (Stanford + UC Berkeley). SGLang has advantages in structured output (JSON Schema) and multi-turn conversation scenarios, powered by its core **RadixAttention** technology.

### llama.cpp / Ollama

llama.cpp is a pure C/C++ LLM inference library whose biggest feature is **no CUDA dependency** — it runs on CPU, Apple Silicon, and more. Ollama wraps it with a Docker-like user experience (`ollama run llama3`).

Best suited for: running small models on your dev machine for experimentation, or when you don't want to deal with GPU setup.

---

## Training Frameworks

Training is the process of a model "learning" from data. The core challenge of training large models is: **the model is too big to fit on a single GPU**.

| Framework | Developer | One-Liner |
|-----------|-----------|-----------|
| **DeepSpeed** | Microsoft | Distributed training optimization library; makes large model training more memory-efficient and faster |
| **Transformers** | Hugging Face | Model hub + training/inference framework; provides a unified interface for thousands of pretrained models |

### DeepSpeed — Large Model Training Accelerator

A deep learning optimization library developed by Microsoft that solves one core problem: **make models that couldn't be trained trainable, and make trainable models train faster**.

Analogy: Training a large model is like moving house — the furniture (model parameters) is too big and there's too much of it for one truck (one GPU) to carry. DeepSpeed's ZeRO technology is like disassembling the furniture, loading it across multiple trucks for transport, and reassembling it at the destination.

**Core technologies**:
- **ZeRO (Zero Redundancy Optimizer)**: Partitions model state across multiple GPUs so each GPU only stores a portion, dramatically reducing memory usage
- **Mixed-precision training**: Computes in FP16 and stores in FP32 — faster without losing accuracy
- **Pipeline Parallelism**: Splits the model by layers into segments, each on a different GPU
- **DeepSpeed-Inference**: Inference acceleration with tensor parallelism support

### Transformers — The Hugging Face Model Hub

Transformers is more than just a training framework — it's a unified model interface layer. Nearly all open-source large models (Llama, Qwen, Mistral, DeepSeek, etc.) are published and loaded through the Transformers library.

TypeScript developer analogy: Transformers is to AI models what npm is to JavaScript packages — the de facto standard for distribution and loading.

---

## Other Frameworks

### ComfyUI — Visual AI Image Generation Workbench

Provides a Blender-like node editor interface where you can build image generation pipelines by dragging and connecting nodes instead of writing code.

Analogy: If Stable Diffusion is a camera, ComfyUI is a visual darkroom — you can freely combine steps like "load model -> write prompt -> sample -> upscale -> output."

**Technical highlights**:
- Node-based workflow design where each operation is a "node"
- Supports Stable Diffusion 1.5/XL/3, FLUX, ControlNet, and nearly all mainstream image generation models
- Workflows can be saved and shared (JSON format)
- More flexible than WebUI (another common SD interface); better suited for complex pipelines

### Diffusers — Unified Toolkit for Diffusion Models

A diffusion model library by Hugging Face that provides a concise interface for calling various image/audio generation models with just one line of code.

Analogy: If the various image generation models (Stable Diffusion, SDXL, FLUX) are different camera brands, Diffusers is a universal remote control — one consistent interface to control them all.

**How it differs from ComfyUI**:
- Diffusers is a **code library** (you write Python to call it)
- ComfyUI is a **graphical interface** (you drag and drop nodes)
- ComfyUI can use Diffusers under the hood

---

## Container Images and Deployment Environments

In AI engineering, container images (Docker images) are the standard deployment method. An AI container image bundles all dependencies:

```
A typical LLM inference image contains:
+------------------------------------------+
| Your inference service code               |
| vLLM / SGLang (inference framework)       |
| PyTorch (underlying compute framework)    |
| CUDA 12.4 + cuDNN 9.1 + NCCL 2.21       |
| Ubuntu 22.04 (base operating system)      |
+------------------------------------------+
```

**Why container images?**

CUDA, cuDNN, and PyTorch have strict version dependencies (CUDA 12.4 requires a specific version of cuDNN; PyTorch 2.3 requires a specific version of CUDA...). Manually configuring these environments is painful — one wrong version and everything breaks. Container images bundle everything together, ensuring consistency.

TypeScript developer analogy: Just as you use `package-lock.json` to lock dependency versions, container images lock down the entire runtime environment (OS + drivers + libraries + frameworks).

**Common image sources**:
- **NVIDIA NGC** (NVIDIA GPU Cloud): Official pre-built AI container images
- **Hugging Face images**: Official images for inference services like TGI and TEI
- **Cloud platform registries**: AWS, GCP, Azure, Alibaba Cloud, etc. each provide pre-configured AI images
- **Docker Hub**: Community-maintained AI-related images

**Typical workflow**: Choose a base image (e.g., `nvidia/cuda:12.4-runtime`), install your inference framework and code on top of it, build a custom image, then deploy to a GPU instance on your cloud platform.
