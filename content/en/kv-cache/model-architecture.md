# 1. How Model Architecture Determines KV Cache Size

The first lever sits in the model itself. Before any framework gets involved, the architecture decides how many bytes of KV cache each token costs.

## The Formula

The KV cache size per token is determined by architectural parameters:

```
KV cache per token = 2 × num_kv_heads × head_dim × bytes_per_element × num_layers
                     ↑         ↑            ↑              ↑              ↑
                   K and V   KV heads   dim per head   storage precision   model layers
```

All these parameters can be found in a model's config.json.

## How Different Attention Mechanisms Affect Size

Different models use different attention mechanisms at the architecture level to compress KV cache, with dramatically different results:

**Multi-Head Attention (MHA)**: Each Query head has its own independent K head and V head. 24 attention heads means storing 24 sets of KV. This is the original design with the largest KV cache.

**Grouped-Query Attention (GQA)**: Multiple Query heads share one set of KV heads. For example, Qwen3.6-27B uses 24 Query heads sharing 4 KV heads (6:1 compression ratio), shrinking KV cache to 1/6 of MHA. Most current open-source models use this approach.

**Multi-head Latent Attention (MLA)**: The approach used by DeepSeek-V2/V3 and Kimi K2. It projects the entire KV into a low-dimensional latent vector for storage, decompressing at inference time. Compression ratios can exceed 10x, at the cost of extra computation for decompression. MLA uses a different KV cache formula:

```
KV cache per token = (compressed_kv_dim + rope_dim) × bytes_per_element × num_layers
```

## Model Comparison

Here are KV cache sizes per token for several representative models (BF16 precision):

| Model | Attention Type | Layers | KV Heads | Head Dim | KV per Token (BF16) |
|---|---|---|---|---|---|
| Llama 3.1 70B | GQA | 80 | 8 | 128 | 327 KB |
| Qwen3.6-27B | GQA | 64 | 4 | 256 | 256 KB |
| DeepSeek-V3 | MLA | 61 | - | c_kv=512 | ~69 KB |
| Kimi K2.6 | MLA | 61 | - | c_kv=512 | ~69 KB |

MLA models have only 1/4 to 1/5 the per-token KV cache of GQA models — this is why DeepSeek and Kimi can support longer contexts with less GPU memory.

The architecture sets a floor on per-token KV cost. Once the model is chosen, the next question is how the inference framework lays this data out in GPU memory.

Next: [Framework management →](./framework-management)
