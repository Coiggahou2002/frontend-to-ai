# 3. 从续写到对话

模型只会做一件事：续写一串 token。那怎么从这件事里得到一个聊天机器人？

## 基础模型只会续写

预训练的原始产物叫做**基础模型（base model）**（或"续写模型"）。它在一大堆互联网文本和书籍上训练过——它的工作就是预测它看到的任何文本里下一个 token 是什么。喂它 `"The quick brown"`，它大概会输出 `" fox"`。

喂一个训练得好的基础模型 `"User: What is the capital of France?\nAssistant:"`，它确实经常会续写出 `" The capital of France is Paris."`——不是因为它理解"你是助手"，而是因为在它训练的语料里，长得像那样的文本后面通常跟着长得像答案的文本。

这本身已经是一个能用的 LLM 了。但基础模型用来聊天不可靠——它也可能续写另一个用户问题，或者跑题，或者写一条 Reddit 评论。它训练目标是模仿**整个**互联网，不是只扮演一个助手。

## Chat 模型在对话格式上做了进一步训练

现代 chat 模型（GPT-4、Claude、Llama-Instruct、Qwen-Chat 等）是在基础模型的基础上，用特定格式的对话进一步训练的——这个过程叫**后训练（post-training）**或**指令微调（instruction tuning）**（第 12 章会深入讲）。

这种格式使用**特殊 token**来标记角色之间的边界。不同模型家族用不同的标记，但本质做的是同一件事。下面是 Qwen 风格的对话模板在底层长什么样：

```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
What is the capital of France?<|im_end|>
<|im_start|>assistant
The capital of France is Paris.<|im_end|>
```

Llama 3 用的是另一套标记（`<|start_header_id|>system<|end_header_id|>...<|eot_id|>`），GPT 模型用的是又另一套，但结构都一样：角色标签、正文、结束标记。

当你用 `messages=[{role: "system", ...}, {role: "user", ...}]` 调用 OpenAI 或 Anthropic 的 API 时，SDK 不过是一层薄薄的封装，**把你的结构化消息按模型的对话模板渲染成一大串 token**，发给模型，让模型续写。

## "系统提示词"就是一段普通文本

一旦你看到对话模板，系统提示词所有的神秘感都会消失。它**不是单独的输入通道**，不是元数据，不是某种特殊的指令层。

它就是 prompt 内部的一段文本，前面带了一个 `system` 角色标签，模型在后训练阶段学会了在这段内容上加大权重。

```
<|im_start|>system
You are a senior backend engineer. Be concise.<|im_end|>
<|im_start|>user
Why is my Postgres query slow?<|im_end|>
<|im_start|>assistant
```

模型看到的是这一整团文本，从它停下的地方（紧挨着 `assistant\n` 之后）继续往下写。"system" 标签是它学会去重视的一个信号，但机制上没有任何特殊的事情发生。

带来的几个含义：

- 系统提示词和用户提示词共用同一份上下文预算，都消耗 token。
- 一条足够长的用户消息很容易把一条简短的系统提示词淹没。
- "Prompt injection" 之所以能起作用，是因为一旦用户文本被拼接进同一个字符串，模型就没有任何架构上的特权方式去区分"这部分是运营方的指令"和"这部分是用户在试图覆盖它"。缓解措施是有的，但都是训练时和 prompt 设计上的防御，不是架构上的保证。

## `assistant` 是一个续写提示

关键的小把戏：SDK 把渲染好的 prompt 在 `<|im_start|>assistant\n` 之后就停住——assistant 这一轮已经开始了，但还没有正文。模型一如既往地，要做的事情是续写。所以它一个 token 一个 token 地生成 assistant 消息的正文，直到它产生结束标记 `<|im_end|>`（或它的模板中等价的标记），到那一刻循环停下。

整个"对话"的抽象就是：把会话格式化成一份对话记录，把 assistant 那一轮留空，让模型自动补全。

下一节：[多轮对话（无状态） →](./multi-turn)
