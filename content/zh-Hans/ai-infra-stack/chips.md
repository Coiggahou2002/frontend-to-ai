# 1. AI 芯片

AI 计算的核心是芯片。主流有三大类：

| 芯片 | 全称 | 谁做的 | 一句话说明 | 在哪能用 |
|------|------|--------|-----------|---------|
| **GPU** | Graphics Processing Unit | NVIDIA | AI 计算的事实标准，生态最成熟 | 几乎所有云平台 |
| **TPU** | Tensor Processing Unit | Google | 专为张量运算设计的 AI 芯片 | 仅 Google Cloud |
| **CPU** | Central Processing Unit | Intel / AMD | 通用处理器，适合小模型或纯推理场景 | 所有平台 |

类比：GPU 是安卓手机（开放、到处能买、App 生态最大），TPU 是 iPhone（封闭、只在 Google 的"苹果商店"里用，但特定场景下体验很好）。

> 此外，各大厂商也在开发自研 AI 芯片（如阿里的 PPU、亚马逊的 Trainium/Inferentia 等），通常针对自家云平台做了性价比优化，并提供一定程度的 CUDA 兼容层。作为入门者，优先掌握 GPU 生态就够了。

## GPU——AI 计算的事实标准

GPU（图形处理单元）最初是为了渲染游戏画面而设计的，但它的架构——成千上万个小核心并行计算——恰好也非常适合深度学习中的矩阵运算。

**为什么 GPU 而不是 CPU？** CPU 像一个顶尖工程师，擅长复杂的串行逻辑；GPU 像一个千人工厂，每个工人做简单的活但能同时开工。深度学习就是大规模并行的矩阵乘法，所以 GPU 是天然的加速器。

NVIDIA 的 GPU 生态（CUDA + cuDNN + NCCL）几乎垄断了 AI 领域。常见的 GPU 型号：

| 型号 | 显存 | 定位 |
|------|------|------|
| A100 | 40/80 GB | 训练 + 推理（上一代旗舰） |
| H100 | 80 GB | 当前训练旗舰 |
| H200 | 141 GB | 大显存推理优化 |
| L4 | 24 GB | 性价比推理卡 |
| RTX 4090 | 24 GB | 消费级最强（个人开发/小规模推理） |

## TPU——Google 的专用 AI 芯片

TPU 是 Google 自研的 AI 加速芯片，从第一天起就专门为神经网络的张量（Tensor）运算而设计——不像 GPU 最初是做图形渲染，后来才被发现适合 AI。

- Google 自家大模型（Gemini、PaLM）全部在 TPU 上训练
- 外部用户只能通过 **Google Cloud** 租用，不能像 NVIDIA 显卡那样购买实体硬件
- 编程主要通过 **JAX / XLA** 框架，PyTorch 也能跑但支持不如 GPU 原生
- 最新一代 **TPU v6e (Trillium)**，单芯片 32 GB HBM，主要优势在大规模集群训练

**实际影响**：除非你在 Google Cloud 上工作，否则接触不到 TPU。绝大多数开发者的选择就是 NVIDIA GPU。

所以本章后续都默认你用的是 NVIDIA。再往上一层，是让 GPU 真正能被当作通用计算设备来用的运行时栈。

下一节：[NVIDIA 运行时栈 →](./runtime-stack)
