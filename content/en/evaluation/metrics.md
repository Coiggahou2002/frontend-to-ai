# 3. Metrics

Once you have a golden set, the next question is what to measure on each case. Metrics fall into three categories, in increasing order of cost and decreasing order of signal certainty:

| Category | Cost per case | Signal certainty | Reproducible? | When to use |
|---|---|---|---|---|
| Programmatic | ~free | High on what it measures | Yes | Whenever the answer can be checked mechanically |
| Model-graded (LLM-as-judge) | $0.001–$0.01 | Medium; needs calibration | Approximately | Open-ended outputs without a single right answer |
| Human-graded | $1–$10 | Highest | Yes | Ground truth, rubric calibration, regulated products |

**Use programmatic whenever you can. Climb the ladder only when the cheaper rung runs out.** Most teams over-rely on LLM-judge because programmatic checks feel beneath them. They aren't. They're cheaper, faster, and more reliable on the parts of the answer they can check.

## Category 1: Programmatic

These are deterministic checks on the output. Cheap, fast, no judge bias, perfectly reproducible. Examples:

- **Exact match.** The answer string equals the gold string. Useful for classification labels, intent routing, multiple choice.
- **JSON schema validation.** The output parses and matches a Pydantic / JSON Schema. Use the structured-output validators from [Ch 2 §5](../llm-apis-and-prompts/structured-output).
- **Field-level equality.** Specific fields match (e.g. `extracted.amount == 42.50`); free-text fields graded separately.
- **Regex match.** Output matches a pattern. Useful for format constraints (dates, phone numbers, citation tags).
- **Set equality / Jaccard.** For multi-label outputs.
- **Numeric tolerance.** `abs(predicted - gold) < 0.05`. For extracted numbers.
- **Latency budget.** `total_latency_ms < 2000`. A real metric — a system that's correct but unusable is broken.
- **Token count budget.** `output_tokens < 500`. Verbosity is a real failure mode.
- **Cost budget.** `cost_usd_per_call < 0.05`.
- **Tool-call check.** "Did the agent call `submit_order` with `qty=3`?" — check the tool log.
- **Citation correctness.** "Does `answer.sources` only contain IDs from the retrieved chunks?" ([Ch 3 §7](../embeddings-and-rag/evaluating-rag)).
- **Forbidden content.** None of `must_not_say` appears in the output.

A complete programmatic metric example:

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

Aggregate across the set: pass-rate per check. If `schema_valid` drops from 0.99 to 0.92 between two prompt versions, you have a regression and you don't need a judge to tell you.

## Category 2: Model-graded (LLM-as-Judge)

When the output is open-ended — a summary, an explanation, a chat reply — programmatic checks can verify *parts* of it (must-say facts, schema, citations) but can't grade overall quality. That's where a judge model comes in.

Full treatment in [§4](./llm-as-judge). The short version: a separate LLM call evaluates the output of the system-under-test against a rubric, returning a structured verdict.

Cost order of magnitude: 500 cases × $0.005 per judge call ≈ $2.50 per eval run. Cheap relative to engineering time.

Use LLM-judge for:

- Faithfulness in RAG ("does the answer only contain claims supported by the chunks?").
- Tone / style ("does this match our brand voice?").
- Helpfulness ("did the answer actually address the user's question?").
- Completeness ("did the agent's final report cover all the requested sections?").
- Pairwise comparison ("is response A better than response B?").

Don't use LLM-judge for:

- Anything programmatic checks can do. Use those first.
- Mathematical / factual correctness on inputs the judge itself isn't reliable on. (A judge model can't grade an answer about something it doesn't know either.)
- Final ground truth. The judge is *a* signal, not *the* signal. Calibrate against humans, [§4](./llm-as-judge).

## Category 3: Human-graded

Slow, expensive, and the only true ground truth. Use sparingly:

- **To calibrate the judge.** 30–50 cases, two human raters, compare to judge verdicts. If agreement is below ~85%, fix the rubric.
- **For final acceptance** of a regulated or high-stakes feature.
- **For rubric design.** Have humans grade 20 cases freehand, then read the disagreements and crystallize the rubric from where they argued.

Don't put humans in the inner loop of CI. They scale linearly with cost; eval has to scale with code changes. Humans are for calibration, not for production.

## Picking a metric per task type

| Task | Primary metric | Secondary | Notes |
|---|---|---|---|
| Classification | Accuracy, F1 | Confusion matrix | Programmatic only. |
| Extraction (JSON) | Schema valid + field-level equality | Semantic eq. on free-text fields | Don't penalize "$5,000.00" vs "$5000". |
| RAG retrieval | Recall@k, MRR | NDCG | Per [Ch 3 §7](../embeddings-and-rag/evaluating-rag). |
| RAG generation | Faithfulness (judge) | Citation correctness, must-say facts | Hybrid is the rule. |
| Chat / writing | LLM-judge on rubric | Length, tone (judge) | Calibrate to humans. |
| Agent task completion | Programmatic outcome check | Trajectory rubric (judge) | Per [Ch 4 §8](../agents-and-orchestration/evaluating-agents). |
| Tool-use arg extraction | Tool-call exact match on key args | Tool-call count | Programmatic only. |
| Refusal calibration | Refusal rate on adversarial slice + benign slice | Both | False-positive refusals are a real bug. |
| Fine-tune comparison | Same metrics, run on held-out | Win-rate (pairwise judge) vs. base model | Per [Ch 9](../fine-tuning). |

The overlap between rows is the point. **Build several lightweight metrics, not one heavy one.** They correlate but disagree at the margins, and the margins are where the bugs are.

## A common pitfall: the single-number trap

Teams reduce eval to one number ("score: 0.83") and watch it like a stock price. Don't. The single number hides which slice regressed.

Always slice. At minimum, report metrics per category and per difficulty:

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

A 5% overall regression that's actually a 30% regression on the "billing" slice is hidden by the average. A regression on the "adversarial" slice (injection success climbed from 1% to 6%) is the kind of thing you ship to production and read about on Twitter.

## Calibration is non-negotiable

Every model-graded metric needs periodic comparison against human grades. If they disagree more than ~15% of the time, the rubric is too vague (echoing [Ch 4 §8](../agents-and-orchestration/evaluating-agents)).

A workflow:

1. Sample 30 cases at random from this week's eval run.
2. Have two humans grade each one independently.
3. Where humans agree with each other, compare to the judge.
4. Where the judge disagrees with humans, read why. Either the rubric was ambiguous (rewrite the rubric) or the judge model has a known bias (counter it; [§4](./llm-as-judge)).

Calibration shifts when you change the rubric, the judge model, or the system you're judging. Re-calibrate quarterly, or after any of those changes.

## Cost vs. signal: where to spend

A rough budget for a typical chat product with 200 cases in the golden set:

| Layer | Cost per eval pass | Frequency | Monthly cost |
|---|---|---|---|
| Programmatic checks | <$0.10 | Every PR | <$10 |
| LLM-judge (200 cases × $0.005) | $1 | Every PR | ~$60 |
| Human calibration (30 cases × $5) | $150 | Quarterly | $50 |

This is rounding-error money relative to the engineering time saved by catching one regression before it ships. The teams that don't run eval aren't avoiding a $60/month bill — they're avoiding the discipline of building the golden set.

Next: [LLM-as-Judge →](./llm-as-judge)
