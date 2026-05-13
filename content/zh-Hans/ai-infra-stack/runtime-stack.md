# 2. NVIDIA 运行时栈：CUDA、cuDNN、NCCL

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

## CUDA

- **全称**：Compute Unified Device Architecture
- **作用**：让开发者能在 NVIDIA GPU 上运行通用计算任务（不仅仅是图形渲染）
- **地位**：AI 计算的事实标准。PyTorch、TensorFlow、vLLM 等几乎所有 AI 框架都基于 CUDA
- **你会碰到的地方**：Docker 镜像名里经常出现 `cuda12.4` 等版本号

对 TypeScript 开发者的类比：CUDA 之于 GPU，就像 V8 引擎之于 Chrome——它是让 GPU 能跑通用计算代码的底层执行引擎。

## cuDNN

- **全称**：CUDA Deep Neural Network Library
- **作用**：提供高度优化的深度学习基本运算（卷积、池化、归一化、注意力机制等）
- **为什么需要它**：你当然可以用纯 CUDA 写卷积运算，但 cuDNN 的实现比手写快 2-10 倍——NVIDIA 的工程师针对每代 GPU 架构都做了深度调优

## NCCL

- **全称**：NVIDIA Collective Communications Library
- **作用**：多 GPU 分布式训练时，各卡之间需要频繁交换数据（同步梯度、收集结果）。NCCL 提供这些集合通信操作的高效实现
- **什么时候用到**：多卡部署（张量并行）时必需。如果用 1 张卡部署，不涉及 NCCL

运行时层 99% 的时间都是隐形的——你只在版本对不上时才会注意到它。你代码里真正调用的是再上一层的"框架"。下一节我们就从最常用的那种框架——LLM 推理框架——讲起。

下一节：[推理框架 →](./inference-frameworks)
