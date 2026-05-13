# 1. GPU Mental Model

## Why LLMs Need GPUs

CPUs are great at complex logic and branching (a few powerful cores), while GPUs excel at massive parallel computation (thousands of small cores working simultaneously). At its core, running an LLM is just a huge amount of matrix multiplication -- exactly what GPUs are built for.

Analogy: a CPU is like one world-class chef (can cook anything, but only one dish at a time). A GPU is like 5,000 kitchen apprentices chopping vegetables at once (each one can only do simple tasks, but the parallelism makes them blazing fast together).

This is also why "running an LLM on a CPU" is technically possible but practically useless once the model gets above a few billion parameters: a CPU has to do those matrix multiplications one or two cores at a time. The same forward pass that a GPU finishes in 50 ms can take a CPU 10 seconds. The architectural mismatch is fundamental, not a matter of optimization.

## What That Means for the Rest of This Chapter

The single fact you need to internalize before reading further: **the model's parameters have to live in GPU memory while the model is running**. Not on disk, not in system RAM, not "swapped in on demand." All of them, all the time.

GPU memory is called **VRAM** (Video RAM), and it's a separate, much faster memory bank attached directly to the GPU chip. It's also much smaller than system RAM and much more expensive per GB. A typical cloud server might have 128 GB of system RAM but only 24 GB of VRAM on its GPU. That asymmetry is the whole reason "GPU sizing" is a real engineering decision: you have to fit the model into the small, fast memory.

So the question every section in this chapter will keep coming back to is the same one:

> Given the model I want to run, how many GB of VRAM do I need, and which GPU has at least that much?

Everything else — multi-GPU, MoE quirks, vCPU and disk sizing, the cost cliffs between GPU tiers — is downstream of that one calculation.

Next: [VRAM and precision →](./vram-and-precision)
