# 3. Multi-GPU, MoE, and the Rest

The "fits on A10" / "needs A100" reflex from the previous section assumes one card. This section covers the cases where one card isn't enough, the trap MoE models hide, and the non-VRAM specs you still need to size.

## Multi-GPU Deployment: When You Need More Than One Card

When a single GPU's VRAM can't fit the entire model, you split the model across multiple GPUs. This is called **Tensor Parallelism**.

| Situation | Approach |
|-----------|----------|
| Model < single GPU VRAM | 1 GPU, simplest setup |
| Model > single GPU VRAM | Multiple GPUs with tensor parallelism; model is sliced across cards |

Examples:
- Qwen3-32B FP16 needs ~64 GB → 1x A100 80GB (fits) or 2x A100 40GB (split)
- Qwen3-235B FP8 needs ~235 GB → at least 4x A100 80GB (320 GB total)

**The cost of multi-GPU**:
1. Inter-card communication adds overhead; speedup is not linear
2. Pricing is usually linear or super-linear (a 4-GPU instance costs more than 4x a single GPU)
3. Configuration and debugging are more complex

**If you can solve it with a single card, don't use multiple cards.**

## The MoE Catch

You may have heard of models like Qwen3-235B-A22B. Its architecture is called **MoE (Mixture of Experts)**.

Dense model: every parameter participates in every inference pass.
MoE model: the model is split into many "experts," and only a small subset is activated per inference.

Qwen3-235B-A22B means:
- **235B**: total parameter count (235 billion)
- **A22B**: only 22 billion parameters activated per inference

Sounds efficient, but there's a catch: **all 235B parameters must stay resident in VRAM**, even though only 22B are used each time. So VRAM requirements are based on the full 235B, not 22B.

| Metric | Qwen3-32B (Dense) | Qwen3-235B-A22B (MoE) |
|--------|-------------------|----------------------|
| Inference speed feel | Similar to 32B speed | Similar to 22B speed (faster) |
| VRAM requirement | Based on 32B | **Based on 235B** (much larger) |
| Output quality | Very good | Better (but marginal difference for most tasks) |
| Deployment cost | Moderate | Very high (roughly 4x+ the cost of the Dense model) |

The mental model: MoE buys you **speed**, not **VRAM savings**. If the model name says 235B, you need to plan VRAM for 235B.

## Beyond VRAM: What Else Matters

Once you've nailed VRAM, the remaining specs matter much less — but they still need to not be wrong.

### System RAM

System RAM should be >= GPU VRAM, because the model is first loaded into system memory before being transferred to the GPU. If system RAM is too small, model loading will fail.

Most cloud GPU instances already come with enough system RAM -- you generally don't need to worry about this.

### vCPUs

The CPU's role during inference is mainly: data preprocessing (tokenization), network I/O, and scheduling. It doesn't significantly affect inference speed. Typically **8-16 vCPUs** per GPU is plenty.

### Disk

Model files need to be stored on disk, and large models can be tens of GB. For example:
- 8B model: ~16 GB model file
- 32B model: ~64 GB model file (FP16 weights)

Cloud server default system disks are usually 40-100 GB, which may not be enough. **Attach a separate SSD data disk of 200 GB or more**.

These three specs are the "don't get them wrong" tier. They almost never become the bottleneck — but if you under-provision any of them, the deployment will fail or thrash before VRAM ever comes into play.

Next: [Choosing model size →](./choosing-model-size)
