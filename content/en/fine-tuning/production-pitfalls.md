# 7. Production Pitfalls

You can run a fine-tune end to end and still ship a broken model. Most fine-tune disasters in production are not "the algorithm didn't work" — they're operational. This page is the eight failure modes you will hit, in roughly the order you'll hit them.

## 1. Catastrophic forgetting

**Symptom**: the fine-tuned model is great at your specific task but lost capabilities the base had — basic factual QA, simple reasoning, tool calling, even instruction-following on unrelated topics.

**Why**: fine-tuning shifts weights. Push too hard (high lr, too many epochs, high LoRA rank) and you'll shift them away from the broad capability the base model encoded.

**Mitigations**:
- Lower the learning rate (try halving it).
- Train for fewer epochs. For most SFT tasks, 1–3 epochs is plenty; 10+ is asking for forgetting.
- Reduce LoRA `r` (less capacity to overwrite).
- **Mix in general-purpose data** — even 10–20% generic instruction data interspersed with your task data preserves general behavior. ([Chapter 12 §2](../post-training) covers this as PPO-ptx.)
- Always run a "general capability" eval set against both the base and the fine-tune before shipping ([§5](./evaluating-the-finetune)).

## 2. Chat-template mismatch

**Symptom**: at inference the model emits raw chat tags as text (`<|im_start|>assistant\n`), or produces nonsense, or never stops generating.

**Why**: training and inference used different chat formats. Sometimes from using the wrong tokenizer at training time; sometimes from forgetting `add_generation_prompt=True` at inference; sometimes from rolling a custom template by hand instead of calling `tokenizer.apply_chat_template`.

**Fix**: always use `tokenizer.apply_chat_template` consistently. At training time:

```python
text = tok.apply_chat_template(messages, tokenize=False)
```

At inference time:

```python
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
```

The `add_generation_prompt=True` at inference is what appends the empty `assistant` turn for the model to continue from ([Chapter 0 §3](../how-llms-work/completion-to-conversation)). Forgetting it is the single most common inference bug after fine-tuning.

## 3. Base model upgrades break adapters

**Symptom**: upstream releases `Qwen2.5-3B-Instruct-v2` (or rebases the existing tag, which has happened) and your adapter, trained against v1 weights, suddenly produces garbage when applied to v2.

**Why**: a LoRA adapter is mathematically a delta against specific frozen weights. The adapter has no knowledge of what's underneath; it just adds `B @ A` to whatever matrix it's pointed at. New weights → wrong delta direction → bad output.

**Mitigations**:
- **Pin the base model version.** Use full commit-hash references in your loading code: `AutoModelForCausalLM.from_pretrained(BASE, revision="<hash>")`. Don't rely on the floating tag.
- **Plan for retraining.** Treat each base-model upgrade as a project: re-train all adapters, re-eval, ship together. Bigger base-model upgrades (a different architecture entirely) will require dataset changes too.
- **Don't pin your business to a 6-month-old base.** If you can't realistically upgrade base models, that's a business risk, not a technical one — small open models improve rapidly and your fine-tune will look worse and worse as the world moves on.

## 4. "We trained on test"

**Symptom**: eval metrics are spectacular. Production performance is mediocre. Users complain. You can't reproduce the gap.

**Why**: the eval set leaked into the training set. Most often via:
- Generating both train and eval from the same source pool with no deduplication.
- Running a "data augmentation" script that produced near-duplicate variants of eval examples and threw them in train.
- Re-using a prior eval set for a new fine-tune without checking that the new train set covers some of the same prompts.

**Fix**: dedupe by hashing the prompt portion of every example and removing collisions across splits, **before training every time**:

```python
import hashlib
def hash_prompt(messages):
    user_text = "".join(m["content"] for m in messages if m["role"] == "user")
    return hashlib.sha256(user_text.encode()).hexdigest()

train_hashes = {hash_prompt(ex["messages"]) for ex in train_set}
eval_set = [ex for ex in eval_set if hash_prompt(ex["messages"]) not in train_hashes]
```

For real protection: **eval set is human-curated and never shares a source with training data**. For aggressive protection: also fuzzy-dedupe with MinHash on near-duplicates.

## 5. Quantization mismatch between training and serving

**Symptom**: your fine-tune evaluated well in-notebook, but serving outputs are subtly worse — slight drift in tone, occasional bad answers, marginal task-metric drop.

**Why**: you trained with QLoRA (4-bit base, fp16 compute). At serving you merged to fp16 and quantized to 8-bit. The "merge then re-quantize" path doesn't reproduce the exact arithmetic the model saw during training, and the small numerical drift can accumulate across long sequences.

**Mitigations**:
- **Serve in the same precision you trained in.** If you trained with NF4, keep the base at NF4 at serve time too — most multi-LoRA stacks support this.
- If you must merge and re-quantize, validate the merged-quantized model against your full eval set. Don't assume parity.
- Avoid going to lower precision than training (if you trained at 4-bit, don't serve at 2-bit).

## 6. No regression set

**Symptom**: your team has shipped 4 fine-tunes over 6 months. Nobody can tell whether v3 was actually better than v2, or whether v4 fixed the regression v3 introduced.

**Why**: every fine-tune was evaluated against an ad-hoc eval set built fresh each time. There's no fixed yardstick across versions.

**Fix**: **build a regression set on day one** and don't change it. Run every fine-tune candidate against it. The set should include:
- Representative prompts for each capability you care about.
- A few "general capability" prompts to catch forgetting.
- A few "things v1 was bad at" prompts so you can see if those got fixed.
- Prompts you've personally seen go wrong in production.

Treat the regression set like a CI test suite. If you change the regression set, version it (`v1`, `v2`, ...) and never run new fine-tunes against an old version's set without explicit acknowledgment. [Chapter 13](../evaluation) covers eval discipline at the level a real product needs.

## 7. Refusal-policy regressions

**Symptom**: post-fine-tune, the model either refuses things it used to answer (over-refusal) or answers things it used to refuse (under-refusal — much worse if you ship to consumers).

**Why**: post-training (which the base went through to become "Instruct") shaped where refusal lines fall. Your fine-tune shifts those lines — sometimes intentionally, sometimes as a side effect. See [Chapter 2 §9](../llm-apis-and-prompts/failure-modes) for the broader framing.

**Mitigations**:
- Include a **safety eval** in your regression set: prompts that should be refused (clear harm), prompts that should be answered (legitimate questions in sensitive domains). Track refusal rates on each.
- If you intentionally want to shift refusal behavior (e.g., let the model discuss security research), do it deliberately by including aligned examples in training data, then verify on safety eval.
- If shipping to end users, audit refusal behavior **every fine-tune**, not just at first launch.

## 8. Tool-use format regressions

**Symptom**: the fine-tune is great at the new task, but it stopped emitting valid tool calls. Now your agent can't function.

**Why**: you trained without tool-use examples. The model "forgot" how to emit the tool-call format. Same mechanism as catastrophic forgetting (#1) but specific to tool use.

**Fix**:
- If your model needs to call tools at inference, **always include tool-use examples in the training set** — even if your fine-tuning task isn't about tools. 5–10% of training examples being tool-call examples preserves the format reliably.
- Add tool-call validity to your regression set: a few prompts that should result in tool calls, checked for valid JSON arguments and correct function names.
- See [Chapter 2 §6](../llm-apis-and-prompts/tool-use) for what tool-use messages should look like.

## A meta-pattern

If you look at all eight pitfalls, six of them ultimately reduce to **"have a comprehensive eval set and run it every time."** Catastrophic forgetting, refusal regressions, tool-use regressions, base-model-upgrade breakage, train-test leakage, no-regression-set — all of them are caught by a good eval, and shipped through by a bad or absent one.

The temptation when you're heads-down on a fine-tune is to skip eval and ship. The cost of that shortcut is paid weeks later in production, when you can't tell which past fine-tune introduced the bug, and you have to retrain from scratch. **Build the eval first. Then the fine-tune.**

---

You now have the engineering pieces: when to fine-tune, how LoRA / QLoRA work mechanically, how to prepare data, how to run the training loop on cheap hardware, how to evaluate the result, how to serve it, and the eight pitfalls. Same code with different model + bigger GPU scales linearly.

Next, the theory of how this all works under the hood — [Chapter 12](../post-training).
