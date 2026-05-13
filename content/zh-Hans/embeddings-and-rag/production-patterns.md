# 8. 生产实践

一个能跑的 notebook 不是一个能跑的产品。八个模式把两者分开。

## 1. 永远返回引用

每个 RAG 响应都应该以 `(answer, source_chunk_ids)` 的形式返回，而不是只有 `answer`。用 schema 约束的输出（[第 2 章 §5](../llm-apis-and-prompts/structured-output)）：

```python
class GroundedAnswer(BaseModel):
    answer: str
    sources: list[str]                # chunk IDs the answer relied on
    confidence: float                 # 0..1
```

引用给你三样东西：

- **可审计性。** 模型答错时，你能读它实际看到的 chunk，判断失败是检索还是生成。
- **一个 UI 原语。** 任何严肃的 RAG 产品（Perplexity、Notion AI、Cursor）都有 "Sources" 操作面。没有 citation ID，你做不出来。
- **一个评估信号。** 引用正确性——`sources` 是否指向了答案 claim 所依据的 chunk？——是一个便宜、高信号的生成指标（[§7](./evaluating-rag)）。

如果你不返回引用，你做的不是 RAG 系统。你做的是一个加了 prompt 前缀的 LLM。

## 2. 显式处理"无结果"

当检索返回的是垃圾（分数低、跑题，或者语料里就是没答案）时，模型的默认行为是**仍然试着答**——这就是幻觉（[第 2 章 §9](../llm-apis-and-prompts/failure-modes)）。你得指示它别答，然后再做校验。

System prompt 模式：

```text
Answer ONLY using the provided context. If the context does not contain the
answer, respond exactly: "I don't know based on the provided context."
Do NOT use prior knowledge.
```

再加上调模型前的代码侧护栏：如果 top-k 相似度全部低于一个阈值（比如 cosine similarity < 0.3），直接短路返回 "I don't know"，连 LLM 都不调。你省了 token，也避免用糟糕的 context 诱惑模型。

```python
def answer_with_threshold(query: str, min_sim: float = 0.3) -> dict:
    chunks = retrieve(query)
    best = 1 - chunks[0]["distance"]   # cosine similarity
    if best < min_sim:
        return {"answer": "I don't know based on the provided context.",
                "sources": []}
    # ... normal LLM call
```

这个阈值是一个超参——在 golden set 的对抗切片上调（[§7](./evaluating-rag)）。

## 3. 时效性与增量更新

真实语料是会变的。文档会被新增、编辑、删除。两种策略：

- **增量 upsert。** 文档变了，重新切块、重新 embed、按稳定 ID upsert。删除时用 metadata 里的 `tombstone` 标志做软删除，并在 query 时过滤掉（在 HNSW 索引里比物理删除便宜）。
- **周期性重建。** 每周从零开始重建整个索引。能 catch schema drift、embedding 模型升级和切块策略变化。换 embedding 模型时**必须**重建——你不能在同一个索引里混用不同模型的向量。

权衡：

| | 增量 | 重建 |
|---|---|---|
| 成本 | 低（只动变了的文档） | 高（整个语料） |
| 延迟 | 实时 | 几小时 |
| Embedding 模型迁移 | 不行 | 行 |
| 运维复杂度 | 高（tombstone、去重） | 低 |

大多数生产团队**两个都做**——稳态用增量更新，迁移和漂移修正用周期性重建。

用稳定、确定性的 chunk ID（比如 `f"{doc_id}-{section_path}-{chunk_index}"`）。它让 upsert 幂等，迁移也好推理得多。

## 4. 给稳定前缀加 prompt caching

RAG 请求有个结构性模式：system prompt 和工具 schema **稳定**，chunk 和用户 query **动态**。把稳定部分标为可缓存（[第 2 章 §8](../llm-apis-and-prompts/cost-and-latency)），稳态流量上你通常能砍掉 50–80% 的输入成本。

```python
resp = llm.messages.create(
    model="claude-sonnet-4-6",
    system=[
        {"type": "text", "text": SYSTEM_PROMPT,
         "cache_control": {"type": "ephemeral"}},
    ],
    tools=[answer_tool],   # tool schemas are also cached implicitly when stable
    messages=[{"role": "user", "content": user_msg}],
)
```

让这件事成立的 KV cache 机制在**第 7 章**讲。这里的要点：把你的 prompt 设计成稳定前缀*真的稳定*。如果你把时间戳、请求 ID、chunk 文本拼进 system prompt，你就白白把缓存搞坏了。

## 5. 你真正会调的旋钮——按影响力排序

当 recall 或 faithfulness 回归时，按这个顺序调。影响力大的优先。

| # | 旋钮 | 典型影响 | 修改成本 |
|---|---|---|---|
| 1 | 块大小和 overlap | 大 | 重建索引 |
| 2 | Embedding 模型 | 中到大 | 完全重建索引 |
| 3 | Top-k | 中（太低漏，太高吵） | 免费 |
| 4 | 混合检索 + 重排（[§6](./reranking-and-hybrid)） | 对它能修的失败模式中到大 | 代码 + 延迟 |
| 5 | 向量 DB | 微——只在大规模或需要过滤时才有意义 | 重新选型 |

注意没在列表里的：temperature（grounding 场景下保持 0–0.2）、grounding 指令之外的 prompt 工程小调（回报很小）、换更贵的 LLM（通常是最便宜的旋钮但很少是瓶颈）。

## 6. 反模式

- **"全 embed 进去然后祈祷。"** 切块是影响力最大的旋钮（[§4](./chunking)）。糟糕的切块策略，再好的 embedding 模型也救不了。
- **"纯向量检索，没 BM25。"** 精确匹配会失败——码、SKU、错误字符串（[§6](./reranking-and-hybrid)）。
- **"没有评估集。"** 你没法判断改动是否回归。第三天就建 golden set，不要等到第六个月（[§7](./evaluating-rag)）。
- **"塞 50 个 chunk 进 context。"** 几乎总是 top-5 reranked 比 top-50 raw 好。长 context 稀释 attention，烧 token。
- **"每次 query 都实时 embed，不缓存。"** 你的账单会爆。Query embedding 加 LRU 缓存（按 query 字符串），文档 embedding 一定要持久化缓存。
- **"每次部署都重新 embed 整个语料。"** 又贵又几乎从来没必要。Embedding 只有在模型变化时才需要重新生成。
- **"把相似度分数当置信度。"** Cosine 相似度是一个*排序*信号，不是校准过的置信度。用它来排序、做基于阈值的无结果检测，不要用它说"模型有 X% 把握"。

## 7. 通往第 4 章的桥：从被动检索到主动检索

看一下你这一章里搭的流水线。*你的代码*决定什么时候检索。*你的代码* embed query。*你的代码* 取 chunk。*你的代码*格式化 prompt。模型只消费你给它的东西。这是**被动检索**——应用是主导。

在**第 4 章**，你会把这个翻过来。检索变成**模型**可以选择调用的工具（[第 2 章 §6](../llm-apis-and-prompts/tool-use)）：

```python
tools = [
    {
        "name": "search_kb",
        "description": "Search the knowledge base for chunks relevant to a query.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "k": {"type": "integer"}},
            "required": ["query"],
        },
    },
    # ... other tools the agent can call ...
]
```

模型决定：
- **是否**检索（有些问题不需要）。
- **检索什么**（它可以改写、分解、多 query）。
- **何时停止**检索并作答。

同一个向量 DB、同一些 chunk、同一个 embedding 模型——但编排从你的代码搬到了模型的决策循环里。这就是一个 **agent** 在做 RAG，有时叫 **agentic retrieval** 或 **tool-style RAG**。

第 3 章里的所有东西仍然适用。流水线没消失，只是被另一个 driver 调用。第 4 章你会去搭那个 driver。

## 延伸阅读

- Lewis 等，[*Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*](https://arxiv.org/abs/2005.11401)——2020 年的原始论文。短、好读，架构几乎没变过。
- Anthropic，[*Prompt caching*](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)——§4 和[第 2 章 §8](../llm-apis-and-prompts/cost-and-latency)引用的运维指南。
- Malkov & Yashunin，[*Efficient and robust approximate nearest neighbor search using HNSW*](https://arxiv.org/abs/1603.09320)——HNSW 论文。即使跳过数学，也读一下里面的图。
- [*ragas docs*](https://docs.ragas.io/)——规范的 RAG 评估库；里面的 LLM-judge prompt 单独读也值得。
- [*Pinecone: hybrid search*](https://www.pinecone.io/learn/hybrid-search-intro/)——干净地讲清楚了纯向量检索为什么会失败、混合检索如何修复。
- Liu 等，[*Lost in the Middle*](https://arxiv.org/abs/2307.03172)——[第 0 章 §5](../how-llms-work/context-window)引用的论文；解释了"塞更多 chunk"为什么是比"精心检索 + 重排"更糟的策略。
