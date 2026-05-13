# AI Infrastructure Stack: From Hardware to Frameworks

In [the previous chapter](../gpu-and-model-sizing) you sized a model — VRAM, parameter count, quantization. That answers "what hardware do I need?" This chapter answers the next question: **what software runs on that hardware to make it serve a model?**

The AI deployment stack is layered like an onion. From the lowest-level hardware to the application code you write, each layer depends on the one below it:

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

This chapter walks the layers bottom-up:

1. [AI Chips](./chips) — GPU, TPU, CPU; what each is good for
2. [The NVIDIA Runtime Stack](./runtime-stack) — CUDA, cuDNN, NCCL; the translation layer
3. [Inference Frameworks](./inference-frameworks) — vLLM, SGLang, TGI, llama.cpp, Ollama
4. [Training Frameworks](./training-frameworks) — DeepSpeed, Transformers
5. [Other Frameworks](./other-frameworks) — ComfyUI, Diffusers (image generation)
6. [Container Images and Deployment](./container-images) — how it all gets shipped

By the end you should be able to read a phrase like `vLLM 0.6 + PyTorch 2.4 + CUDA 12.4 on H100` and know exactly which layer each piece sits on, and why each version matters.

Next: [AI Chips →](./chips)
