# Putting It All Together

A single LLM API call, end to end:

```
1. Your client builds a `messages` array
   - system prompt + full prior history + new user message
   - this is YOUR job; the server has no memory of previous turns

2. The SDK renders messages into a single token sequence using the model's chat template
   - role tags get inserted as special tokens
   - sequence ends right after `<|im_start|>assistant\n` so the model knows what to continue

3. The server checks token count against the context window
   - if too long, you get a 4xx error (or tokens get truncated, depending on API)

4. The model runs forward
   - "prefill" phase: process all input tokens in parallel, produce KV cache, get distribution for first output token
   - "decode" phase: sample one token, append, run forward again, sample next, ... until stop token or max_tokens

5. Each output token is sampled
   - temperature, top-p, etc. shape the distribution
   - the picked token is appended to the sequence and fed back in

6. Response is streamed (or returned all at once)
   - the SDK strips the chat-template wrapping, gives you back assistant text

7. Server forgets everything as soon as the request ends
   - no state persists; if you want a "next turn," you replay history again
```

Every chapter in this guide builds on this loop:

- **Chapter 1 (Python)** gives you the language to actually call this loop, work with its outputs, and build systems around it.
- **Chapter 2 (LLM APIs and Prompt Engineering)** is about engineering the `messages` array — what goes in the system prompt, how to structure user messages, when to use few-shot examples, how to chain calls.
- **Chapter 3 (Embeddings, Vector Search and RAG)** is about getting the right knowledge into the prompt without exceeding the context window.
- **Chapter 4 (Agents and Tool Use)** is about giving the model a way to interact with the outside world by structuring some of its tokens as function calls — still a single forward pass, but the output is interpreted as tool invocations.
- **Chapters 5–8 (GPU sizing, infra stack, KV cache, inference concurrency)** are the hardware and serving side of the loop — what it costs to run the model, how the KV cache lets the server skip recomputation, how concurrent requests share GPU memory.
- **Chapters 9–10 (Fine-tuning and Post-training)** are about *changing* the model's learned distribution — making it better at your specific task, or shaping its behavior with reinforcement learning.
- **Chapter 11 (Evaluation)** is about measuring whether any of this is actually working, given the non-determinism.

Now you understand the machine. The next chapter teaches you the language to operate it.

## Further Reading

- Karpathy, [*Let's build the GPT tokenizer*](https://www.youtube.com/watch?v=zduSFxRajkE) — a 2-hour video that builds a BPE tokenizer from scratch. The clearest explanation of tokenization that exists.
- Karpathy, [*Let's build GPT: from scratch, in code, spelled out*](https://www.youtube.com/watch?v=kCc8FmEb1nY) — the next step after this chapter, if you want to see next-token prediction implemented.
- Holtzman et al., [*The Curious Case of Neural Text Degeneration*](https://arxiv.org/abs/1904.09751) — the paper that introduced top-p (nucleus) sampling and explained why greedy decoding fails.
- Liu et al., [*Lost in the Middle: How Language Models Use Long Contexts*](https://arxiv.org/abs/2307.03172) — the paper behind the "long context but degraded recall" caveat in [§5](./context-window).
- OpenAI, [*Tokenizer playground*](https://platform.openai.com/tokenizer) — paste any text, see how it tokenizes. Worth bookmarking.
