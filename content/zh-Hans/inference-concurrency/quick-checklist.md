# 6. 快速估算清单

给定任意模型和硬件，按以下步骤估算并发：

```
1. 查模型 config.json，记录:
   - num_hidden_layers (L)
   - num_key_value_heads (H_kv)
   - head_dim (D)
   - 总参数量 (P)

2. 算权重显存:
   W = P × bytes_per_param
   (FP8: ×1, BF16: ×2, INT4: ×0.5)

3. 算每 token KV cache:
   KV_token = 2 × H_kv × D × bytes_per_element × L
   (FP8 KV: bytes=1, BF16 KV: bytes=2)

4. 算可用 KV 显存:
   KV_mem = GPU总显存 × utilization - W - overhead(≈2GB)

5. 算最大并发:
   max_concurrent = KV_mem / (KV_token × tokens_per_request)

6. 算 decode 吞吐:
   latency_per_token = W / bandwidth
   throughput = batch_size / latency_per_token
```

整个心智模型就这么多。六步、一个反比例函数（`max_concurrent = K / X`）、一个由硬件和模型架构决定的常数 `K`，以及三个值得记的 vLLM 参数。

---

到这里你有了一张服务侧的图：单个部署能吃下多少请求、带宽墙在哪里、哪些旋钮真的能动指针。下一章 [微调实战](../fine-tuning) 回到*训练*侧——怎么把模型真正定制起来。这一章的并发数学决定了你训出来的微调模型，能不能在你手上的硬件上服务流量；不行的话，要回头再看一眼 `--kv-cache-dtype`、`tensor_parallel_size`，或者干脆换台更大的机器。

下一节: [微调实战](../fine-tuning)
