# 推理并发：原理、方法与实战

[第 9 章](../kv-cache) 讨论的是*单个*请求——KV cache 在哪里、怎么增长、为什么 decode 是带宽瓶颈。这一章回答下一个最自然的问题：**一台 GPU 机器同时能扛多少请求？怎么在上线之前就把这个数算出来？**

简短答案：并发是个反比例函数。在硬件和模型固定的前提下，最大并发数大约是 `K / X`，其中 `X` 是平均每请求的 token 数，`K` 是由显存和模型架构共同决定的常数。本章所有内容都是为了把这个 `K` 算得足够准，让你能据此规划部署规模。

## 学完这一章你应该能

- 拿到任意模型的 `config.json` 和任意 GPU 的规格表，针对目标请求长度，给出一个站得住脚的并发数。
- 解释为什么 `--kv-cache-dtype fp8` 能让并发翻倍，而 `--max-model-len` 并不会让并发下降。
- 看着 vLLM 的监控面板，判断当前是 bandwidth-bound、compute-bound，还是 KV 受限。
- 在 BF16 与 FP8 KV cache、TP=1 与 TP=2、保守与激进的 `gpu_memory_utilization` 之间做选择。
- 完整走完一个实战案例：Qwen3.6-27B FP8 on 2x L20，从架构参数到并发表，再到吞吐估算。

## 本章内容

1. [Prefill 与 Decode](./prefill-and-decode) — 推理两阶段、KV cache 机制、GQA、MLA、带宽 vs 算力、张量并行。先把心智模型建起来。
2. [估算方法论](./estimation-method) — 从 `config.json` 和 GPU 规格到并发数的五步流程。
3. [vLLM 自动并发管理](./vllm-auto-concurrency) — 为什么并发不需要手动设、为什么 max-model-len 是门槛而非预留、长短请求混合时调度器怎么做。
4. [实战案例：Qwen3.6-27B on 2x L20](./worked-example) — 完整数值过程，包括按上下文长度查并发的表。
5. [vLLM 调参](./vllm-tuning-parameters) — 真正起作用的那三个参数、优化前后对比、其他常用旋钮。
6. [快速估算清单](./quick-checklist) — 一页纸的六步流程，贴在终端旁边用。

本章假设你已经掌握 [第 9 章](../kv-cache) 中每 token KV cache 的公式，会直接在它的基础上展开。下一章 [微调实战](../fine-tuning) 会用到这些数字——并发数学告诉你，你微调出来的模型在现有硬件上是否真的扛得住流量。

下一节：[Prefill 与 Decode](./prefill-and-decode)
