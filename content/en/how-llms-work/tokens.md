# 1. Tokens — What the Model Actually Reads

The most common mental model from end-user experience is wrong: the model does not read characters, and it does not read words. It reads **tokens**.

A token is a chunk of text — usually a few characters long, sometimes a whole short word, sometimes a fragment. The mapping from text to tokens is fixed by a **tokenizer** that ships with each model. For most modern LLMs the tokenizer uses a variant of **Byte Pair Encoding (BPE)**: it starts from raw bytes and merges the most frequent byte pairs over and over until a vocabulary of typically 32K–256K tokens is reached.

A useful TS-developer analogy: tokens are like the tokens emitted by a parser's lexer. Your source code is `const x = 42;`, but a parser doesn't see characters — it sees `[Const, Identifier("x"), Equals, Number(42), Semicolon]`. Tokens are the units the system actually reasons over. Characters are below its level of awareness.

## A Concrete Example

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

## Quick rules of thumb

| Content type                                 | Approx tokens per unit                  |
|---|---|
| English prose                                | ~1.3 tokens per word, ~4 chars per token |
| Code (Python/TypeScript)                     | ~1.5 tokens per word; whitespace and operators take their own tokens |
| Chinese / Japanese / Korean                  | ~1.5–2 tokens per character             |
| URLs, hashes, base64                         | nearly 1 token per character (ugly)     |

## Why This Matters

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

Next: [Next-Token Prediction →](./next-token-prediction)
