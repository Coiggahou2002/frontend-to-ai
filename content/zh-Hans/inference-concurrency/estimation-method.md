# 2. 估算方法论

上一节讲清楚了所有零件，本节是把它们组装起来的食谱：五步流程，按顺序走一遍，就能从 `config.json` 和 GPU 规格表得到一个并发数。把这套流程背下来——你在工作中遇到的所有并发问题，本质上都是它的变体。

## Step 1: 计算模型权重占用

```
权重显存 = 总参数量 × bytes_per_param
```

常见精度：

| 精度 | bytes_per_param |
|---|---|
| BF16 / FP16 | 2 |
| FP8 | 1 |
| INT4 | 0.5 |

注意：MoE 模型的总参数量远大于激活参数量，权重占用按**总参数**计算。

## Step 2: 计算每 token 的 KV cache 大小

```
kv_per_token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
```

其中 `bytes_per_element` 取决于 KV cache 的存储精度：
- 默认与模型精度相同（BF16 = 2 bytes）
- vLLM 支持 `--kv-cache-dtype fp8` 将 KV cache 量化到 FP8（1 byte），显存减半，精度损失极小

## Step 3: 计算可用 KV cache 显存

```
可用 KV 显存 = 总显存 × gpu_memory_utilization - 权重显存 - 开销
```

- `gpu_memory_utilization`：vLLM 默认 0.9，即只用 90% 显存，留 10% 给 CUDA 上下文和碎片
- `开销`：激活值、临时缓冲区等，通常 1-3 GB

## Step 4: 计算最大并发

```
KV token 总预算 = 可用 KV 显存 / kv_per_token
最大并发请求数 = KV token 总预算 / 每请求平均 token 数
```

**每请求的 token 数 = 输入 token + 输出 token**，两者都占 KV cache。

注意：这是**理论上限**。实际运行中，vLLM 的 PagedAttention 会有一定的内存碎片，实际可用通常是理论值的 85-95%。

## Step 5: 估算吞吐量

**Decode 吞吐（bandwidth-bound 区域）：**

```
单 token 延迟 = 权重大小(bytes) / 总带宽(bytes/s) + TP通信延迟
decode 吞吐 = batch_size / 单 token 延迟
```

**Prefill 吞吐（compute-bound 区域）：**

```
prefill 吞吐 ≈ 总算力(FLOPS) / (2 × 模型参数量)   （tokens/s）
```

粗估因子 `2` 来自每个参数在前向传播中大约做 2 次浮点运算（乘加各一次）。

**实际吞吐**是 prefill 和 decode 的混合，取决于请求的输入/输出比例。Batch 推理（输入长、输出短）以 prefill 为主；对话场景（输入短、输出长）以 decode 为主。

---

数学部分到此为止。在把这些公式套到一个真实例子之前，还有最后一块拼图：vLLM 在运行时已经替你做了大部分调度工作，下一节会讲清楚什么是自动的，什么需要你手动管。

下一节：[vLLM 自动并发管理](./vllm-auto-concurrency)
