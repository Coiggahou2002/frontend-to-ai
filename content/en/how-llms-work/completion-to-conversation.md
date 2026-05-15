# 3. From Completion to Conversation

The model only does one thing: continue a sequence of tokens. So how do you get a chatbot out of it?

## Base Models Just Complete

The raw output of pretraining is called a **base model** (or "completion model"). It was trained on a huge pile of internet text and books — its job is to predict the next token in any text it's shown. Hand it `"The quick brown"` and it will probably output `" fox"`.

Hand a base model `"User: What is the capital of France?\nAssistant:"` and a well-trained base model will, indeed, often continue with `" The capital of France is Paris."` — not because it understands "you are an assistant," but because in the corpus it was trained on, text that looked like that was usually followed by text that looked like an answer.

This is already a usable LLM. But base models are unreliable for chat — they might also continue with a different user question, or trail off, or write a Reddit comment. They were trained to imitate **all** of the internet, not just to act as an assistant.

## Chat Models Are Trained on Conversation Format

Modern chat models (GPT-4, Claude, Llama-Instruct, Qwen-Chat, etc.) are base models that have been further trained on conversations in a specific format — a process called **post-training** or **instruction tuning** (Chapter 12 covers this in depth).

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

## The "System Prompt" Is Just Text

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

## `assistant` Is a Continuation Cue

The crucial trick: the SDK ends the rendered prompt right after `<|im_start|>assistant\n` — the start of the assistant's turn but with no body. The model's job, as always, is to continue. So it generates the body of the assistant message, token by token, until it produces the end marker `<|im_end|>` (or the equivalent for its template), at which point the loop stops.

The whole "chat" abstraction is: format the conversation as a transcript, leave the assistant's turn empty, and let the model autocomplete it.

Next: [Multi-Turn (Statelessness) →](./multi-turn)
