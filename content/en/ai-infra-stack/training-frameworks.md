# 4. Training Frameworks

Training is the process of a model "learning" from data. The core challenge of training large models is: **the model is too big to fit on a single GPU**.

| Framework | Developer | One-Liner |
|-----------|-----------|-----------|
| **DeepSpeed** | Microsoft | Distributed training optimization library; makes large model training more memory-efficient and faster |
| **Transformers** | Hugging Face | Model hub + training/inference framework; provides a unified interface for thousands of pretrained models |

## DeepSpeed — Large Model Training Accelerator

A deep learning optimization library developed by Microsoft that solves one core problem: **make models that couldn't be trained trainable, and make trainable models train faster**.

Analogy: Training a large model is like moving house — the furniture (model parameters) is too big and there's too much of it for one truck (one GPU) to carry. DeepSpeed's ZeRO technology is like disassembling the furniture, loading it across multiple trucks for transport, and reassembling it at the destination.

**Core technologies**:
- **ZeRO (Zero Redundancy Optimizer)**: Partitions model state across multiple GPUs so each GPU only stores a portion, dramatically reducing memory usage
- **Mixed-precision training**: Computes in FP16 and stores in FP32 — faster without losing accuracy
- **Pipeline Parallelism**: Splits the model by layers into segments, each on a different GPU
- **DeepSpeed-Inference**: Inference acceleration with tensor parallelism support

## Transformers — The Hugging Face Model Hub

Transformers is more than just a training framework — it's a unified model interface layer. Nearly all open-source large models (Llama, Qwen, Mistral, DeepSeek, etc.) are published and loaded through the Transformers library.

TypeScript developer analogy: Transformers is to AI models what npm is to JavaScript packages — the de facto standard for distribution and loading.

So far we've covered LLM inference and training. But "AI" is broader than language models — image generation has its own ecosystem with very different conventions. That's what the next section covers.

Next: [Other Frameworks →](./other-frameworks)
