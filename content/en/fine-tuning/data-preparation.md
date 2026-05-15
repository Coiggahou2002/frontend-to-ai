# 3. Data Preparation

If you take one thing from this chapter: **data quality is the single biggest determinant of fine-tune quality**, by a margin that dwarfs everything else. Algorithm choice, learning rate, rank, base model — all of these matter, but they're rounding errors compared to the gap between "500 carefully written examples" and "10,000 examples scraped from somewhere and lightly cleaned."

You will spend more time on data than on training. Plan for that.

## The chat template, again

[Chapter 0 §3](../how-llms-work/completion-to-conversation) explained that "chat" is just a string with role tags. For fine-tuning, this matters with full force: **your training data must use the EXACT chat template the base model expects**, character for character.

For Qwen models, the template is:

```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
What is the capital of France?<|im_end|>
<|im_start|>assistant
The capital of France is Paris.<|im_end|>
```

For Llama 3, it's `<|start_header_id|>...<|eot_id|>`. For each base model, the template ships with the tokenizer. You should never write it by hand. Use:

```python
from transformers import AutoTokenizer

tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-3B-Instruct")
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is the capital of France?"},
    {"role": "assistant", "content": "The capital of France is Paris."},
]
text = tok.apply_chat_template(messages, tokenize=False)
print(text)
# <|im_start|>system\nYou are a helpful assistant.<|im_end|>\n...
```

If you train on text formatted with the wrong template, the model fine-tunes on garbage tokens — the special tokens like `<|im_start|>` get treated as regular text and the model never learns the proper turn structure. Symptom at inference time: the model outputs the chat tags as literal text, or fails to stop generating. This is failure mode #1, and you will see it.

## Format examples

Three common formats. The first is what you'll use 95% of the time.

### SFT chat format (the canonical one)

A JSONL file where each line is a single training example:

```json
{"messages": [
  {"role": "system", "content": "You are a SQL assistant. Output only valid PostgreSQL."},
  {"role": "user", "content": "Get the top 5 customers by total order value in 2025."},
  {"role": "assistant", "content": "SELECT c.id, c.name, SUM(o.total) AS lifetime_value\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= '2025-01-01' AND o.created_at < '2026-01-01'\nGROUP BY c.id, c.name\nORDER BY lifetime_value DESC\nLIMIT 5;"}
]}
```

This is what `trl`'s `SFTTrainer` consumes natively. One JSONL line = one full conversation, with the system message optional.

### Multi-turn

Same format, more turns. Multi-turn data teaches the model to handle context — important for tool use, multi-step reasoning, and any scenario where the assistant needs to follow up on its own prior output.

```json
{"messages": [
  {"role": "user", "content": "Summarize this PR description."},
  {"role": "assistant", "content": "<summary>"},
  {"role": "user", "content": "Now write a Slack message announcing it."},
  {"role": "assistant", "content": "<announcement>"}
]}
```

### With tool calls

If your fine-tuned model needs to emit tool calls, your training data must contain tool-call examples in the model's native tool format. For Qwen / OpenAI-style:

```json
{"messages": [
  {"role": "user", "content": "What's the weather in Tokyo?"},
  {"role": "assistant", "content": null, "tool_calls": [
    {"id": "call_1", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"Tokyo\"}"}}
  ]},
  {"role": "tool", "tool_call_id": "call_1", "content": "{\"temp_c\": 18, \"sky\": \"clear\"}"},
  {"role": "assistant", "content": "It's 18°C and clear in Tokyo right now."}
]}
```

If you fine-tune without including tool-call examples and your base model knew tool calls, **you will lose tool-use capability** — see [Chapter 2 §6](../llm-apis-and-prompts/tool-use). Always include a representative slice of tool-use data if your model needs it at inference.

### Plain completion format (rare)

For base / completion models that aren't chat-tuned:

```json
{"prompt": "Translate to French:\nHello, world!\n\nFrench:", "completion": " Bonjour, le monde!"}
```

Almost no one fine-tunes base models in 2026 — instruct-tuned bases are better starting points for almost everything. Mention here only because you'll see it in old tutorials.

## Loss masking: train ONLY on the assistant tokens

This is the second-most-common quiet bug in fine-tunes.

When you compute the cross-entropy loss, you should compute it **only over the assistant's response tokens**, not over the system or user tokens. If you compute loss over the user tokens, you are training the model to predict (i.e., generate) user inputs — exactly the opposite of what you want. The model will start mid-response by parroting back hypothetical user messages.

Most modern libraries handle this for you when you give them conversational data. `trl`'s `SFTTrainer`, given a `messages`-format dataset and `assistant_only_loss=True` (or via the right `data_collator`), automatically masks user/system tokens with `-100` in the `labels` so they don't contribute to loss.

How to verify: pull one batch from the dataloader and inspect `labels`. Tokens with `label = -100` are masked; everything else is being trained on.

```python
batch = next(iter(trainer.get_train_dataloader()))
input_ids = batch["input_ids"][0]
labels = batch["labels"][0]
for tok, lbl in zip(input_ids[:50], labels[:50]):
    print(repr(tok.item()), "->", repr(lbl.item()))  # -100 = masked
```

If every label position has a non-(-100) value, you're training on user prompts. Fix the collator.

## Quality > quantity

Counter-intuitive but well-documented in 2025–26 ([Chapter 12 §6](../post-training)): **500 carefully written examples often beat 10,000 lightly cleaned ones**. The "few but excellent" pattern works because:

- The model already knows how to generate text — you're just teaching it a specific behavior. A small number of clean examples points the gradient cleanly in that direction.
- Bad examples actively confuse the model. A single contradicting example can undo the signal from a hundred consistent ones.
- Overfitting risk drops with cleaner data. You can train for fewer epochs and stop earlier.

A common 2026 workflow: use a stronger model (a frontier API) to generate or critique candidate examples, then have a human curate the top 500–2000. This **distillation** pattern — strong-teacher → small-student — is now the default for narrow specialization.

## Common pitfalls (memorize this list)

1. **Wrong chat template.** Training tokens don't include the special turn markers, or include the wrong ones. Symptom: model outputs `<|im_start|>` tags at inference, or never stops generating.
2. **Loss computed over prompts.** No mask on user/system tokens. Symptom: the model occasionally generates text that looks like a user question instead of an answer.
3. **Sequence length too short.** Default `max_length` is often 512 or 1024; longer assistant responses get **truncated mid-sentence**, and the model learns to emit incomplete answers. Inspect the dataset length distribution and pick `max_length` accordingly.
4. **Class imbalance / topic skew.** If 80% of your data is one task type, the model will collapse to that style on every input. Stratify your sampling.
5. **Training on the eval set.** Test set leakage is extremely common — you generate train and eval from the same source and they share examples. Hash-deduplicate prompts across splits.
6. **Inconsistent system prompts.** If half your training examples have a system prompt and half don't, the model learns "behavior depends on whether a system prompt is present." Either include a consistent system prompt in every example or in none.
7. **Tool-call format drift.** Subtly wrong JSON in tool-call examples (extra whitespace, missing fields) becomes the model's new convention. Lint your tool-call data.

## Sequence packing

Most training examples are far shorter than `max_length`. Naively, every example gets padded with `<pad>` tokens up to the maximum, and the GPU spends most of its compute on padding. **Packing** concatenates multiple short examples into a single sequence (with attention masks ensuring they don't attend across boundaries), speeding training 2–5x with no quality loss.

`SFTTrainer` supports it via `packing=True`. Use it whenever your examples are short relative to `max_length` and you don't have a specific reason not to (mostly: when sequence boundaries carry semantic meaning that the attention mask might not preserve cleanly).

## A complete `prepare_data.py`

Reference script that takes a JSONL of `{messages: [...]}`, applies the tokenizer's chat template, drops too-long examples, and writes a Hugging Face dataset directory. This is not what `SFTTrainer` strictly requires (it can ingest the JSONL directly), but it's useful for inspecting your data offline before training.

```python
# prepare_data.py
import json
from datasets import Dataset
from transformers import AutoTokenizer

MODEL = "Qwen/Qwen2.5-3B-Instruct"
INPUT_JSONL = "raw_data.jsonl"
OUTPUT_DIR = "prepared_dataset"
MAX_LEN = 2048

tok = AutoTokenizer.from_pretrained(MODEL)

records = []
with open(INPUT_JSONL) as f:
    for line in f:
        ex = json.loads(line)
        text = tok.apply_chat_template(ex["messages"], tokenize=False)
        token_ids = tok(text, add_special_tokens=False)["input_ids"]
        if len(token_ids) > MAX_LEN:
            continue  # drop too-long examples; alternatively, truncate
        records.append({"messages": ex["messages"], "text": text, "n_tokens": len(token_ids)})

print(f"kept {len(records)} examples")
print(f"length: median={sorted(r['n_tokens'] for r in records)[len(records)//2]}, "
      f"max={max(r['n_tokens'] for r in records)}")

ds = Dataset.from_list(records)
ds.save_to_disk(OUTPUT_DIR)
```

Run this and look at the output. If `kept` dropped a lot of examples, raise `MAX_LEN` or pre-truncate. If your length distribution is bimodal (lots of short + a few enormous), reconsider whether the long ones belong in this dataset at all — they often skew training disproportionately.

Next: [Hands-On: Qwen-3B + QLoRA →](./qwen-qlora-colab)
