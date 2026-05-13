# 3. KV Cache 精度优化

除了架构层面的压缩（GQA、MLA），推理框架还可以在存储精度上做文章。

## `--kv-cache-dtype fp8` 的效果

vLLM 支持将 KV cache 从默认的 BF16（每元素 2 bytes）量化到 FP8（每元素 1 byte）。

一个容易忽略的默认行为：**即使模型权重是 FP8，vLLM 的 KV cache 默认仍然用 BF16 存储。** 必须显式加 `--kv-cache-dtype fp8` 才能让 KV cache 也用 FP8。

效果是每 token 的 KV cache 直接减半，在同样的显存预算下并发翻倍：

| 指标 | BF16 KV（默认） | FP8 KV |
|---|---|---|
| 每 token KV (Qwen3.6-27B) | 256 KB | 128 KB |
| 可用 KV 显存 58GB 下的 token 预算 | ~24 万 | ~47 万 |
| 4K 请求最大并发 | ~57 | ~115 |

FP8 KV cache 的精度损失在绝大多数任务中可以忽略不计，是性价比最高的优化之一。

架构、布局、精度，三条路都是从不同角度攻同一个问题：让单个请求的 KV 占用变小。第四个杠杆走的是另一条路——不缩小单个请求，而是消除请求之间重复的 KV。

下一节：[Prefix caching →](./prefix-caching)
