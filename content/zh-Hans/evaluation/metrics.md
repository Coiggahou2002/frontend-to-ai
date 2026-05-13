# 3. 指标

有了 golden set，下一个问题是每个 case 上要测什么。指标分为三类，按成本递增、信号确定性递减：

| 类别                       | 单 case 成本    | 信号确定性             | 可复现？  | 什么时候用                                       |
|---|---|---|---|---|
| 程序化（programmatic）     | 约等于免费      | 在它能测的范围内很高    | 是        | 答案能机械检查时                                  |
| 模型评分（LLM-as-judge）   | $0.001–$0.01    | 中等；需要校准          | 大致是    | 没有单一正确答案的开放式输出                      |
| 人工评分                   | $1–$10          | 最高                    | 是        | ground truth、rubric 校准、合规类产品             |

**能用程序化就用程序化。只有便宜的一档用尽了，再往上爬。**多数团队过度依赖 LLM-judge，因为他们觉得程序化检查太"低端"。它们不低端。它们更便宜、更快、在能检查的部分上更可靠。

## 类别 1：程序化

这是对输出做确定性的检查。便宜、快、没有 judge 偏置、完美可复现。例子：

- **Exact match。**答案字符串等于金标字符串。对分类标签、意图路由、多选有用。
- **JSON schema 校验。**输出能被解析、能匹配 Pydantic / JSON Schema。用 [第 2 章 §5](../llm-apis-and-prompts/structured-output) 的结构化输出校验器。
- **字段级相等。**特定字段匹配（比如 `extracted.amount == 42.50`）；自由文本字段单独评分。
- **正则匹配。**输出符合某个 pattern。对格式约束（日期、电话号码、引用 tag）有用。
- **集合相等 / Jaccard。**给多标签输出用。
- **数值容差。**`abs(predicted - gold) < 0.05`。给抽取出的数字用。
- **延迟预算。**`total_latency_ms < 2000`。这是真的指标——一个正确但用不了的系统就是坏的。
- **Token 数预算。**`output_tokens < 500`。啰嗦也是一种实在的失败模式。
- **成本预算。**`cost_usd_per_call < 0.05`。
- **工具调用检查。**"agent 是不是用 `qty=3` 调了 `submit_order`？"——查工具日志。
- **引用正确性。**"`answer.sources` 是不是只包含检索到的 chunk 的 ID？"（[第 3 章 §7](../embeddings-and-rag/evaluating-rag)）。
- **禁出现内容。**`must_not_say` 里没有任何一项出现在输出中。

一份完整的程序化指标示例：

```python
from typing import Callable
from pydantic import BaseModel

class CaseResult(BaseModel):
    case_id: str
    metrics: dict[str, float | bool]
    output: str
    cost_usd: float
    latency_ms: float

def run_programmatic_checks(case: EvalCase, output: str, log: dict) -> dict[str, bool]:
    return {
        "schema_valid":     try_parse_json(output) is not None,
        "must_say_all":     all(s.lower() in output.lower() for s in case.must_say),
        "must_not_say_any": not any(s.lower() in output.lower() for s in case.must_not_say),
        "latency_ok":       log["latency_ms"] < 2000,
        "cost_ok":          log["cost_usd"] < 0.05,
        "no_pii_leaked":    not contains_pii(output),
    }
```

在整个集合上聚合：每个检查的通过率。如果两次 prompt 版本之间 `schema_valid` 从 0.99 掉到 0.92，你已经回归了，不需要 judge 来告诉你。

## 类别 2：模型评分（LLM-as-Judge）

当输出是开放式的——一段摘要、一段解释、一条聊天回复——程序化检查能验证它的*某些部分*（必须出现的事实、schema、引用），但没法给整体质量评分。这就是 judge 模型登场的地方。

完整内容在 [§4](./llm-as-judge)。简短版本：用一次单独的 LLM 调用，按 rubric 来评估被测系统的输出，返回结构化的判决。

数量级估算：500 个 case × 单次 judge $0.005 ≈ 单次评估跑 $2.50。相对于工程师时间是廉价的。

LLM-judge 适用于：

- RAG 的 faithfulness（"答案里的所有 claim 是不是只来自检索到的 chunk？"）。
- 语气 / 风格（"是不是符合我们的品牌口吻？"）。
- 有用性（"答案是不是真的解决了用户的问题？"）。
- 完整性（"agent 的最终报告是不是覆盖了所有要求的章节？"）。
- Pairwise 比较（"回复 A 是不是比回复 B 好？"）。

不要用 LLM-judge 来做：

- 程序化检查能做的事。先用那些。
- judge 自己也不可靠的数学 / 事实正确性。（judge 模型本身不知道的东西，它也评不出来对错。）
- 最终 ground truth。judge 是*一个*信号，不是*那个*信号。要拿人工来校准，[§4](./llm-as-judge)。

## 类别 3：人工评分

慢、贵，是唯一真正的 ground truth。慎用：

- **给 judge 校准。**30–50 个 case，两个人工评分员，跟 judge 判决对比。如果一致率低于约 85%，去修 rubric。
- **合规或高风险功能的最终验收。**
- **设计 rubric。**先让人徒手给 20 个 case 打分，再去看分歧出在哪儿，从他们争执的地方把 rubric 提炼出来。

别把人放进 CI 的内循环。人是按成本线性扩展的；评估必须按代码改动来扩展。人是用来校准的，不是用来跑生产的。

## 按任务类型挑指标

| 任务                       | 主指标                                | 辅指标                                 | 备注                                            |
|---|---|---|---|
| 分类                       | Accuracy、F1                          | 混淆矩阵                               | 只用程序化。                                    |
| 抽取（JSON）               | schema valid + 字段级相等             | 自由文本字段做语义相等                 | 别因为 "$5,000.00" 对 "$5000" 扣分。            |
| RAG 检索                   | recall@k、MRR                         | NDCG                                   | 见 [第 3 章 §7](../embeddings-and-rag/evaluating-rag)。|
| RAG 生成                   | Faithfulness（judge）                 | 引用正确性、必须出现的事实             | 混合用是常态。                                  |
| 聊天 / 写作                | rubric 上的 LLM-judge                 | 长度、语气（judge）                    | 跟人工校准。                                    |
| Agent 任务完成             | 程序化的结果检查                      | 轨迹 rubric（judge）                   | 见 [第 4 章 §8](../agents-and-orchestration/evaluating-agents)。|
| 工具调用参数抽取           | 关键参数上的工具调用 exact match      | 工具调用次数                           | 只用程序化。                                    |
| 拒答校准                   | 对抗切片+良性切片上的拒答率           | 两者都要看                             | 误拒（false-positive refusal）是真 bug。        |
| 微调对比                   | 同一套指标，跑在 held-out 集合上      | 对 base 模型的胜率（pairwise judge）   | 见 [第 9 章](../fine-tuning)。                  |

不同行之间有重叠，重叠就是重点。**搭多个轻量级指标，不要只搭一个重量级指标。**它们彼此相关但在边界处会分歧，bug 就藏在边界里。

## 一个常见的坑：单数字陷阱

团队会把评估化简成一个数字（"score: 0.83"），然后像盯股价一样盯着。别这么干。单一数字会掩盖是哪个切片回归了。

永远要切片。最少要按类别和按难度分别报告指标：

```python
def report_by_slice(results: list[CaseResult], cases: list[EvalCase]) -> None:
    case_by_id = {c.id: c for c in cases}
    by_category = defaultdict(list)
    by_difficulty = defaultdict(list)
    for r in results:
        c = case_by_id[r.case_id]
        for k, v in r.metrics.items():
            by_category[(c.category, k)].append(float(v))
            by_difficulty[(c.difficulty, k)].append(float(v))
    # ... print rates with case counts so a 1/3 doesn't look like a 99/100 ...
```

整体看起来 5% 的回归，实际上是"billing"切片上 30% 的回归——平均值会把它藏起来。"对抗"切片上的回归（注入成功率从 1% 涨到 6%）就是那种你上线之后会在 Twitter 上读到的事故。

## 校准是不可妥协的

每一个模型评分指标都需要定期跟人工评分对比。如果分歧超过约 15%，rubric 就太含糊（呼应 [第 4 章 §8](../agents-and-orchestration/evaluating-agents)）。

工作流：

1. 从本周的 eval 跑里随机抽 30 个 case。
2. 让两个人各自独立打分。
3. 在两人意见一致的那部分上，跟 judge 比较。
4. judge 跟人不一致的地方，去看为什么。要么是 rubric 模糊（重写 rubric），要么是 judge 模型有已知偏置（去抵消它，[§4](./llm-as-judge)）。

校准会随着 rubric 变化、judge 模型替换、被评估系统变化而漂移。每季度重新校准一次，或者上述任何一项变化之后立即重新校准。

## 成本 vs. 信号：钱该花在哪儿

一个典型聊天产品、golden set 200 个 case 的粗预算：

| 层级                                             | 单次评估成本    | 频率        | 月度成本          |
|---|---|---|---|
| 程序化检查                                       | <$0.10          | 每 PR       | <$10              |
| LLM-judge（200 case × $0.005）                   | $1              | 每 PR       | ~$60              |
| 人工校准（30 case × $5）                         | $150            | 每季度      | $50               |

相对于"上线前抓住一次回归省下来的工程师时间"，这都是误差级别的钱。不跑评估的团队躲掉的不是这每月 $60 的账单——他们躲掉的是"建 golden set 这件事"的纪律。

下一节: [LLM 作为评判者 →](./llm-as-judge)
