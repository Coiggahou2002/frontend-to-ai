# 2. The NVIDIA Runtime Stack: CUDA, cuDNN, NCCL

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

## CUDA

- **Full name**: Compute Unified Device Architecture
- **Purpose**: Enables developers to run general-purpose computing tasks on NVIDIA GPUs (not just graphics rendering)
- **Status**: The de facto standard for AI compute. PyTorch, TensorFlow, vLLM, and nearly all AI frameworks are built on CUDA
- **Where you'll encounter it**: Docker image names frequently include version numbers like `cuda12.4`

TypeScript developer analogy: CUDA is to GPUs what the V8 engine is to Chrome — the underlying execution engine that lets GPUs run general-purpose compute code.

## cuDNN

- **Full name**: CUDA Deep Neural Network Library
- **Purpose**: Provides highly optimized implementations of fundamental deep learning operations (convolution, pooling, normalization, attention mechanisms, etc.)
- **Why it's needed**: You could write convolution operations in raw CUDA, but cuDNN's implementations are 2-10x faster than hand-written code — NVIDIA's engineers do deep tuning for each GPU architecture generation

## NCCL

- **Full name**: NVIDIA Collective Communications Library
- **Purpose**: During multi-GPU distributed training, GPUs need to frequently exchange data (synchronize gradients, gather results). NCCL provides highly efficient implementations of these collective communication operations
- **When it's used**: Required for multi-GPU deployment (tensor parallelism). If you deploy on a single GPU, NCCL isn't involved

The runtime layer is invisible 99% of the time — you only notice it when versions don't match. What you actually call from your code lives one layer up: the framework. That's where we go next, starting with the most common one for serving LLMs.

Next: [Inference Frameworks →](./inference-frameworks)
