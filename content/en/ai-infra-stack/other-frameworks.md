# 5. Other Frameworks

Outside of LLMs, the most active area is **image generation** — Stable Diffusion, FLUX, and friends. Two tools dominate that world: ComfyUI (GUI) and Diffusers (code library).

## ComfyUI — Visual AI Image Generation Workbench

Provides a Blender-like node editor interface where you can build image generation pipelines by dragging and connecting nodes instead of writing code.

Analogy: If Stable Diffusion is a camera, ComfyUI is a visual darkroom — you can freely combine steps like "load model -> write prompt -> sample -> upscale -> output."

**Technical highlights**:
- Node-based workflow design where each operation is a "node"
- Supports Stable Diffusion 1.5/XL/3, FLUX, ControlNet, and nearly all mainstream image generation models
- Workflows can be saved and shared (JSON format)
- More flexible than WebUI (another common SD interface); better suited for complex pipelines

## Diffusers — Unified Toolkit for Diffusion Models

A diffusion model library by Hugging Face that provides a concise interface for calling various image/audio generation models with just one line of code.

Analogy: If the various image generation models (Stable Diffusion, SDXL, FLUX) are different camera brands, Diffusers is a universal remote control — one consistent interface to control them all.

**How it differs from ComfyUI**:
- Diffusers is a **code library** (you write Python to call it)
- ComfyUI is a **graphical interface** (you drag and drop nodes)
- ComfyUI can use Diffusers under the hood

We've now walked the entire stack from chips up through frameworks. The last piece is how all of this gets packaged and shipped to a server — which in AI engineering, is almost always a container image.

Next: [Container Images and Deployment →](./container-images)
