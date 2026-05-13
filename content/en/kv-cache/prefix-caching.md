# 4. Prefix Caching: Reusing KV Cache for Shared Prefixes

## The Problem

In many real-world applications, large numbers of requests share the same prefix. The most typical case is the system prompt — every request sent to an LLM carries the same system prompt, followed by a different user message.

Without optimization, every request recomputes the system prompt's KV cache, repeating identical computation:

```
Request 1:   [system prompt 2K tokens] + [user msg A 500 tokens]  → prefill 2500 tokens
Request 2:   [system prompt 2K tokens] + [user msg B 500 tokens]  → prefill 2500 tokens
...
Request 100: [system prompt 2K tokens] + [user msg Z 500 tokens]  → prefill 2500 tokens

Total prefill computation: 100 × 2500 = 250,000 tokens
Of which 200,000 tokens are entirely redundant computation
```

## How Prefix Caching Works

The idea behind Prefix Caching is straightforward: **compute the KV cache for a shared prefix only once, and reuse it for subsequent requests.**

```
Request 1:  [system prompt 2K] → Compute KV cache, index by token sequence hash
            [user msg A 500]   → Only compute these 500 tokens

Request 2:  [system prompt 2K] → Hash hit, directly reference Request 1's KV cache pages (zero computation)
            [user msg B 500]   → Only compute these 500 tokens

...

Total prefill computation: 2000 + 100 × 500 = 52,000 tokens
```

Down from 250,000 to 52,000 — roughly 80% savings in prefill computation.

## This Is Purely a KV Cache Optimization

Prefix Caching uses no mechanism outside of KV cache. Its essence is:

1. After computing a segment's KV cache, instead of discarding it immediately, cache it indexed by content hash
2. If a subsequent request has the same prefix, directly reference the existing KV cache pages
3. Only compute new KV cache for the differing parts (user messages)

In vLLM's PagedAttention this is particularly natural — KV cache is already stored in pages, so multiple requests sharing a prefix can point to the same physical pages without copying. This is analogous to the copy-on-write mechanism in operating systems.

## Triple Benefits

| Benefit | Mechanism |
|---|---|
| Save computation | Shared prefix is prefilled only once; subsequent requests skip it |
| Save memory | Shared prefix KV cache is stored once in memory; multiple requests reference the same pages |
| Increase throughput | Faster prefill phase frees more GPU time for decode |

## Platform Implementations

| Platform | Feature Name | Effect | How to Trigger |
|---|---|---|---|
| Anthropic (Claude) | Prompt Caching | Cached tokens cost **90% less**, 5-minute TTL | Mark `cache_control` in API |
| OpenAI | Prompt Caching | Cached tokens cost **50% less**, automatic | Automatic (prefix >= 1024 tokens) |
| vLLM (self-hosted) | Automatic Prefix Caching | Saves GPU compute and memory | `--enable-prefix-caching` |
| SGLang | RadixAttention | Finer-grained caching via radix tree | Enabled by default |

## Self-Hosting in Practice

If a batch workload has many requests sharing the same system prompt, adding a single parameter to the vLLM launch command enables prefix caching:

```bash
--enable-prefix-caching
```

For example, with 100 requests sharing a 2K-token system prompt, this one flag effectively gives 200K tokens of prefill computation for free — pure savings at zero cost.

Next: [Big picture →](./big-picture)
