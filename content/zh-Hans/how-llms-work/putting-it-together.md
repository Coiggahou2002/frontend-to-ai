# 串起来看

一次完整的 LLM API 调用，从头到尾：

```
1. 你的客户端拼出一个 `messages` 数组
   - 系统提示词 + 完整的过往历史 + 新的用户消息
   - 这是你的活；服务端没有之前轮次的记忆

2. SDK 按模型的对话模板把 messages 渲染成一串 token 序列
   - 角色标签会作为特殊 token 插入
   - 序列在 `<|im_start|>assistant\n` 之后立即结束，让模型知道要续写什么

3. 服务端检查 token 数是否超过上下文窗口
   - 太长就给你 4xx 错误（或者 token 被截断，看具体 API）

4. 模型做前向计算
   - "prefill" 阶段：并行处理所有输入 token，产出 KV cache，得到第一个输出 token 的分布
   - "decode" 阶段：采一个 token，追加，再前向，再采下一个……直到停止 token 或达到 max_tokens

5. 每个输出 token 都是采样得到的
   - 温度、top-p 等参数塑造分布
   - 选中的 token 被追加到序列上，再次喂回去

6. 响应以流式（或一次性）返回
   - SDK 剥掉对话模板的包装，把 assistant 文本交还给你

7. 请求一结束服务端就忘了一切
   - 没有任何状态被保留；如果你想要"下一轮"，就再重放一次历史
```

本指南的每一章都建立在这个循环之上：

- **第 1 章（Python）**给你能真正去调用这个循环、处理它的输出、围绕它构建系统的语言。
- **第 2 章（LLM API 与 Prompt 工程）**讲的是怎么"工程化"这个 `messages` 数组——系统提示词放什么、用户消息怎么组织、什么时候用 few-shot 示例、怎么把多次调用串起来。
- **第 3 章（嵌入向量、向量检索与 RAG）**讲的是怎么把对的知识塞进 prompt 里同时又不超出上下文窗口。
- **第 4 章（Agent 与工具调用）**讲的是怎么通过把模型的一部分输出 token 解释成函数调用，让模型与外部世界互动——本质上仍是一次前向传播，但输出被解读成工具调用。
- **第 5–8 章（GPU 选型、基础设施技术栈、KV cache、推理并发）**是这个循环的硬件和服务侧——跑一个模型要花多少钱、KV cache 怎么让服务器跳过重复计算、并发请求之间怎么共享 GPU 显存。
- **第 9–10 章（微调与后训练）**讲的是*改变*模型已经学到的分布——让它在你的特定任务上做得更好，或者用强化学习塑造它的行为。
- **第 13 章（评估）**讲的是在非确定性面前，怎么衡量上面这一切到底有没有起作用。

到这里你理解了这台机器。下一章会教你操作它的语言。

## 延伸阅读

- Karpathy，[*Let's build the GPT tokenizer*](https://www.youtube.com/watch?v=zduSFxRajkE)——一段 2 小时的视频，从零构建一个 BPE 分词器。目前对分词最清晰的讲解。
- Karpathy，[*Let's build GPT: from scratch, in code, spelled out*](https://www.youtube.com/watch?v=kCc8FmEb1nY)——本章之后的下一步，如果你想看到下一个 token 预测被实现出来。
- Holtzman 等人，[*The Curious Case of Neural Text Degeneration*](https://arxiv.org/abs/1904.09751)——提出 top-p（核）采样、并解释贪心解码为什么会失败的那篇论文。
- Liu 等人，[*Lost in the Middle: How Language Models Use Long Contexts*](https://arxiv.org/abs/2307.03172)——[§5](./context-window) 里"长上下文但中间召回退化"那个注意事项背后的论文。
- OpenAI，[*Tokenizer playground*](https://platform.openai.com/tokenizer)——粘贴任意文本，看它是怎么被分词的。值得收藏。
