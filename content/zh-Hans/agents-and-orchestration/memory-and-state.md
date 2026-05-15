# 5. 内存与状态

模型是无状态的（[第 0 章 §4](../how-llms-work/multi-turn)）。两次连续的 API 调用在服务端不共享任何东西。所以人们说"agent 记得"的时候，他们真正的意思是：**客户端在每一轮迭代都把 messages 数组重放一遍，那个数组就是 agent 的 working memory。**

把这句话内化下来，内存工程剩下的部分就一目了然：你决定数组里放什么。你决定什么被摘要。你决定什么溢出到数据库。模型只是读你递给它的东西。

## 三层

| 层 | 存在哪里 | 生命周期 | Token 成本 | 放什么 |
|---|---|---|---|---|
| Working memory | `messages` 数组（进程内） | 单次 agent 运行 | 计入上下文预算 | 当前的对话记录：工具调用、结果、中间文本 |
| Scratchpad | agent 通过工具读写的一个有 key 的内存字典 | 单次会话（多次运行） | 只有每轮注入的部分才计费 | 稳定事实：用户名、当前 ticket ID、识别到的偏好 |
| 持久化 memory | 外部存储（Postgres、向量库） | 跨会话 / 跨用户 | 像 RAG 一样，由检索控制 | 长期：过去的对话、用户画像、过往决策 |

第 1 层你几乎一定需要（每个 agent 都有）。一旦你的 agent 在同一会话里有多个子任务，你大概率就需要第 2 层。只有当你的产品有跨会话连续性（"记得我上周问过你什么"）时才需要第 3 层。

## 第 1 层：working memory = messages 数组

[§1](./the-agent-loop) 里的循环已经在维护这个了。每一轮迭代会 append：

- assistant 那一轮（文本 + tool_use 块）。
- 携带 tool_results 的 user-role turn。

对话记录单调增长。每一轮模型都把它从头读一遍。两个你必须为之做设计的后果：

**1. 对话记录就是免费的调试日志。** 别在运行结束时就扔掉——记下来给 [§8 评估](./evaluating-agents) 用。完整的 `(messages, tool_results, model_output)` 序列就是轨迹。

**2. 长运行会把上下文撑爆。** 每轮迭代输入都更大。到第 15 轮，一个研究 agent 每次调用可能都要发 80K token 的对话记录。这点我们在下面处理（摘要），以及在 §4 里处理（子 Agent 把最大块的内容整个搬出父 Agent 的上下文）。

## 第 2 层：scratchpad = 显式的 key-value 存储

scratchpad 就是一个简单的字典，agent 通过两个工具写入和读取：

```python
SCRATCH: dict[str, str] = {}

SCRATCH_TOOLS = [
    {
        "name": "scratch_set",
        "description": (
            "Write a fact to the scratchpad. Use for stable info you'll need across "
            "iterations: user_name, ticket_id, current_environment, user preferences."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
            "required": ["key", "value"],
        },
    },
    {
        "name": "scratch_get",
        "description": "Read a value from the scratchpad by key.",
        "input_schema": {
            "type": "object",
            "properties": {"key": {"type": "string"}},
            "required": ["key"],
        },
    },
]

def tool_scratch_set(key: str, value: str) -> dict:
    SCRATCH[key] = value
    return {"set": key}

def tool_scratch_get(key: str) -> dict:
    return {"key": key, "value": SCRATCH.get(key)}
```

更好的做法是让循环**每轮都把当前 scratchpad 作为系统提示词的一部分注入**，而不是依赖模型去调 `scratch_get`。这样模型"记得"，但不用为了检索调用花 token：

```python
def build_system_prompt(base_prompt: str, scratch: dict) -> str:
    if not scratch:
        return base_prompt
    facts = "\n".join(f"- {k}: {v}" for k, v in scratch.items())
    return f"{base_prompt}\n\n<scratchpad>\n{facts}\n</scratchpad>"
```

这是个小想法但影响不成比例：模型现在有了一份在任何上下文窗口压力下都能扛住的常数成本"内存"。在编码 agent（当前文件、当前分支、上次测试结果）和客服 agent（user_id、ticket 优先级、升级标记）里被大量使用。

## 第 3 层：跨会话的持久化 memory

一次 agent 运行结束时，第 1 层和第 2 层就没了。如果下一次会话需要知道上一次发生了什么，你就需要外部存储。这就是把 RAG（[第 3 章](../embeddings-and-rag)）从文档换成"过去的交互"上：

- 每次会话结束，把要紧的事实做摘要（用 LLM 自己来写摘要）。
- 把摘要做 embedding，写入向量库，附上 `(user_id, session_id, ts)` 元数据。
- 下次会话开始时，按这个用户取 top-k 的摘要，注入系统提示词或作为靠前的 `user` 消息。

检索策略是设计选择：按 user_id、按主题相似度、按 recency，或者某种加权组合。recency 加权的相似度是个合理的默认。

这就是 ChatGPT 的"memory"功能、Anthropic 的 Memory beta 工具，以及大多数"个性化助手"产品背后的架构。它跟 RAG 不是不一样的机制，只是把语料从文档换成了过去对话的摘要。

## 摘要：长运行 agent 的逃生口

当 working memory 接近上下文上限时，循环必须做点什么。三种策略，复杂度递增：

1. **截断。** 一旦越过某个阈值（比如上下文的 50%），就丢掉最早的 tool_use/tool_result 对。便宜、有损，往往够用。
2. **摘要 + 切片。** 当对话记录超过 N token，把中间一段换成 LLM 写的摘要；保留开头的用户目标和最近 ~10 个 turn 不动。
3. **子 Agent**（[§4](./parallel-and-subagents)）。不要事后摘要——把大块子任务推到子 Agent 里，子 Agent 只返回结构化发现，父 Agent 的对话记录从一开始就不会长那么大。

一个迷你的"摘要 + 切片"辅助函数：

```python
def maybe_summarize(messages: list, threshold_tokens: int = 80_000) -> list:
    if estimate_tokens(messages) < threshold_tokens:
        return messages

    keep_head = messages[:1]                  # original user goal
    keep_tail = messages[-10:]                # most-recent turns
    middle = messages[1:-10]
    if not middle:
        return messages

    summary = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system="Summarize this agent transcript. Keep all decisions, tool results, and unresolved questions. Drop tool-call boilerplate.",
        messages=[{"role": "user", "content": serialize_for_summary(middle)}],
    ).content[0].text

    return keep_head + [
        {"role": "user", "content": f"<summary_of_prior_steps>\n{summary}\n</summary_of_prior_steps>"}
    ] + keep_tail
```

`estimate_tokens` 是基于分词器对序列化后的 messages 数 token。`serialize_for_summary` 把工具块拍平成可读文本。两者都是 10 行的 helper。

这是有损的。先在已经记录下来的轨迹上跑一遍，确认摘要保留了重要内容，再在生产里启用。

## 上下文预算的心智模型

任何一轮迭代里，agent 的 prompt 大致是这样布局：

```
+--- system prompt ---------------+   ~5K tokens
+--- scratchpad section -----------+   ~1K
+--- tool schemas ----------------+   ~3K
+--- transcript (messages array) -+   grows monotonically
|   user goal                     |
|   asst turn 1 (text + tool_use) |
|   user turn 1 (tool_results)    |
|   asst turn 2                   |
|   ...                           |
|   asst turn N                   |
+--- next assistant turn (output) +   model's slot to fill
```

跑 agent 的一个典型 200K 上下文模型，一份健康的预算切分大致这样：

```
+ system prompt        ~5K tokens
+ tool schemas         ~3K
+ scratchpad           ~1K
+ stable RAG context   ~5K   (if injected)
+ transcript           ~80K  (room to grow during the run)
+ retrieved chunks     ~50K  (one big retrieval result)
+ headroom for output  ~30K
                       -----
                       ~174K of 200K used; 26K headroom
```

从这张图能引出两条设计规则：

- **把稳定部分钉在前面。** system + tool schemas + scratchpad 在迭代之间稳定，在很长的运行里也稳定。它们是缓存的完美前缀（[第 2 章 §8](../llm-apis-and-prompts/cost-and-latency)）。
- **会涨的是对话记录。** 上面所有的内存管理技巧都是在控制对话记录的增长——通过摘要、通过推到子 Agent 里、或者通过把一部分溢出到外部存储。

## 前向链接：prefix caching 对 agent 收益巨大

Agent 有 prompt caching 完美的形状：一段长且稳定的前缀（system + tools + 早期对话记录），每轮迭代都被重新处理。打开 prefix caching 之后，推理引擎能识别出和上一轮共享的前缀，不再去重新 attend——只有新的尾部（最新的 tool_result）按全价计费。

一个跑 15 轮、最后对话记录有 80K token 的 agent 运行，没缓存的成本主要被每轮重新 prefill 那 80K 主导。开了缓存之后，每轮迭代的边际成本大致就是新的 tool_result 加上新的模型输出——便宜了几个数量级。

[第 9 章](../kv-cache) 讲让这件事成为可能的 KV cache 机制。这里的要点：**agent 运行是 prefix caching 投资回报率最高的场景。** 比 RAG 高，比长上下文 Q&A 高。如果你在 agent 上不开缓存，每一次长前缀 prefill 都是你自己掏钱。

下一节: [安全与预算 →](./safety-budgets)
