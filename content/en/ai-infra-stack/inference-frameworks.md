# 3. Inference Frameworks

Inference is using a trained model to get predictions — feeding it input and getting output. For large language models, that means giving it a prompt and getting a response back.

The core job of inference frameworks is: **make the model run fast while using fewer resources**. They implement extensive low-level optimizations (KV cache, continuous batching, tensor parallelism, etc.) so you don't have to.

| Framework | Developer | One-Liner |
|-----------|-----------|-----------|
| **vLLM** | UC Berkeley | Most popular LLM inference engine; uses PagedAttention for high throughput |
| **SGLang** | Stanford / UC Berkeley | High-performance LLM inference engine; excels at structured generation and multi-turn scheduling |
| **TGI** | Hugging Face | Text Generation Inference — Hugging Face's official inference server |
| **llama.cpp** | Georgi Gerganov | Pure C/C++ LLM inference; runs on CPU (no GPU required) |
| **Ollama** | Ollama | Built on llama.cpp; provides a Docker-like experience for running LLMs locally |

## vLLM

vLLM is currently the most widely used LLM inference engine. Its core innovation is **PagedAttention** — borrowing the virtual memory paging technique from operating systems to manage KV cache, dramatically improving VRAM utilization and throughput.

**Key features**:
- OpenAI-compatible API — your frontend can connect directly without code changes
- Continuous batching — unlike traditional approaches that wait for a batch of requests to accumulate before processing
- Tensor parallelism — split one model across multiple GPUs
- Supports nearly all mainstream open-source LLMs (Qwen, Llama, Mistral, DeepSeek, etc.)

TypeScript developer analogy: vLLM is like pm2 or Nginx — you wouldn't write an HTTP server from scratch to handle concurrency; you use a dedicated tool. vLLM is the "pm2" of LLM inference.

## SGLang

SGLang is a direct competitor to vLLM, also from academia (Stanford + UC Berkeley). SGLang has advantages in structured output (JSON Schema) and multi-turn conversation scenarios, powered by its core **RadixAttention** technology.

## llama.cpp / Ollama

llama.cpp is a pure C/C++ LLM inference library whose biggest feature is **no CUDA dependency** — it runs on CPU, Apple Silicon, and more. Ollama wraps it with a Docker-like user experience (`ollama run llama3`).

Best suited for: running small models on your dev machine for experimentation, or when you don't want to deal with GPU setup.

Inference is what most application developers care about — you take a pretrained model and serve it. But someone had to train that model first, and the framework story on the training side is different. That's the next section.

Next: [Training Frameworks →](./training-frameworks)
