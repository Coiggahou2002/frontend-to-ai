# 5. Decision Tree

Pulling everything from the previous four sections together: a flowchart from "what model are you deploying" to "buy this GPU," then a two-step recap.

## GPU Selection Decision Tree

```
What model are you deploying?
│
├── Embedding model (≤8B)
│   └── FP16 VRAM ≤ 16 GB
│       └── Pick 1x A10 (24GB)
│           └── Choose the cheapest CPU/RAM config available
│
├── LLM ≤ 14B
│   └── FP8 VRAM ≤ 14 GB
│       └── Pick 1x A10 (24GB)
│
├── LLM 14B-32B
│   └── FP8 VRAM 16-38 GB
│       └── Won't fit on A10 → Pick 1x A100 80GB
│
├── LLM 32B-70B
│   └── FP8 VRAM 32-70 GB
│       └── Pick 1x A100 80GB (FP8/INT8)
│       └── Or 2x A100 80GB (FP16)
│
└── LLM > 70B (e.g. 235B MoE)
    └── FP8 VRAM > 100 GB
        └── Multi-GPU A100 or H100 → Very expensive; consider whether you truly need this
```

## Summary: Two-Step Sizing Method

1. **Calculate VRAM first**: parameter count x bytes per precision x 1.2 = VRAM needed
2. **Then pick the card**: find the cheapest single-GPU option that fits that VRAM requirement

That's the entire chapter compressed into two lines. Every other rule of thumb in this chapter — "FP8 is the price/performance sweet spot," "if you've already paid for an A100, running 32B is free vs 14B," "MoE is speed not VRAM savings," "single card before multi-card" — is just guidance for executing those two steps well.

## What's Next

You now know how to pick the GPU. The next chapter zooms out to **the rest of the deployment**: which inference engine to put in front of the GPU (vLLM, TGI, SGLang, llama.cpp), how it's typically packaged (Docker, Kubernetes, model registries), and how the whole AI infra stack fits together. After that, the next two chapters dig into the two specific behaviors of the inference engine that make or break performance: the **KV cache** (which is why VRAM keeps growing during long conversations) and **inference concurrency** (which is why one GPU can serve dozens of users at once — or completely melt down).

Next: [AI Infrastructure Stack →](../ai-infra-stack)
