# 2. 推理框架如何管理 KV Cache

模型架构决定了 KV cache 存什么、每个 token 存多大。推理框架决定了这些数据怎么在显存中摆放、怎么调度、怎么复用。

## 简单方式：连续预分配

HuggingFace Transformers 等简单框架的做法：为每个请求预分配一个 `max_length × kv_size` 的连续张量。

问题：
- 如果请求实际只用了 2K token，但 max_length 是 4K，就浪费了一半显存
- 不同请求的实际长度不同，但预分配按最大长度算，碎片严重
- 难以支持高并发

## PagedAttention：vLLM 的核心创新

vLLM 提出的 PagedAttention 借鉴了操作系统的虚拟内存分页机制：

1. 把 KV cache 的显存切成固定大小的"页"（block）
2. 每个请求按需申请页——实际用了多少 token，就分配多少页
3. 请求完成后释放页，归还给空闲池
4. 不同请求的页可以不连续地散布在显存中

效果：
- 显存利用率从预分配方式的 60-70% 提升到 95%+
- 支持动态并发——短请求多时自动多塞，长请求来了自动让出空间
- 同一显存能支持更多并发请求

## 各框架对比

| 框架 | KV cache 管理方式 | 特点 |
|---|---|---|
| HuggingFace Transformers | 连续张量预分配 | 简单，浪费严重 |
| vLLM | PagedAttention 分页管理 | 高利用率，动态并发 |
| SGLang | RadixAttention | 类似分页 + 前缀树优化 |
| TensorRT-LLM | 分页 + NVIDIA 算子融合 | 高性能，NVIDIA 专用 |
| llama.cpp | 连续缓冲区 | 轻量，适合单请求 |

分页解决了摆放问题。再往下一层是精度——每个 KV 元素到底占多少字节。

下一节：[精度优化 →](./precision-optimization)
