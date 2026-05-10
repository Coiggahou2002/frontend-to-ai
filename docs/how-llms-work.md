---
sidebar_position: 0
sidebar_label: How LLMs Work
---

# How LLMs Actually Work

Before you can build with LLMs, you need to know what an LLM actually does — mechanically, at the level of a single API call. Most of the confusion that frontend developers have about LLMs (Why does it forget? Why does it cost so much? Why is the answer different every time? Why is there a context limit?) comes from missing this foundation.

This chapter is the foundation. Six concepts:

1. Tokens — what the model actually reads
2. Next-token prediction — the entire mechanism
3. From completion to chat — how a "completion-only" model talks
4. Multi-turn conversations — the model is stateless; the client replays history
5. Context window — what 1M tokens actually feels like
6. Sampling — temperature, top-p, and why the same prompt gives different answers

Once these are clear, everything else in this guide (RAG, agents, fine-tuning, KV cache, GPU sizing) becomes a question of "where does this fit on top of the basic loop." This chapter intentionally skips the internals of the transformer architecture — what matters is **what the model does**, not how the matrix multiplications are arranged inside it.

---

## 1. Tokens — What the Model Actually Reads

The most common mental model from end-user experience is wrong: the model does not read characters, and it does not read words. It reads **tokens**.

A token is a chunk of text — usually a few characters long, sometimes a whole short word, sometimes a fragment. The mapping from text to tokens is fixed by a **tokenizer** that ships with each model. For most modern LLMs the tokenizer uses a variant of **Byte Pair Encoding (BPE)**: it starts from raw bytes and merges the most frequent byte pairs over and over until a vocabulary of typically 32K–256K tokens is reached.

A useful TS-developer analogy: tokens are like the tokens emitted by a parser's lexer. Your source code is `const x = 42;`, but a parser doesn't see characters — it sees `[Const, Identifier("x"), Equals, Number(42), Semicolon]`. Tokens are the units the system actually reasons over. Characters are below its level of awareness.

### A Concrete Example

Take this sentence:

```
Tokenization is fundamental to understanding LLMs.
```

Run it through a typical BPE tokenizer (here, GPT-4's `cl100k_base`) and you get something like:

```
["Token", "ization", " is", " fundamental", " to", " understanding", " LL", "Ms", "."]
```

Nine tokens. Notice:

- `Tokenization` splits into `Token` + `ization`. Common roots and common suffixes get their own tokens.
- Leading spaces are part of the token — `" is"` is one token, not `" "` + `"is"`. This is why models care about exactly where your spaces and newlines go.
- `LLMs` becomes `LL` + `Ms`. Less common spellings get fragmented.
- The period is its own token.

A different model with a different tokenizer will split this differently. Chinese, Japanese, and Korean text usually produces 2–3x more tokens per character than English, because their characters are rarer in the BPE vocabulary. Rare languages and code-mixed text are even worse.

### Quick rules of thumb

| Content type                                 | Approx tokens per unit                  |
|---|---|
| English prose                                | ~1.3 tokens per word, ~4 chars per token |
| Code (Python/TypeScript)                     | ~1.5 tokens per word; whitespace and operators take their own tokens |
| Chinese / Japanese / Korean                  | ~1.5–2 tokens per character             |
| URLs, hashes, base64                         | nearly 1 token per character (ugly)     |

### Why This Matters

You will see "tokens" everywhere in the AI ecosystem:

- **Cost** is denominated in tokens. APIs charge per million input tokens and per million output tokens, with output usually 3–5x more expensive.
- **Context window size** is denominated in tokens, not characters or words.
- **Latency** scales with token count — both input (prefill phase) and output (decode phase).
- **Rate limits** are tokens-per-minute.

Every meaningful number in LLM engineering is a token count. If you take one practical thing from this section: install a tokenizer in your dev environment and run your prompts through it occasionally so you build intuition for "how long is this in tokens" the same way you have intuition for "how big is this JSON payload in bytes."

```python
# Python: count tokens with tiktoken (OpenAI's tokenizer)
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")
tokens = enc.encode("Tokenization is fundamental to understanding LLMs.")
print(len(tokens))   # 9
print(tokens)        # [4421, 2065, 374, 16188, 311, 8830, 445, 43, 82, 13]
```

Each token is just an integer ID, an index into the model's vocabulary. The model's input is a list of integers. The model's output is another integer. Everything else — encoding, decoding, the human-readable text — is plumbing that happens at the boundary.

---

## 2. Next-Token Prediction — The Entire Mechanism

Here is everything an LLM does, in one sentence:

> **Given a sequence of tokens, the model outputs a probability distribution over what the next token should be.**

That is the whole mechanism. There is nothing else.

Concretely, the model is a pure function:

```
input:  list of token IDs        e.g. [791, 6864, 315, 9822, 374]   (= "The capital of France is")
output: vector of probabilities   one entry for every token in the vocabulary (~100K-200K entries)
                                  e.g. " Paris" -> 0.78
                                       " a"     -> 0.04
                                       " the"   -> 0.03
                                       ... (all other tokens get smaller probabilities)
```

The output is a **probability distribution over the entire vocabulary**. Every token gets a score. The model never says "the answer is Paris." It says "given everything I've seen, here's how likely each of my 100,000+ possible next tokens is, and Paris is by far the most likely."

### Generation = Loop

Generating a multi-token reply is just running this single-step prediction in a loop:

```
input: [The, capital, of, France, is]
  -> distribution -> sample " Paris"
input: [The, capital, of, France, is, Paris]
  -> distribution -> sample "."
input: [The, capital, of, France, is, Paris, .]
  -> distribution -> sample <end-of-text>
done.
```

Each step:
1. Feed the current sequence (everything written so far) through the model.
2. Get a probability distribution over the next token.
3. Pick one token from that distribution (more on "pick" in section 6).
4. Append it to the sequence.
5. Repeat until you sample a stop token, or hit `max_tokens`.

This loop is called **autoregressive decoding**. Every output token is generated by feeding the model everything it has produced so far.

### What This Means

This mechanism has consequences that frontend developers consistently underestimate:

**There is no plan.** The model does not "decide what to say" and then write it. It writes one token, then looks at what it just wrote and writes the next. A long, coherent answer is the result of each successive token being a plausible continuation of all the previous ones — not the result of an outline.

**There is no goal.** The model is not trying to be helpful, or correct, or to satisfy you. It is producing the next token according to learned patterns. "Helpfulness" is a property of the patterns, learned during training (we'll get to this in section 3 and again in Chapter 10 on post-training).

**There is no memory between calls.** Every forward pass is independent. After one call ends, the model's "state" is gone. We'll come back to this in section 4.

**There is no introspection.** The model does not know how confident it is in any deep sense. The probability distribution gives a kind of confidence, but the model has no privileged access to "do I actually know this." It will produce confident-looking text whether or not the underlying patterns support it. This is why hallucinations exist.

If you ever feel like an LLM is "thinking," remind yourself: a forward pass is a single matrix-multiply pipeline that maps input integers to output probabilities. There is no "thinking step." The illusion of thought is what emerges when the patterns it learned during training are good enough that one-token-at-a-time generation produces text that looks reasoned.

---

## 3. From Completion to Conversation

The model only does one thing: continue a sequence of tokens. So how do you get a chatbot out of it?

### Base Models Just Complete

The raw output of pretraining is called a **base model** (or "completion model"). It was trained on a huge pile of internet text and books — its job is to predict the next token in any text it's shown. Hand it `"The quick brown"` and it will probably output `" fox"`.

Hand a base model `"User: What is the capital of France?\nAssistant:"` and a well-trained base model will, indeed, often continue with `" The capital of France is Paris."` — not because it understands "you are an assistant," but because in the corpus it was trained on, text that looked like that was usually followed by text that looked like an answer.

This is already a usable LLM. But base models are unreliable for chat — they might also continue with a different user question, or trail off, or write a Reddit comment. They were trained to imitate **all** of the internet, not just to act as an assistant.

### Chat Models Are Trained on Conversation Format

Modern chat models (GPT-4, Claude, Llama-Instruct, Qwen-Chat, etc.) are base models that have been further trained on conversations in a specific format — a process called **post-training** or **instruction tuning** (Chapter 10 covers this in depth).

The format uses **special tokens** that mark the boundaries between roles. Different model families use different markers, but they all do the same thing. Here's what a Qwen-style chat template looks like under the hood:

```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
What is the capital of France?<|im_end|>
<|im_start|>assistant
The capital of France is Paris.<|im_end|>
```

Llama 3 uses different markers (`<|start_header_id|>system<|end_header_id|>...<|eot_id|>`), GPT models use yet another, but the structure is the same: role tags, a body, an end marker.

When you call the OpenAI or Anthropic API with `messages=[{role: "system", ...}, {role: "user", ...}]`, the SDK is just a thin wrapper that **renders your structured messages into one big string of tokens following the model's chat template**, sends it to the model, and asks the model to continue.

### The "System Prompt" Is Just Text

Once you see the chat template, the system prompt loses all of its mystery. It is **not a separate input channel**. It is not metadata. It is not a special instruction layer.

It is literally text inside the prompt, prefixed with a `system` role tag, that the model learned during post-training to weight heavily.

```
<|im_start|>system
You are a senior backend engineer. Be concise.<|im_end|>
<|im_start|>user
Why is my Postgres query slow?<|im_end|>
<|im_start|>assistant
```

The model sees this entire blob of text and continues from where it stops (right after `assistant\n`). The "system" tag is a signal it learned to take seriously, but mechanically nothing special is happening.

Implications:

- A system prompt and a user prompt occupy the same context budget. They both cost tokens.
- A sufficiently long user message can easily drown out a short system prompt.
- "Prompt injection" attacks work because once the user's text is concatenated into the same string, the model has no fundamentally privileged way to tell "this part was the operator's instructions" from "this part was a user trying to override them." Mitigations exist, but they are training-time and prompt-design defenses, not architectural guarantees.

### `assistant` Is a Continuation Cue

The crucial trick: the SDK ends the rendered prompt right after `<|im_start|>assistant\n` — the start of the assistant's turn but with no body. The model's job, as always, is to continue. So it generates the body of the assistant message, token by token, until it produces the end marker `<|im_end|>` (or the equivalent for its template), at which point the loop stops.

The whole "chat" abstraction is: format the conversation as a transcript, leave the assistant's turn empty, and let the model autocomplete it.

---

## 4. Multi-Turn Conversations — The Model Is Stateless

This is the single most important section in this chapter for a frontend developer to internalize.

> **The model has no memory between API calls.** It is a pure function: tokens in -> distribution out. Two consecutive calls share no state.

Multi-turn chat works because the **client** (your app, ChatGPT's UI, the SDK) **sends the entire conversation history with every single request**.

### What Turn 3 Actually Looks Like

Imagine a three-turn conversation. You think it's:

```
Turn 1: user says A, model says B
Turn 2: user says C, model says D
Turn 3: user says E, model says F
```

What actually goes over the wire on turn 3:

```jsonc
// POST /v1/chat/completions  (turn 3 request)
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system",    "content": "You are a helpful assistant." },
    { "role": "user",      "content": "A" },   // turn 1 user
    { "role": "assistant", "content": "B" },   // turn 1 model reply, replayed by client
    { "role": "user",      "content": "C" },   // turn 2 user
    { "role": "assistant", "content": "D" },   // turn 2 model reply, replayed by client
    { "role": "user",      "content": "E" }    // turn 3 user (the only "new" message)
  ]
}
```

The client is sending all six messages every turn. The server-side model has no idea this is "turn 3" — as far as the model is concerned, this is a single forward pass over a long token sequence, ending with an empty assistant slot for it to fill.

If you stopped sending the prior turns, the model would have no idea what you were talking about. It is not "remembering" you between calls. The transcript is the memory, and the client maintains it.

### Why This Matters

Three direct consequences:

**1. Every turn is more expensive than the last.** Input grows monotonically. By turn 20 of a long conversation, your prompt might be 50K tokens — every one of them billed, every one of them processed by the model on every turn. This is why a "long chat" conversation can have surprisingly high cost despite each user message being short.

**2. Conversation history is your problem.** The server doesn't store it (with rare opt-in exceptions like OpenAI's stateful Assistants API or Anthropic's beta Memory feature). If your tab reloads and you don't have local state, the conversation is gone. This is why you need a database the moment you build a real chat app, even if the LLM API itself is "stateless and free."

**3. You decide what counts as "history."** You are not obligated to send the full transcript. You can:
- Truncate old turns (drop the oldest messages once context is filling up).
- Summarize old turns (replace 20 messages with a 200-token summary written by the model itself).
- Selectively retrieve relevant past messages (proto-RAG over conversation history).
- Inject system-side information (tool outputs, retrieved documents) as messages.

The `messages` array is your scratchpad. The model's "memory" is whatever you put there.

### Forward Reference

Two later chapters build directly on this:

- **Chapter 2 (LLM APIs and Prompt Engineering)** is largely about how to design `messages` arrays well — what to put in the system role, how to manage history, how to inject tool results, how to structure few-shot examples.
- **Chapters 7 (KV Cache) and 8 (Inference Concurrency)** address the "growing prompt" cost problem. Even though you re-send the whole history every turn, the inference engine can recognize the shared prefix and reuse the cached intermediate state for it instead of recomputing from scratch. This is called **prefix caching**, and it's why "growing prompts" are not as catastrophic as they sound — but the fact that the optimization exists is itself evidence that yes, you are conceptually re-sending the whole transcript every time.

---

## 5. Context Window — What 1M Tokens Actually Feels Like

The **context window** is the maximum number of tokens the model can see in one forward pass. It is the single most defining parameter of an LLM after the model size itself.

### What Counts Against the Window

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

### Why It's Bounded

There are two real reasons, both hardware:

**1. Compute. Attention is O(n²).** The transformer's attention mechanism, at its core, has every token attend to every previous token. Doubling the sequence length quadruples the attention computation. Going from 4K to 1M context isn't 250x more work — it's 250² = 62,500x more work for the attention layers (linear-in-context for the rest of the network, but attention dominates at long contexts). Inference engines mitigate this with the **KV cache** (Chapter 7), which avoids re-attending to old tokens during decode, but the prefill step on a fresh long input still pays the full cost.

**2. Memory. The KV cache grows linearly with context length.** During inference the model has to store a Key vector and Value vector for every token at every layer. For a typical 70B model in BF16, that's roughly 300KB per token. At 1M tokens of context that's about 300GB — already more VRAM than a single H100 has. Long context isn't just "slower," it physically requires more GPU memory, which is why long-context inference is gated behind multi-GPU setups and aggressive optimizations like MLA, GQA, and FP8 KV cache (all covered in detail in Chapter 7).

These two limits together — quadratic compute and linear memory — are why the "context window" is a fixed number, not an open-ended setting. The model architecture and the available hardware decide how big it can be.

### What 1M Tokens Actually Feels Like

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

### Historical Context Windows

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

### The "Long Context" Doesn't Mean "Use It All"

Two important caveats:

**1. Cost grows linearly with context length.** A 200K-token prompt on a 1M-context model costs 200x more in input tokens than a 1K-token prompt on the same model. A 1M-token call can easily cost $1–$3 per request just for input. Long context is a capability, not a default.

**2. Quality often degrades with context length.** Even when a model technically supports 1M tokens, its ability to recall and use information from the middle of that context is often weaker than from the beginning or end — a phenomenon known as **"lost in the middle."** Benchmarks like *needle in a haystack* test this directly. Some models hold up well to 200K and degrade after; some are great at retrieval but poor at synthesis across the whole window.

In practice, "200K context that the model actually uses well" is often more valuable than "1M context with degraded recall in the middle."

### Forward Reference

Three things in this guide trace directly back to the bounded context window:

- **Chapter 3 (Embeddings, Vector Search and RAG)** exists because of this section. RAG — Retrieval-Augmented Generation — is the architectural answer to "I have more knowledge than fits in the context window." Instead of stuffing 10 million tokens into the prompt, you embed your corpus into a vector database and retrieve the few thousand tokens that are relevant to the current query. The entire RAG ecosystem is a consequence of the context window being finite.
- **Chapter 7 (KV Cache)** explains the hardware reason long context is bounded — the KV cache size grows linearly with sequence length, and the GPU runs out of VRAM. It also explains the optimizations (GQA, MLA, FP8) that have made 200K–1M context feasible.
- **Chapter 8 (Inference Concurrency)** introduces `--max-model-len`, the parameter you set when self-hosting an LLM that decides how much context to support per request. It directly trades off "longer single requests" against "more concurrent requests" — both consume the same KV cache memory budget.

---

## 6. Sampling — Why the Same Prompt Gives Different Answers

Section 2 said the model outputs a **probability distribution** over the next token. It does not output "the next token." So to actually generate text, we need a step that **picks one token from the distribution**. This step is called **sampling**, and how you do it has a large effect on the output's character.

### Greedy: Always Pick the Top Token

The simplest strategy: always pick whichever token has the highest probability.

```
distribution: { " Paris": 0.78, " a": 0.04, " the": 0.03, ... }
greedy pick:    " Paris"
```

This is **deterministic** — same input, same output, every time. Useful when you want reproducibility. But greedy decoding has a known failure mode: it produces repetitive, dull text. Because at each step it always commits to the locally most likely token, it can lock into loops ("the the the the the") or boring boilerplate. It's also fragile — if the model is even slightly miscalibrated, greedy decoding amplifies the miscalibration into a single guaranteed-wrong path.

### Temperature: Reshape the Distribution

The model's raw output, before any probability-shaped softmax is applied, is a vector of unnormalized scores called **logits**. To turn logits into a probability distribution we apply softmax. **Temperature** is a single number that scales the logits before that softmax:

```
adjusted_logits = logits / temperature
probabilities   = softmax(adjusted_logits)
```

The effect:

- **Low T (0.0–0.3)**: divides logits by a small number, making the gaps between them larger. The distribution becomes **sharper** — the top token gets even more probability mass, less likely tokens get squashed toward zero. Output becomes more deterministic, more conservative, more likely to repeat the obvious answer. T=0 is mathematically equivalent to greedy decoding (well, the limit of it).
- **T = 1.0**: leaves logits as the model produced them. This is the "default" distribution the model was trained to output.
- **High T (1.0–2.0)**: divides by a large number, flattening the distribution. Less likely tokens get a real chance of being picked. Output becomes more diverse, more creative, more likely to surprise you — and more likely to go off the rails.

A practical heuristic:

| Task                                              | Recommended temperature |
|---|---|
| Code generation, structured extraction, classification, factual QA | 0.0–0.2 |
| General assistant tasks, technical writing, balanced chat | 0.3–0.7 |
| Creative writing, brainstorming, marketing copy   | 0.7–1.2 |
| Wild ideas, "give me 20 different angles"         | 1.2–1.5 |

For most production use cases — RAG, code generation, structured extraction, agent tool calls — you want temperature low (0.0–0.3). Creativity is a feature for chat and writing assistants, not for systems that need to produce predictable outputs.

### Top-p (Nucleus) Sampling

Temperature reshapes the distribution but still considers all tokens. **Top-p sampling**, also called **nucleus sampling**, takes a different approach: only consider the smallest set of tokens whose cumulative probability is at least `p`, and zero out everything else.

```
p = 0.9
distribution sorted:  Paris (0.78), a (0.04), the (0.03), my (0.02), some (0.02), ...
cumulative:           0.78,         0.82,     0.85,       0.87,      0.89, 0.91 <- stop
nucleus:              { Paris, a, the, my, some } — that's the set we sample from
```

Top-p adapts to the shape of the distribution. When the model is confident (one token is dominant), the nucleus is small and the output is essentially deterministic. When the model is uncertain (many tokens are plausible), the nucleus expands and the output becomes more diverse.

In practice, **most APIs let you set both temperature and top-p**, but you typically only adjust one or the other. A common starting point is `top_p = 1.0` (off) and only tune temperature; or `temperature = 1.0` and tune top-p (often 0.9).

There's also `top_k`, a similar idea: only consider the top K tokens by probability. Less commonly used than top-p in modern APIs.

### Other Knobs You Will See

| Parameter            | What it does |
|---|---|
| `frequency_penalty`  | Reduces probability of tokens that have already appeared (discourages repetition by raw count). |
| `presence_penalty`   | Reduces probability of tokens that have already appeared at all (encourages bringing in new topics). |
| `stop`               | A list of strings that, if produced, halt generation. Useful for forcing structured output formats. |
| `seed`               | Some APIs let you pin the random seed for sampling, making temperature > 0 reproducible — though no API guarantees this perfectly. |
| `logit_bias`         | Manually nudge the probability of specific token IDs up or down. Power-user feature. |

### The Frontend Developer's Headache: Non-Determinism

The big shift coming from regular software: **same input, same model, different output**. Even at temperature 0, you may not get bit-exact reproducibility — floating point non-associativity in batched matrix multiplies, kernel autotuning, and how requests are batched together at the inference server can all introduce small variations.

This breaks the testing playbook you're used to:

- Snapshot tests don't work — the snapshot will drift.
- Equality assertions don't work — the model can say the same thing five different ways.
- "Run it once and check" doesn't tell you if a regression has happened.

You need different evaluation techniques: scoring outputs against rubrics, running the same prompt many times and measuring distribution-level properties (rate of correct answers, rate of refusals, average output length), using a separate "judge" LLM to grade outputs, and accepting that you measure **regression rates**, not equality.

This is the core challenge of LLM evaluation, and it gets a chapter of its own — **Chapter 11 (Evaluation and Observability)**. The short version: stop thinking like a unit test author and start thinking like a stats-aware QA engineer. Distributions, not values.

---

## Putting It All Together

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

---

## Further Reading

- Karpathy, [*Let's build the GPT tokenizer*](https://www.youtube.com/watch?v=zduSFxRajkE) — a 2-hour video that builds a BPE tokenizer from scratch. The clearest explanation of tokenization that exists.
- Karpathy, [*Let's build GPT: from scratch, in code, spelled out*](https://www.youtube.com/watch?v=kCc8FmEb1nY) — the next step after this chapter, if you want to see next-token prediction implemented.
- Holtzman et al., [*The Curious Case of Neural Text Degeneration*](https://arxiv.org/abs/1904.09751) — the paper that introduced top-p (nucleus) sampling and explained why greedy decoding fails.
- Liu et al., [*Lost in the Middle: How Language Models Use Long Contexts*](https://arxiv.org/abs/2307.03172) — the paper behind the "long context but degraded recall" caveat in section 5.
- OpenAI, [*Tokenizer playground*](https://platform.openai.com/tokenizer) — paste any text, see how it tokenizes. Worth bookmarking.
