# 8. Agent 评估

对 chat completion 来说（[第 0 章 §6](../how-llms-work/sampling)），评估问题已经很难：同样的输入、不一样的输出。对 agent 来说更难，因为**输出**不再是一个字符串——它是一条**轨迹（trajectory）**：(模型思考、工具调用、工具结果、再思考……) 的序列，最后停在某个状态上。

你不能对一条轨迹做快照测试，也不能做相等断言。你要在三组指标家族上去评估它。

## 三组指标家族

| 家族 | 衡量的是什么 | 示例指标 |
|---|---|---|
| 任务成功率 | Agent 有没有达成预期结果？ | 二元成功；分级打分；LLM 裁判正确性 |
| 轨迹质量 | Agent 走的是不是一条合理路径？ | 工具调用次数；冗余调用率；震荡发生次数；单任务成本 |
| 预算合规 | 有没有压在 [§6](./safety-budgets) 的上限内？ | p95 迭代次数；p95 成本；p95 wall time；超时率 |

真正的 agent 评估这三类都要报。只看成功率会误导——一个 95% 成功率但每个任务烧 $5 的 agent，比一个 92% 成功率每个任务 $0.20 的 agent 更糟。轨迹质量和预算合规才告诉你哪一个真能上线。

## 任务成功率

建一个标注集：30–100 个 `(goal, expected_outcome, allowed_tools, max_cost)` 元组。每一行是一个真实形态的用户目标，加一个可验证的成功标准。

```python
from pydantic import BaseModel
from typing import Optional

class EvalCase(BaseModel):
    id: str
    goal: str                          # what the user asks
    expected_outcome: str              # natural-language description of "success"
    allowed_tools: list[str]           # tools this case is allowed to use
    max_cost_usd: float = 0.50
    max_iterations: int = 10
    rubric: Optional[str] = None       # for LLM-as-judge grading
```

每次 prompt 改动、每次模型升级、每次工具 schema 改动，都把 agent 在每个 case 上跑一遍。结果是一份 CSV / JSONL，每行 `(case_id, success, iterations, tool_calls, cost_usd, wall_time_s, trajectory)`——每个 (commit × case) 一行。

打**成功**这个分：

- **能用程序判就用程序判。** "Agent 有没有调用 `submit_findings` 且 `ticket_id=42`？"——查工具日志。便宜、确定性、理想。
- **判不了就用 LLM-judge。** 很多任务有多种合法结果（"Agent 给出的最终答案有没有正确解释 on-call 轮值？"）。用一次单独的 LLM 调用作为带 rubric 的裁判（下一节）。

只有在程序判用尽之后才升级到 LLM-judge——裁判更贵、更慢、本身也是一个方差源。

## 轨迹质量

经常比成功率本身更有诊断价值。Agent 可能解决了任务，但走了六段不必要的弯路。有用的单轨迹指标：

- **工具调用次数。** 解决之前调了几次？
- **冗余调用率。** 有多少调用是近重复（同工具、参数几乎一样）？升 = 震荡飘移。
- **工具多样性。** 用过的不同工具数 / 总工具调用数。本应需要多个工具的任务上多样性低 = agent 漏了一步。
- **单轮平均成本。** 单次迭代 token 花费，按对话记录长度归一化。出现尖峰意味着 prefix caching（[第 9 章](../kv-cache)）回归了，或者对话记录炸了。
- **首轮工具命中率。** Agent 第一轮有没有调**对**工具？这是工具描述质量（[§2 规则 1](./tool-design)）的直接度量。

按 (case, agent_version) 跟踪每个指标。任何一个回归都指向不一样的东西，这就是为什么你要把它们拆开：

| 指标回归 | 大概的原因 |
|---|---|
| 成功率 ↓，其他平 | 模型回归或 prompt 改动弄坏了什么 |
| 工具调用次数 ↑，成功率平 | 模型在多探索——通常是 prompt 改动让目标变得不那么具体了 |
| 冗余调用率 ↑ | 自我纠错 prompt 缺了或写错了；震荡渗进来了 |
| 首轮工具命中率 ↓ | 工具描述变差了，或者你加了一个会让模型混淆的工具 |
| 平均成本 ↑↑，成功率平 | prefix caching 坏了（系统提示词不再稳定） |

## 用 LLM-as-judge 给轨迹打分

对需要打分的任务（rubric 那种、不是程序判的那种），把轨迹 + 目标 + 一份明确的 rubric 喂给一个裁判模型。

一个最小的 rubric prompt：

```text
You are an evaluator for an AI agent. Given a user goal, the agent's trajectory
(sequence of tool calls, results, and assistant text), and a rubric, rate the
trajectory on each rubric dimension (1-5) and give a one-sentence justification.

Goal:
{goal}

Trajectory:
{trajectory}

Rubric:
1. Correctness: Did the final answer correctly address the goal?
2. Tool selection: Did the agent use the cheapest sufficient tool at each step?
3. No loops: Did the agent avoid repeating the same tool with similar args?
4. Conciseness: Did the agent stop as soon as it had enough information?

Output JSON:
{
  "correctness":   {"score": 1-5, "why": "..."},
  "tool_selection":{"score": 1-5, "why": "..."},
  "no_loops":      {"score": 1-5, "why": "..."},
  "conciseness":   {"score": 1-5, "why": "..."}
}
```

通过 tool_choice（[第 2 章 §5](../llm-apis-and-prompts/structured-output)）强制输出 JSON。把分数跨 case 聚合，按时间观察。

LLM 裁判有两个要小心的点，对所有评估都成立、不只对 agent：

- **要跟人对齐校准。** 取 30 条轨迹的样本，让人去标，再跟裁判对比。如果分歧超过 ~15%，rubric 就太含糊了——先 refine 它再大规模信任裁判。
- **裁判有偏见。** 它倾向偏爱更长、更啰嗦的回答，"展示思考过程"的 agent，以及用模型自己风格表达的结果。心里有数；别假装裁判是中立的。

## 预算合规

把 [§6](./safety-budgets) 的上限做聚合跟踪，不只是看单次：

- 每任务的 p50 / p95 迭代次数。
- 每任务的 p50 / p95 成本。
- 每任务的 p95 wall time。
- 超时率（单工具和整体）。
- 人审通过率（在你上线那个模式之后）。

你想看到的是 **p95 远低于上限**，不是 p95 **就**贴在上限上。如果 `max_iterations = 12` 且 p95 迭代次数是 11，那你没有一个起作用的预算——你有的是一个对 5% 流量打开的灾难面。

## 回归集是哨兵

标注集不是一次性的。它是一份**回归集**：每次 prompt 微调、每次系统提示词改动、每次模型版本升级、每次工具 schema 改动都重跑一遍。今天你跟踪的指标，跟昨天的对比。成功率掉、成本或震荡涨——就是哨兵，告诉你最近的改动弄坏了什么。

两条实操纪律：

- **把回归集放进 CI 跑。** 每晚一次 job（或者在动到 prompt / 工具的 PR 上），跑完全部 50–100 个 case，给出一份跟上一次 main 分支结果的 diff。开了缓存之后很便宜；你已经在上线之前接住了 80% 的回归。
- **所有东西都做版本管理。** 标注集、rubric、prompt、工具 schema——全部进 git，每次发布打 tag。"3 月 14 号这个 agent 长什么样"应该是一个可复现的问题，不是一次取证。

评估不只是为了"agent 好不好"——它是让你能安全改动任何东西的唯一机制。没有它，每次改 prompt 都是掷骰子。

## 前向链接：第 13 章

Agent 评估是 LLM 评估的一个特例。同样的纪律（标注集、裁判校准、回归跟踪、用分布层级指标替代相等断言）适用于 chat completion、RAG、分类器，以及一切产生非确定性输出的东西。**第 13 章（评估与可观测性）**会深入更多：golden set、A/B 测试、在线 vs. 离线评估、漂移检测，以及怎么在真实工程团队里把这一切落地运营。

---

接下来，让这一切持久化的数据层——[第 5 章](../backend-and-data)。
