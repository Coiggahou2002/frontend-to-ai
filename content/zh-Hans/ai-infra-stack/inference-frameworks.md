# 3. 推理框架

推理（Inference）就是把一个已经训练好的模型拿来"用"——给它输入，它给你输出。对大语言模型来说，就是给一段 prompt，模型吐出回复。

推理框架的核心任务是：**让模型跑得又快又省资源**。它们做了大量底层优化（KV Cache、连续批处理、张量并行等），你不需要自己实现这些。

| 框架 | 开发者 | 一句话说明 |
|------|--------|-----------|
| **vLLM** | UC Berkeley | 最流行的 LLM 推理引擎，PagedAttention 技术实现高吞吐 |
| **SGLang** | Stanford / UC Berkeley | 高性能 LLM 推理引擎，擅长结构化生成和多轮对话调度 |
| **TGI** | Hugging Face | Text Generation Inference，Hugging Face 官方推理服务器 |
| **llama.cpp** | Georgi Gerganov | 纯 C/C++ 实现的 LLM 推理，可以在 CPU 上跑（不需要 GPU） |
| **Ollama** | Ollama | 基于 llama.cpp，提供类 Docker 体验的本地 LLM 运行工具 |

## vLLM

vLLM 是目前最广泛使用的 LLM 推理引擎。它的核心创新是 **PagedAttention**——借鉴操作系统的虚拟内存分页技术来管理 KV Cache，大幅提高了显存利用率和吞吐量。

**关键特性**：
- OpenAI 兼容的 API 接口——前端直接对接，不用改代码
- 支持连续批处理（Continuous Batching），不像传统方式需要等一批请求凑齐才处理
- 张量并行，一个模型拆到多张卡上跑
- 支持几乎所有主流开源 LLM（Qwen、Llama、Mistral、DeepSeek 等）

对 TypeScript 开发者的类比：vLLM 就像 pm2 或 Nginx——你不会自己从头写 HTTP 服务器来处理并发，而是用专门的工具。vLLM 就是 LLM 推理的 "pm2"。

## SGLang

SGLang 和 vLLM 是直接竞争对手，同样来自学术界（Stanford + UC Berkeley）。SGLang 在结构化输出（JSON Schema）和多轮对话场景上有优势，核心是 **RadixAttention** 技术。

## llama.cpp / Ollama

llama.cpp 是一个纯 C/C++ 实现的 LLM 推理库，最大特点是**不依赖 CUDA**——可以在 CPU、Apple Silicon 上跑。Ollama 在此基础上封装了类似 Docker 的使用体验（`ollama run llama3`）。

适合场景：个人开发机上跑小模型做实验、不想折腾 GPU 环境。

应用开发者关心的多半是推理这一面——拿一个预训练模型把它服务化。但模型总得有人先训出来，训练侧的框架故事完全不同。下一节就是这块。

下一节：[训练框架 →](./training-frameworks)
