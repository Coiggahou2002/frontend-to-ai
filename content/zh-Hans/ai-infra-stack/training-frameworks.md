# 4. 训练框架

训练就是让模型从数据中"学"的过程。训练大模型的核心挑战是：**模型太大，一张卡装不下**。

| 框架 | 开发者 | 一句话说明 |
|------|--------|-----------|
| **DeepSpeed** | 微软 | 分布式训练优化库，让大模型训练更省显存、更快 |
| **Transformers** | Hugging Face | 模型库 + 训练/推理框架，提供数千种预训练模型的统一接口 |

## DeepSpeed——大模型训练加速器

微软开发的深度学习优化库，核心解决一个问题：**让原本训练不了的大模型能训练，让能训练的模型训练更快**。

类比：训练大模型就像搬家——家具（模型参数）太大、太多，一辆卡车（一张 GPU）装不下。DeepSpeed 的 ZeRO 技术就像把家具拆解，分装到多辆卡车上运输，到目的地再组装。

**核心技术**：
- **ZeRO（Zero Redundancy Optimizer）**：把模型状态拆分到多张卡上，每张卡只存一部分，极大节省显存
- **混合精度训练**：用 FP16 算、FP32 存，速度快且不丢精度
- **Pipeline Parallelism**：把模型按层切成若干段，每段放一张卡
- **DeepSpeed-Inference**：推理加速，支持张量并行

## Transformers——Hugging Face 模型库

Transformers 不仅仅是一个训练框架，更是一个统一的模型接口层。几乎所有开源大模型（Llama、Qwen、Mistral、DeepSeek 等）都通过 Transformers 库发布和加载。

对 TypeScript 开发者的类比：Transformers 之于 AI 模型，就像 npm 之于 JavaScript 包——它是事实上的标准分发和加载方式。

到这里 LLM 的推理和训练框架都讲完了。但"AI"不止 LLM——图像生成有自己的一套生态，习惯也不太一样。下一节看一下。

下一节：[其他框架 →](./other-frameworks)
