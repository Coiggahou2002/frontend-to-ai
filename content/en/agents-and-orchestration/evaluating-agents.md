# 8. Evaluating Agents

For chat completions ([Chapter 0 §6](../how-llms-work/sampling)) the eval problem is already hard: same input, different outputs. For agents it's harder, because the *output* is no longer a string — it's a **trajectory**. A sequence of (model thoughts, tool calls, tool results, more thoughts, …) ending in some final state.

You can't snapshot-test a trajectory. You can't equality-assert it. You evaluate it across three metric families.

## The three metric families

| Family | What it measures | Example metrics |
|---|---|---|
| Task success rate | Did the agent reach the expected outcome? | Binary success; graded score; LLM-judge correctness |
| Trajectory quality | Did the agent take a reasonable path? | Tool-call count; redundant-call rate; oscillation incidents; cost per task |
| Budget compliance | Did it stay under the ceilings from [§6](./safety-budgets)? | p95 iterations; p95 cost; p95 wall time; timeout rate |

Real agent eval reports all three. Success rate alone is misleading — an agent that succeeds 95% of the time but burns $5 per task is worse than one that succeeds 92% of the time at $0.20. Trajectory quality and budget compliance are what tell you which one is actually shippable.

## Task success rate

Build a labeled set: 30–100 tuples of `(goal, expected_outcome, allowed_tools, max_cost)`. Each row is a real-shape user goal plus a verifiable success criterion.

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

Run the agent on every case for every prompt change, every model change, every tool-schema change. The results are a CSV / JSONL of `(case_id, success, iterations, tool_calls, cost_usd, wall_time_s, trajectory)` — one row per (commit × case).

For grading **success**:

- **Programmatic when possible.** "Did the agent call `submit_findings` with `ticket_id=42`?" — check the tool log. Cheap, deterministic, ideal.
- **LLM-judge when not.** Many tasks have multiple valid outcomes ("Did the agent's final answer correctly explain on-call rotation?"). Use a separate LLM call as a judge with a rubric (next section).

Don't graduate to LLM-judge until programmatic checks have run out — judges are more expensive, slower, and themselves a source of variance.

## Trajectory quality

Often more diagnostic than success rate alone. An agent can solve the task but take six unnecessary detours. Useful per-trajectory metrics:

- **Tool-call count.** How many calls before resolution?
- **Redundant-call rate.** How many calls were near-duplicates (same tool, near-identical args)? Rising = oscillation drift.
- **Tool diversity.** Distinct tools used / total tool calls. Low diversity on tasks that should need multiple tools = the agent missed a step.
- **Average iteration cost.** Per-iteration token spend, normalized for transcript length. Spikes mean prefix caching ([Chapter 7](../kv-cache)) regressed or the transcript blew up.
- **First-iteration tool match rate.** Did the agent call the *right* tool first? Direct measure of tool-description quality ([§2 rule 1](./tool-design)).

Track each metric per (case, agent_version). Regressions on any of them point at distinct things, which is the whole reason you split them out:

| Metric regression | Likely cause |
|---|---|
| Success rate ↓, all else flat | Model regression or prompt change broke something |
| Tool-call count ↑, success rate flat | Model is exploring more — usually a prompt change made the goal less specific |
| Redundant-call rate ↑ | Self-correction prompt is missing or wrong; oscillation creeping in |
| First-iteration tool match ↓ | Tool descriptions got worse, or you added a confusing tool |
| Avg cost ↑↑, success flat | Prefix caching broke (system prompt is no longer stable) |

## LLM-as-judge for trajectory grading

For graded tasks (the rubric kind, not the programmatic kind), feed a judge model the trajectory plus the goal plus an explicit rubric.

A minimal rubric prompt:

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

Force the JSON via tool_choice ([Chapter 2 §5](../llm-apis-and-prompts/structured-output)). Aggregate scores across cases and watch them over time.

Two cautions on LLM judges, true for all eval not just agents:

- **Calibrate against humans.** On a sample of 30 trajectories, have a human label them and compare to the judge. If they disagree more than ~15% of the time, the rubric is too vague — refine it before trusting the judge at scale.
- **The judge has biases.** It tends to favor longer, more verbose responses, agents that "show their work," and outcomes phrased in the model's own style. Be aware; don't pretend the judge is impartial.

## Budget compliance

Track the [§6](./safety-budgets) ceilings in aggregate, not just per-run:

- p50 / p95 iterations per task.
- p50 / p95 cost per task.
- p95 wall time per task.
- Timeout rate (per-tool and overall).
- Human-approval grant rate (when you ship that pattern).

You want **p95 well below the ceiling**, not p95 *at* the ceiling. If p95 iterations is 11 with `max_iterations = 12`, you don't have a working budget — you have a 5%-of-traffic disaster surface.

## Regression sets are the canary

The labeled set isn't a one-time thing. It's a **regression set**: rerun on every prompt tweak, every system-prompt change, every model version, every tool-schema change. The metrics you tracked yesterday compare against the metrics you measure today. A drop in success rate, or a rise in cost or oscillation, is the canary that the latest change broke something.

Two practical disciplines:

- **Run the regression set in CI.** A nightly job (or on PRs that touch prompts/tools) that runs all 50–100 cases and posts a diff vs. the last main-branch result. Cheap with caching; you've now caught 80% of regressions before they ship.
- **Version everything.** The labeled set, the rubric, the prompt, the tool schemas — all under git, all tagged when you cut a release. "What did this agent look like on March 14" needs to be a reproducible question, not a forensic exercise.

Eval isn't just for "is the agent good" — it's the only mechanism that lets you change anything safely. Without it, every prompt edit is a roll of the dice.

## Forward link: Chapter 11

Agent eval is a special case of LLM eval. The same disciplines (labeled sets, judge calibration, regression tracking, distribution-level metrics over equality assertions) apply to chat completions, RAG, classifiers, and everything else that produces non-deterministic outputs. **Chapter 11 (Evaluation and Observability)** goes much deeper: golden sets, A/B testing, online vs. offline eval, drift detection, and how to operationalize all of this on a real engineering team.

---

Next, the hardware reality for self-hosting any of this — [Chapter 5](../gpu-and-model-sizing).
