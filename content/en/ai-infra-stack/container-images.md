# 6. Container Images and Deployment Environments

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

---

That's the full stack: chip at the bottom, runtime translating, framework orchestrating, container shipping it. You can now read a deployment description like `vLLM 0.6 + PyTorch 2.4 + CUDA 12.4 on H100 (8x tensor parallel)` and place every piece on the right layer.

The next chapter zooms into one specific optimization that lives inside the inference framework layer — and that determines, more than almost anything else, how much VRAM you actually need and how many concurrent users one GPU can serve: the **KV cache**.

Next: [KV Cache →](../kv-cache)
