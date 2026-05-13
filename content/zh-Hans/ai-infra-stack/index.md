# AI 基础设施技术栈：从硬件到框架

[上一章](../gpu-and-model-sizing)我们做了模型选型——显存、参数量、量化。那一章回答的是"我需要什么硬件"。本章回答下一个问题：**这块硬件上要跑哪些软件，才能把一个模型变成可用的服务？**

AI 部署的软件栈像洋葱一样分层。从最底层的硬件到你写的应用代码，每一层都依赖下一层：

```
你的代码（API 服务、Web 应用…）
        |
        v
    框架层（vLLM / DeepSpeed / ComfyUI…）
        |
        v
    运行库层（CUDA / cuDNN / NCCL…）
        |
        v
    硬件（GPU / TPU / CPU）
```

**类比：如果把 AI 部署比作开餐厅——**
- **芯片（GPU / TPU / CPU）** = 厨房灶台（硬件算力）
- **运行库（CUDA、cuDNN、NCCL…）** = 燃气管道和水电系统（底层驱动，让灶台能用）
- **框架（vLLM、ComfyUI、DeepSpeed…）** = 菜谱和工作流（告诉灶台怎么做菜）
- **容器镜像** = 一个打包好的"厨房"，灶台驱动装好、菜谱也配好，开机就能炒菜

对 TypeScript 开发者来说，可以这样映射：硬件 = 物理服务器，运行库 = Node.js 运行时，框架 = Express / Next.js，容器镜像 = Docker 镜像。

本章自下而上把每一层走一遍：

1. [AI 芯片](./chips)——GPU、TPU、CPU 各自适合什么
2. [NVIDIA 运行时栈](./runtime-stack)——CUDA、cuDNN、NCCL 这一层翻译层
3. [推理框架](./inference-frameworks)——vLLM、SGLang、TGI、llama.cpp、Ollama
4. [训练框架](./training-frameworks)——DeepSpeed、Transformers
5. [其他框架](./other-frameworks)——ComfyUI、Diffusers（图像生成）
6. [容器镜像与部署](./container-images)——这一切如何打包发车

读完本章，你应该能看到 `vLLM 0.6 + PyTorch 2.4 + CUDA 12.4 on H100` 这样一句话，立刻知道每个名词处在哪一层、每个版本号为什么重要。

下一节：[AI 芯片 →](./chips)
