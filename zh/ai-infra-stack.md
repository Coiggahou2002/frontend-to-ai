# AI 基础设施技术栈：从硬件到框架

> 本指南假设你是 TypeScript / Node.js 全栈开发者，正在向 AI 工程方向过渡。这里解释 AI 系统背后的硬件、运行库和框架分别是什么、做什么用的。

---

## 目录

- [分层架构总览](#分层架构总览)
- [AI 芯片](#ai-芯片)
- [NVIDIA 运行时栈：CUDA、cuDNN、NCCL](#nvidia-运行时栈cudacudnnnccl)
- [推理框架](#推理框架)
- [训练框架](#训练框架)
- [其他框架](#其他框架)
- [容器镜像与部署环境](#容器镜像与部署环境)

---

## 分层架构总览

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

---

## AI 芯片

AI 计算的核心是芯片。主流有三大类：

| 芯片 | 全称 | 谁做的 | 一句话说明 | 在哪能用 |
|------|------|--------|-----------|---------|
| **GPU** | Graphics Processing Unit | NVIDIA | AI 计算的事实标准，生态最成熟 | 几乎所有云平台 |
| **TPU** | Tensor Processing Unit | Google | 专为张量运算设计的 AI 芯片 | 仅 Google Cloud |
| **CPU** | Central Processing Unit | Intel / AMD | 通用处理器，适合小模型或纯推理场景 | 所有平台 |

类比：GPU 是安卓手机（开放、到处能买、App 生态最大），TPU 是 iPhone（封闭、只在 Google 的"苹果商店"里用，但特定场景下体验很好）。

> 此外，各大厂商也在开发自研 AI 芯片（如阿里的 PPU、亚马逊的 Trainium/Inferentia 等），通常针对自家云平台做了性价比优化，并提供一定程度的 CUDA 兼容层。作为入门者，优先掌握 GPU 生态就够了。

### GPU——AI 计算的事实标准

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

### TPU——Google 的专用 AI 芯片

TPU 是 Google 自研的 AI 加速芯片，从第一天起就专门为神经网络的张量（Tensor）运算而设计——不像 GPU 最初是做图形渲染，后来才被发现适合 AI。

- Google 自家大模型（Gemini、PaLM）全部在 TPU 上训练
- 外部用户只能通过 **Google Cloud** 租用，不能像 NVIDIA 显卡那样购买实体硬件
- 编程主要通过 **JAX / XLA** 框架，PyTorch 也能跑但支持不如 GPU 原生
- 最新一代 **TPU v6e (Trillium)**，单芯片 32 GB HBM，主要优势在大规模集群训练

**实际影响**：除非你在 Google Cloud 上工作，否则接触不到 TPU。绝大多数开发者的选择就是 NVIDIA GPU。

---

## NVIDIA 运行时栈：CUDA、cuDNN、NCCL

这三个是 NVIDIA GPU 上跑 AI 的基础设施，几乎所有 AI 框架都依赖它们。它们是框架和芯片之间的"翻译层"：框架说"我要做矩阵乘法"，运行库把这个请求翻译成芯片能执行的指令。

| 运行库 | 厂商 | 一句话说明 | 类比 |
|--------|------|-----------|------|
| **CUDA** | NVIDIA | GPU 通用计算平台，AI 计算的基石 | 操作系统——没有它 GPU 就是块砖 |
| **cuDNN** | NVIDIA | 深度学习专用加速库（卷积、注意力等） | 系统自带的"计算器 App"——专门加速神经网络运算 |
| **NCCL** | NVIDIA | 多卡/多机通信库（AllReduce 等集合通信） | 多辆卡车之间的对讲机——协调分布式训练 |

三者的协作关系：

```
你的代码（PyTorch / vLLM / ComfyUI…）
        |
        v
    框架层（PyTorch）
        |
        |-- 神经网络运算 --> cuDNN（卷积、注意力、激活函数的优化实现）
        |-- 多卡通信 ----> NCCL（多 GPU 之间同步梯度、分发数据）
        |
        v
      CUDA（GPU 通用计算平台，所有 GPU 计算的入口）
        |
        v
    NVIDIA GPU 硬件
```

**你不需要直接使用它们**——它们已经内置在各种容器镜像和框架里了。但理解这个层次有助于你看懂镜像描述中的版本号，比如 `CUDA 12.4 + cuDNN 9.1 + NCCL 2.21`。

### CUDA

- **全称**：Compute Unified Device Architecture
- **作用**：让开发者能在 NVIDIA GPU 上运行通用计算任务（不仅仅是图形渲染）
- **地位**：AI 计算的事实标准。PyTorch、TensorFlow、vLLM 等几乎所有 AI 框架都基于 CUDA
- **你会碰到的地方**：Docker 镜像名里经常出现 `cuda12.4` 等版本号

对 TypeScript 开发者的类比：CUDA 之于 GPU，就像 V8 引擎之于 Chrome——它是让 GPU 能跑通用计算代码的底层执行引擎。

### cuDNN

- **全称**：CUDA Deep Neural Network Library
- **作用**：提供高度优化的深度学习基本运算（卷积、池化、归一化、注意力机制等）
- **为什么需要它**：你当然可以用纯 CUDA 写卷积运算，但 cuDNN 的实现比手写快 2-10 倍——NVIDIA 的工程师针对每代 GPU 架构都做了深度调优

### NCCL

- **全称**：NVIDIA Collective Communications Library
- **作用**：多 GPU 分布式训练时，各卡之间需要频繁交换数据（同步梯度、收集结果）。NCCL 提供这些集合通信操作的高效实现
- **什么时候用到**：多卡部署（张量并行）时必需。如果用 1 张卡部署，不涉及 NCCL

---

## 推理框架

推理（Inference）就是把一个已经训练好的模型拿来"用"——给它输入，它给你输出。对大语言模型来说，就是给一段 prompt，模型吐出回复。

推理框架的核心任务是：**让模型跑得又快又省资源**。它们做了大量底层优化（KV Cache、连续批处理、张量并行等），你不需要自己实现这些。

| 框架 | 开发者 | 一句话说明 |
|------|--------|-----------|
| **vLLM** | UC Berkeley | 最流行的 LLM 推理引擎，PagedAttention 技术实现高吞吐 |
| **SGLang** | Stanford / UC Berkeley | 高性能 LLM 推理引擎，擅长结构化生成和多轮对话调度 |
| **TGI** | Hugging Face | Text Generation Inference，Hugging Face 官方推理服务器 |
| **llama.cpp** | Georgi Gerganov | 纯 C/C++ 实现的 LLM 推理，可以在 CPU 上跑（不需要 GPU） |
| **Ollama** | Ollama | 基于 llama.cpp，提供类 Docker 体验的本地 LLM 运行工具 |

### vLLM

vLLM 是目前最广泛使用的 LLM 推理引擎。它的核心创新是 **PagedAttention**——借鉴操作系统的虚拟内存分页技术来管理 KV Cache，大幅提高了显存利用率和吞吐量。

**关键特性**：
- OpenAI 兼容的 API 接口——前端直接对接，不用改代码
- 支持连续批处理（Continuous Batching），不像传统方式需要等一批请求凑齐才处理
- 张量并行，一个模型拆到多张卡上跑
- 支持几乎所有主流开源 LLM（Qwen、Llama、Mistral、DeepSeek 等）

对 TypeScript 开发者的类比：vLLM 就像 pm2 或 Nginx——你不会自己从头写 HTTP 服务器来处理并发，而是用专门的工具。vLLM 就是 LLM 推理的 "pm2"。

### SGLang

SGLang 和 vLLM 是直接竞争对手，同样来自学术界（Stanford + UC Berkeley）。SGLang 在结构化输出（JSON Schema）和多轮对话场景上有优势，核心是 **RadixAttention** 技术。

### llama.cpp / Ollama

llama.cpp 是一个纯 C/C++ 实现的 LLM 推理库，最大特点是**不依赖 CUDA**——可以在 CPU、Apple Silicon 上跑。Ollama 在此基础上封装了类似 Docker 的使用体验（`ollama run llama3`）。

适合场景：个人开发机上跑小模型做实验、不想折腾 GPU 环境。

---

## 训练框架

训练就是让模型从数据中"学"的过程。训练大模型的核心挑战是：**模型太大，一张卡装不下**。

| 框架 | 开发者 | 一句话说明 |
|------|--------|-----------|
| **DeepSpeed** | 微软 | 分布式训练优化库，让大模型训练更省显存、更快 |
| **Transformers** | Hugging Face | 模型库 + 训练/推理框架，提供数千种预训练模型的统一接口 |

### DeepSpeed——大模型训练加速器

微软开发的深度学习优化库，核心解决一个问题：**让原本训练不了的大模型能训练，让能训练的模型训练更快**。

类比：训练大模型就像搬家——家具（模型参数）太大、太多，一辆卡车（一张 GPU）装不下。DeepSpeed 的 ZeRO 技术就像把家具拆解，分装到多辆卡车上运输，到目的地再组装。

**核心技术**：
- **ZeRO（Zero Redundancy Optimizer）**：把模型状态拆分到多张卡上，每张卡只存一部分，极大节省显存
- **混合精度训练**：用 FP16 算、FP32 存，速度快且不丢精度
- **Pipeline Parallelism**：把模型按层切成若干段，每段放一张卡
- **DeepSpeed-Inference**：推理加速，支持张量并行

### Transformers——Hugging Face 模型库

Transformers 不仅仅是一个训练框架，更是一个统一的模型接口层。几乎所有开源大模型（Llama、Qwen、Mistral、DeepSeek 等）都通过 Transformers 库发布和加载。

对 TypeScript 开发者的类比：Transformers 之于 AI 模型，就像 npm 之于 JavaScript 包——它是事实上的标准分发和加载方式。

---

## 其他框架

### ComfyUI——可视化 AI 画图工作台

提供一个类似 Blender 节点编辑器的界面，可以通过拖拽和连线来搭建图像生成流程，而不是写代码。

类比：如果 Stable Diffusion 是一台相机，ComfyUI 就是一个可视化的暗房——你可以任意组合"加载模型 -> 写提示词 -> 采样 -> 放大 -> 输出"等步骤。

**技术特点**：
- 基于节点的工作流设计，每个操作是一个"节点"
- 支持 Stable Diffusion 1.5/XL/3、FLUX、ControlNet 等几乎所有主流图像生成模型
- 可以保存和分享工作流（JSON 格式）
- 比 WebUI（另一个常见的 SD 界面）更灵活、更适合复杂流程

### Diffusers——扩散模型的统一工具箱

Hugging Face 出品的扩散模型库，提供一行代码就能调用各种图像/音频生成模型的简洁接口。

类比：如果各种图像生成模型（Stable Diffusion、SDXL、FLUX）是不同品牌的相机，Diffusers 就是一个万能遥控器——统一的操作方式控制所有相机。

**与 ComfyUI 的区别**：
- Diffusers 是**代码库**（写 Python 调用）
- ComfyUI 是**图形界面**（拖拽节点操作）
- ComfyUI 底层可以用 Diffusers

---

## 容器镜像与部署环境

在 AI 工程中，容器镜像（Docker Image）是标准的部署方式。一个 AI 容器镜像会打包好所有依赖：

```
一个典型的 LLM 推理镜像包含：
+------------------------------------------+
| 你的推理服务代码                           |
| vLLM / SGLang（推理框架）                  |
| PyTorch（底层计算框架）                     |
| CUDA 12.4 + cuDNN 9.1 + NCCL 2.21        |
| Ubuntu 22.04（基础操作系统）                |
+------------------------------------------+
```

**为什么要用容器镜像？**

CUDA、cuDNN、PyTorch 之间有严格的版本依赖关系（CUDA 12.4 需要特定版本的 cuDNN，PyTorch 2.3 需要特定版本的 CUDA……）。手动配置这些环境非常痛苦，一个版本不对就全盘崩溃。容器镜像把这些全部打包好，确保一致性。

对 TypeScript 开发者的类比：就像你用 `package-lock.json` 锁定依赖版本一样，容器镜像把整个运行环境（操作系统 + 驱动 + 库 + 框架）都锁定了。

**常见的镜像来源**：
- **NVIDIA NGC**（NVIDIA GPU Cloud）：官方提供的各种预构建 AI 容器镜像
- **Hugging Face 镜像**：TGI、TEI 等推理服务的官方镜像
- **各云平台镜像库**：AWS、GCP、Azure、阿里云等各自提供预配置的 AI 镜像
- **Docker Hub**：社区维护的各种 AI 相关镜像

**典型工作流**：选一个基础镜像（如 `nvidia/cuda:12.4-runtime`），在此基础上安装推理框架和你的代码，构建成自定义镜像，然后部署到云平台的 GPU 实例上。
