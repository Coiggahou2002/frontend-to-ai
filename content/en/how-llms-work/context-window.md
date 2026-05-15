# 5. Context Window — What 1M Tokens Actually Feels Like

The **context window** is the maximum number of tokens the model can see in one forward pass. It is the single most defining parameter of an LLM after the model size itself.

## What Counts Against the Window

Every token in your request counts:

```
context_window  =  system prompt
                +  conversation history (all prior user + assistant turns)
                +  current user message
                +  tool definitions (if any)
                +  retrieved documents / RAG chunks (if any)
                +  the assistant's growing reply (output also lives in the window)
```

The output is part of the window. If your input is 199K tokens on a 200K-context model, you have **1K tokens left for the response** — and the model will get cut off mid-sentence. This is why long-context models often have a separate `max_output_tokens` that's smaller than the full window (e.g., a 1M context model might cap output at 8K or 32K).

## Why It's Bounded

There are two real reasons, both hardware:

**1. Compute. Attention is O(n²).** The transformer's attention mechanism, at its core, has every token attend to every previous token. Doubling the sequence length quadruples the attention computation. Going from 4K to 1M context isn't 250x more work — it's 250² = 62,500x more work for the attention layers (linear-in-context for the rest of the network, but attention dominates at long contexts). Inference engines mitigate this with the **KV cache** (Chapter 9), which avoids re-attending to old tokens during decode, but the prefill step on a fresh long input still pays the full cost.

**2. Memory. The KV cache grows linearly with context length.** During inference the model has to store a Key vector and Value vector for every token at every layer. For a typical 70B model in BF16, that's roughly 300KB per token. At 1M tokens of context that's about 300GB — already more VRAM than a single H100 has. Long context isn't just "slower," it physically requires more GPU memory, which is why long-context inference is gated behind multi-GPU setups and aggressive optimizations like MLA, GQA, and FP8 KV cache (all covered in detail in Chapter 9).

These two limits together — quadratic compute and linear memory — are why the "context window" is a fixed number, not an open-ended setting. The model architecture and the available hardware decide how big it can be.

## What 1M Tokens Actually Feels Like

LLM marketing throws around numbers like "1M context" with no reference points. For an English-speaking developer, here's what fits:

| Content                                              | Word count | Tokens (~1.3 tok/word) |
|---|---:|---:|
| A typical blog post                                  | 1,500       | ~2,000                 |
| A short story                                        | 5,000       | ~6,500                 |
| A long magazine feature                              | 10,000      | ~13,000                |
| A novella                                            | 30,000      | ~40,000                |
| *Animal Farm* (full text)                            | 30,000      | ~40,000                |
| A typical novel                                      | 90,000      | ~120,000               |
| *The Great Gatsby* (full text)                       | 50,000      | ~65,000                |
| *War and Peace* (full text)                          | 580,000     | ~750,000               |
| Complete Harry Potter series (7 books)               | 1,100,000   | ~1,500,000             |

For developers, in concrete code/document terms:

| Content                                              | Approx tokens  |
|---|---:|
| A medium-sized React component file                  | 500–2,000       |
| A typical PDF page (dense)                           | 500–800         |
| A 50-page PDF report                                 | 25,000–40,000   |
| Your service's full OpenAPI schema                   | 5,000–30,000    |
| A medium TypeScript codebase (50K lines)             | 600,000–800,000 |
| 3,000 pages of dense PDF                             | ~1,000,000      |
| A full year of one person's email (~10K messages)    | ~1,500,000      |

**1 million tokens is roughly: the entire Harry Potter series, a medium-sized codebase, or about three thousand dense PDF pages.** That is the upper end of what current frontier models can hold in one forward pass.

## Historical Context Windows

| Year      | Model                       | Context window     |
|---|---|---:|
| 2020      | GPT-3                       | 2,048              |
| 2022      | GPT-3.5                     | 4,096              |
| 2023      | GPT-4 (original)            | 8,192              |
| 2023      | Claude 2                    | 100,000            |
| 2023      | GPT-4 Turbo                 | 128,000            |
| 2024      | Claude 3                    | 200,000            |
| 2024      | Gemini 1.5 Pro              | 1,000,000–2,000,000|
| 2025–26   | Frontier models (current)   | 200K–1M+ standard  |

Context windows have grown ~500x in five years. This is the fastest-improving capability in the field, and it has reshaped what kinds of applications are feasible.

## The "Long Context" Doesn't Mean "Use It All"

Two important caveats:

**1. Cost grows linearly with context length.** A 200K-token prompt on a 1M-context model costs 200x more in input tokens than a 1K-token prompt on the same model. A 1M-token call can easily cost $1–$3 per request just for input. Long context is a capability, not a default.

**2. Quality often degrades with context length.** Even when a model technically supports 1M tokens, its ability to recall and use information from the middle of that context is often weaker than from the beginning or end — a phenomenon known as **"lost in the middle."** Benchmarks like *needle in a haystack* test this directly. Some models hold up well to 200K and degrade after; some are great at retrieval but poor at synthesis across the whole window.

In practice, "200K context that the model actually uses well" is often more valuable than "1M context with degraded recall in the middle."

## Forward Reference

Three things in this guide trace directly back to the bounded context window:

- **Chapter 3 (Embeddings, Vector Search and RAG)** exists because of this section. RAG — Retrieval-Augmented Generation — is the architectural answer to "I have more knowledge than fits in the context window." Instead of stuffing 10 million tokens into the prompt, you embed your corpus into a vector database and retrieve the few thousand tokens that are relevant to the current query. The entire RAG ecosystem is a consequence of the context window being finite.
- **Chapter 9 (KV Cache)** explains the hardware reason long context is bounded — the KV cache size grows linearly with sequence length, and the GPU runs out of VRAM. It also explains the optimizations (GQA, MLA, FP8) that have made 200K–1M context feasible.
- **Chapter 10 (Inference Concurrency)** introduces `--max-model-len`, the parameter you set when self-hosting an LLM that decides how much context to support per request. It directly trades off "longer single requests" against "more concurrent requests" — both consume the same KV cache memory budget.

Next: [Sampling →](./sampling)
