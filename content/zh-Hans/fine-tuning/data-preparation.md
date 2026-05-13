# 3. 数据准备

如果你只从本章带走一件事：**数据质量是决定微调质量的最大单一因素**，差距大到压过其他所有东西。算法选择、学习率、秩、基座模型——都重要，但和"500 条精写的样本"vs."10000 条从某处爬来再略微清洗的样本"之间的差距比起来，都是舍入误差。

你会在数据上花的时间比训练上多。提前规划。

## 再说一次 chat template

[第 0 章 §3](../how-llms-work/completion-to-conversation) 解释过"对话"只是一个带 role 标签的字符串。在微调时，这一点是带着雷霆万钧的：**你的训练数据必须使用基座模型期待的精确 chat template，一个字符都不能差**。

Qwen 模型的 template 长这样：

```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
What is the capital of France?<|im_end|>
<|im_start|>assistant
The capital of France is Paris.<|im_end|>
```

Llama 3 是 `<|start_header_id|>...<|eot_id|>`。每个基座模型的 template 都是随 tokenizer 一起发的。永远不要手写。直接用：

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

如果你在错的 template 上训练，模型就是在垃圾 token 上微调——`<|im_start|>` 这种特殊 token 被当作普通文本处理，模型永远学不会该有的回合结构。推理期的症状：模型把 chat 标签当成普通文本输出，或者根本停不下来。这是头号失败模式，而且你一定会撞上。

## 格式样例

三种常见格式。第一种是你 95% 时间会用的。

### SFT chat 格式（标准）

一个 JSONL 文件，每一行是一个完整的训练样本：

```json
{"messages": [
  {"role": "system", "content": "You are a SQL assistant. Output only valid PostgreSQL."},
  {"role": "user", "content": "Get the top 5 customers by total order value in 2025."},
  {"role": "assistant", "content": "SELECT c.id, c.name, SUM(o.total) AS lifetime_value\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nWHERE o.created_at >= '2025-01-01' AND o.created_at < '2026-01-01'\nGROUP BY c.id, c.name\nORDER BY lifetime_value DESC\nLIMIT 5;"}
]}
```

这就是 `trl` 的 `SFTTrainer` 原生吃的格式。一行 JSONL = 一段完整对话，system message 可选。

### 多轮

同样的格式，更多轮。多轮数据教模型处理上下文——对工具调用、多步推理，以及任何 assistant 需要在自己上一段输出基础上继续的场景都很重要。

```json
{"messages": [
  {"role": "user", "content": "Summarize this PR description."},
  {"role": "assistant", "content": "<summary>"},
  {"role": "user", "content": "Now write a Slack message announcing it."},
  {"role": "assistant", "content": "<announcement>"}
]}
```

### 带工具调用

如果你的微调模型需要发出工具调用，训练数据必须以模型原生的 tool 格式包含 tool-call 样本。Qwen / OpenAI 风格：

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

如果你的基座本来会工具调用，但你微调时不带 tool-call 样本，**你会失去工具调用能力**——见 [第 2 章 §6](../llm-apis-and-prompts/tool-use)。如果你的模型推理时需要工具调用，训练数据里务必混入一份有代表性的工具调用样本。

### 纯 completion 格式（少见）

给那些没有做 chat 微调的基座 / completion 模型用的：

```json
{"prompt": "Translate to French:\nHello, world!\n\nFrench:", "completion": " Bonjour, le monde!"}
```

2026 年几乎没人在 base 模型上做微调了——instruct 调过的版本几乎在所有任务上都是更好的起点。这里只是为了让你在老教程里看到时认识它。

## Loss masking：只在 assistant token 上算 loss

这是微调里第二常见的、安静的 bug。

计算交叉熵 loss 的时候，应该**只在 assistant 回复的 token 上算 loss**，不要在 system 或 user 的 token 上算。如果你在 user token 上算 loss，你就是在训练模型预测（也就是生成）user 的输入——和你想要的完全相反。模型会在回复中间冒出来，开始模仿假想的 user 消息。

大多数现代库在你给它对话格式数据时会自动处理这件事。`trl` 的 `SFTTrainer` 在拿到 `messages` 格式的数据集 + `assistant_only_loss=True`（或者用对应的 `data_collator`）之后，会自动把 user/system 的 token 在 `labels` 里设成 `-100`，让它们不参与 loss。

怎么验证：从 dataloader 抽一个 batch，检查 `labels`。`label = -100` 的位置就是被 mask 的；其他位置是被训练的。

```python
batch = next(iter(trainer.get_train_dataloader()))
input_ids = batch["input_ids"][0]
labels = batch["labels"][0]
for tok, lbl in zip(input_ids[:50], labels[:50]):
    print(repr(tok.item()), "->", repr(lbl.item()))  # -100 = masked
```

如果每个 label 位置都是非 `-100`，你就是在 user prompt 上训练。修 collator。

## 质量 > 数量

反直觉但 2025–26 都有充分文献支撑（[第 10 章 §6](../post-training)）：**500 条精心写的样本经常打过 10000 条粗清洗的**。"少而精"模式之所以有效是因为：

- 模型已经会生成文本——你只是在教它一个具体行为。少量干净样本能把梯度干净地推向那个方向。
- 坏样本会主动让模型困惑。一条互相矛盾的样本可以抵消一百条一致样本带来的信号。
- 数据越干净，过拟合风险越低。可以训更少的 epoch，更早停。

2026 年常见的工作流：用一个更强的模型（前沿 API）生成或批评候选样本，然后让人类把头部的 500–2000 条精选出来。这种 **蒸馏** 模式——强 teacher → 小 student——现在是窄领域专精的默认做法。

## 常见坑（背下来这张清单）

1. **chat template 错了。** 训练 token 没包含正确的回合标记，或者用了别的模型的标记。症状：推理时模型直接输出 `<|im_start|>` 标签，或者永远停不下来。
2. **在 prompt 上算了 loss。** user/system token 没 mask。症状：模型偶尔生成出一段看起来像用户提问而不是回答的文本。
3. **序列长度太短。** 默认 `max_length` 经常是 512 或 1024；更长的 assistant 回复会被**从中间截断**，模型就学会了输出不完整的回答。先看你的数据集长度分布，再选 `max_length`。
4. **类别不均衡 / 主题倾斜。** 如果 80% 数据是同一种任务，模型会在所有输入上都坍缩到那种风格。做分层采样。
5. **训练集污染了 eval set。** 测试集泄漏极其常见——train 和 eval 来自同一来源，互相重叠。在 split 之间对 prompt 做哈希去重。
6. **system prompt 不一致。** 一半样本有 system prompt 一半没有，模型学到的是"行为取决于有没有 system prompt"。要么每条都加一致的 system prompt，要么都不加。
7. **工具调用格式漂移。** 工具调用样本里 JSON 哪怕错得很微妙（多余空格、漏字段），都会变成模型的新约定。给你的 tool-call 数据加 lint。

## 序列 packing

大多数训练样本远比 `max_length` 短。最朴素的做法是把每个样本用 `<pad>` 填到最大长度，于是 GPU 大部分算力都耗在 padding 上。**Packing** 把多个短样本拼到一个序列里（通过 attention mask 保证它们不会跨界注意），训练速度能快 2–5 倍，质量没损失。

`SFTTrainer` 通过 `packing=True` 支持。只要样本相对 `max_length` 偏短，并且你没有特定的反对理由（主要的反对理由是：序列边界本身带有 attention mask 不能干净保留的语义），就开它。

## 一份完整的 `prepare_data.py`

参考脚本：吃一份 `{messages: [...]}` 的 JSONL，套上 tokenizer 的 chat template，丢掉过长样本，写成一个 Hugging Face 数据集目录。`SFTTrainer` 严格说不要求这一步（它能直接吃 JSONL），但在训练前线下检查数据时很有用。

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

跑一下看看输出。如果 `kept` 把很多样本扔了，就把 `MAX_LEN` 调大或者预先做截断。如果你的长度分布是双峰的（很多短的 + 几个超长的），重新想想那些超长的到底该不该在这个数据集里——它们经常会让训练严重偏移。

下一节: [实战：Qwen-3B + QLoRA →](./qwen-qlora-colab)
