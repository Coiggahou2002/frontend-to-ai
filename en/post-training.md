# From Pre-Training to Production: A Complete Guide to LLM Post-Training

May 2, 2026

> Principles and practice of SFT, RLHF, DPO, and GRPO

---

You've probably seen this before: a pre-trained language model with hundreds of billions of parameters, and when you ask it "help me write an out-of-office email," it responds with a Wikipedia-style explainer about what leave policies are. It has astonishing language ability, but it doesn't know you're talking to it.

This is the awkward reality of pre-trained models -- they learn the statistical patterns of language, but they never learn how to "be a good assistant." From GPT-3 to ChatGPT, the model parameters didn't increase, but the user experience changed fundamentally. The key to that transformation is **Post-Training**.

Post-training is not a nice-to-have. It's a systematic engineering process that turns "raw capability" into "usable product," encompassing Supervised Fine-Tuning, Preference Optimization, Capability Enhancement, and Safety Alignment. Once you understand this system, you'll see why the same base model can produce wildly different results depending on who trains it.

This tutorial walks you through the core post-training path: from the basics of SFT, to the classic RLHF, to the lighter-weight DPO and cutting-edge GRPO, and finally to the practical dimensions of data, safety, and evaluation. Each chapter solves a specific problem, and by the end you'll be able to choose the right post-training approach for your own project.

---

## Chapter 1: The Post-Training Landscape -- From Pre-Training to Deployment at a Glance

### 1.1 Definition and Boundaries of Post-Training

Post-training refers to all techniques that give a model specific capabilities through additional training steps after pre-training is complete. Pre-training teaches the model "what language is"; post-training teaches it "how to use language."

A common misconception is equating post-training with "fine-tuning." In reality, fine-tuning is just a subset of post-training. Modern post-training is a multi-stage, composable technology stack where different stages solve different problems.

### 1.2 The Four-Stage Modular Stack

The industry's post-training pipeline has matured into a relatively standard modular architecture:

| Stage | Goal | Typical Methods | Problem Solved |
| --- | --- | --- | --- |
| Supervised Fine-Tuning (SFT) | Instruction following | Instruction data + supervised training | Model can't hold conversations or follow formats |
| Preference Optimization | Value alignment | RLHF / DPO / KTO | Inconsistent response quality, misaligned with human preferences |
| Capability Enhancement | Reasoning & planning | GRPO / RLVR | Weak at deep thinking, fragile reasoning chains |
| Safety Alignment | Harmlessness & controllability | Red-teaming + safety RLHF + rule constraints | Model may generate harmful, false, or biased content |

These four stages don't all need to be executed, nor do they have to follow a strict order. A lightweight chat assistant might only need SFT + DPO; a reasoning model might need SFT + GRPO + Safety Alignment. Which modules to pick and how to combine them depends on your goals.

### 1.3 Why Post-Training Determines the Final User Experience

InstructGPT's experiments produced a stunning number: a post-trained 1.3B parameter model outperformed the un-post-trained 175B parameter GPT-3 in human evaluations. This shows that the marginal returns of post-training far exceed simply scaling up pre-training.

By 2025-2026, the industry consensus has shifted from "who has the bigger model" to "who has better post-training." DeepSeek-R1 used GRPO to train reasoning capabilities approaching o1-level, and Meta's Llama series has focused core improvements on post-training in every generation.

> **Checkpoint**: Can you name what problem each of the four post-training stages solves? If not, go back and review the table in Section 1.2.

---

## Chapter 2: Supervised Fine-Tuning (SFT) -- Teaching the Model to Talk Like a Human

### 2.1 The Critical Leap from "Completion" to "Conversation"

At its core, a pre-trained model is a text completion engine: given a prefix, predict the next token. It doesn't know it's an assistant, and it doesn't understand that "a user is asking a question."

SFT's core idea is simple: train the model on a set of "good conversation examples" so it learns conversational patterns. These examples are typically in instruction-input-output triplet form:

```
Instruction: Please translate the following English into Chinese
Input: The quick brown fox jumps over the lazy dog.
Output: 敏捷的棕色狐狸跳过了那只懒狗。
```

The training objective is the same next-token prediction as pre-training, but the training data shifts from unlabeled web text to carefully constructed instruction-response pairs.

### 2.2 Preparing SFT Data

Data quality almost single-handedly determines the ceiling of this stage. IBM Research's empirical study at NeurIPS 2025 showed that using fewer but higher-quality data points (a 14% reduction) can match or even exceed the performance of larger datasets.

Key data quality dimensions include:

- **Accuracy**: Responses must be factually correct, avoiding hallucinations
- **Diversity**: Coverage across multiple task types (Q&A, translation, summarization, code, reasoning, etc.)
- **Complexity gradient**: A mix from simple to complex, avoiding an all-easy-tasks dataset
- **Format consistency**: Unified conversation templates so the model learns structured output

### 2.3 Rules of Thumb in Training Practice

SFT training is much lighter than pre-training, but there are still a few key parameters:

| Parameter | Common Range | Notes |
| --- | --- | --- |
| Dataset size | 10K - 100K samples | Quality matters far more than quantity |
| Learning rate | 1e-5 to 5e-5 | Too high causes forgetting; too low converges slowly |
| Training epochs | 1-3 epochs | More epochs risk overfitting |
| Batch size | Adjust to fit GPU memory | Gradient accumulation can simulate larger batches |

### 2.4 Common SFT Pitfalls

**Catastrophic Forgetting**: Over-training causes the model to lose the general capabilities learned during pre-training. The InstructGPT paper uses PPO-ptx (mixing in a portion of pre-training data) to mitigate this.

**Format Lock-in**: If all training data follows a single rigid format, the model becomes unable to answer in any other way, losing flexibility.

**Overfitting to Surface Patterns**: The model may learn patterns that "look like good answers" (e.g., always starting with "Sure, let me help you with that"), while the actual content quality doesn't improve.

> **Checkpoint**: If you only had 5,000 high-quality data points and 50,000 mediocre-quality data points, which would you choose? Why?

---

## Chapter 3: RLHF -- Training Models with Human Preferences

### 3.1 The Ceiling of SFT

SFT can teach a model to converse, but it has a fundamental limitation: for the same question, there may be multiple answers of varying quality, and SFT can only teach the model to imitate the "example answer" -- it can't tell the model "this answer is better than that one."

RLHF (Reinforcement Learning from Human Feedback) introduces the dimension of "comparison" -- rather than showing the model the correct answer, human annotators rank multiple responses, and reinforcement learning trains the model to generate responses that "humans prefer."

### 3.2 InstructGPT's Three-Stage Method

OpenAI's 2022 InstructGPT paper established the industrial foundation for RLHF. Its three-stage pipeline remains the best starting point for understanding post-training:

**Stage 1: SFT**. Fine-tune GPT-3 with approximately 13,000 human-written, high-quality instruction-response data points.

**Stage 2: Train a Reward Model (RM)**. Have the model generate multiple responses to the same question, then have human annotators rank them. Use the ranking data to train a reward model whose output is a scalar score representing "how good this answer is."

**Stage 3: PPO Optimization**. Treat the reward model as the "environment" and use PPO (Proximal Policy Optimization) to make the language model generate higher-reward responses. A KL divergence penalty prevents the model from drifting too far.

### 3.3 The Core Mechanism of PPO

PPO is the most commonly used reinforcement learning algorithm in RLHF. Its core idea is "small-step updates": each time the policy is updated, the gap between the old and new policies is constrained to avoid catastrophic large shifts.

PPO-CLIP's objective function achieves this by clipping the probability ratio: when the new policy's change relative to the old policy exceeds a threshold (typically epsilon=0.2), the gradient is truncated. This makes the training process much more stable.

### 3.4 Engineering Challenges of RLHF

RLHF is elegant in theory but extremely difficult in engineering practice:

- **Multiple models running simultaneously**: The language model, reward model, reference model, and value network demand massive GPU memory
- **Training instability**: Biases in the reward model get amplified by the RL process, leading to "Reward Hacking" -- the model finds high-reward but low-quality shortcuts
- **Hyperparameter sensitivity**: KL penalty coefficient, learning rate, sampling temperature, and other parameters require careful tuning
- **High annotation costs**: High-quality preference ranking data requires trained annotators

These challenges gave rise to simpler methods, like DPO.

> **Checkpoint**: What is the role of the reward model? What happens if the reward model itself is inaccurate?

---

## Chapter 4: DPO and Its Variants -- Simpler Preference Learning

### 4.1 The Core Intuition Behind DPO

In 2023, Rafailov et al. proposed a key insight: **the language model itself is an implicit reward model**. You don't need to train a separate reward model and then optimize with RL -- you can train the language model directly on preference data.

DPO's mathematical derivation starts from RLHF's optimal policy and, through variable substitution, arrives at a closed-form solution. The final training objective becomes a simple classification loss: given a pair of "good answer" and "bad answer," increase the probability of the good answer and decrease the probability of the bad answer.

### 4.2 RLHF vs. DPO Pipeline Comparison

| Dimension | RLHF (PPO) | DPO |
| --- | --- | --- |
| Training pipeline | SFT -> RM -> PPO | SFT -> DPO |
| Models required | 4 (policy, reward, reference, value network) | 2 (policy, reference) |
| Data type | Ranking data + online sampling | Offline paired preference data |
| Training stability | Unstable, requires extensive tuning | Relatively stable |
| Compute cost | High | Moderate |
| Online exploration | Yes (via sampling new responses) | No (static data only) |

DPO's greatest advantage is simplification: no reward model to train, no complex RL loop -- a standard training loop is all you need for preference optimization.

### 4.3 Limitations of DPO

DPO is not a perfect replacement for RLHF:

- **Distribution sensitivity**: DPO uses offline data; if the training data distribution diverges significantly from the model's current policy, effectiveness degrades
- **Overfitting risk**: Easy to overfit on small datasets, especially when the "bad answers" aren't actually that bad
- **Lack of online exploration**: PPO can sample new responses during training and get feedback; DPO can only learn from static data

### 4.4 The DPO Variant Family

DPO's elegant framework spawned a series of variants, each addressing specific pain points:

| Method | Core Improvement | Use Case |
| --- | --- | --- |
| IPO | Replaces sigmoid with MSE loss for robustness | Noisy preference data; bad answers aren't very bad |
| KTO | Supports unpaired data (only "good/bad" labels needed) | Hard to obtain paired preference data |
| SimPO | Removes reference model; uses length-normalized log probability | Limited GPU memory; efficiency-focused |
| ORPO | Merges SFT and preference optimization into one step | Reducing training stages |

### 4.5 Selection Guidance

A practical selection framework: when you have ample compute and online sampling capability, PPO/GRPO typically perform better; when resources are limited and simplicity is paramount, DPO or SimPO are reasonable choices; when you only have unpaired data, KTO is the only option.

> **Checkpoint**: If you have paired preference data but limited GPU resources, would you choose RLHF or DPO? Why?

---

## Chapter 5: GRPO and Reasoning Enhancement -- Teaching Models to Think Deeply

### 5.1 Starting with DeepSeek-R1

In early 2025, DeepSeek released its R1 model and demonstrated a stunning finding: through pure RL training (without human-written reasoning examples), a model can spontaneously develop Chain-of-Thought capabilities. The core algorithm behind this is GRPO.

### 5.2 GRPO's Core Innovation

GRPO (Group Relative Policy Optimization) was first proposed in the DeepSeekMath paper. It makes a key simplification to PPO: **remove the value network (critic) and use group-relative comparisons to estimate the advantage function**.

Specifically, for each input question, GRPO has the model generate a group of responses (typically 64), then scores each response using a reward function (or verifier). Each response's advantage value is not absolute but relative to the group's average:

```
advantage_i = (reward_i - group_mean) / group_std
```

This design has two benefits: first, it completely eliminates the value network, saving massive GPU memory; second, the within-group normalization provides a natural baseline, reducing gradient variance.

### 5.3 RLVR: Replacing Humans with Verifiers

GRPO's most powerful application scenario is **RLVR (Reinforcement Learning with Verifiable Rewards)**. For math and code tasks, you don't need humans to judge whether an answer is good -- unit tests, proof checkers, or math verifiers can provide entirely objective reward signals.

This allows training to proceed fully online: model generates response -> verifier scores it -> policy updates -> model generates new response, and the cycle repeats. DeepSeek-R1 used exactly this approach to achieve rapid improvement on math and code reasoning tasks.

### 5.4 DAPO: Solving Reasoning Training Instability

At large scale, GRPO still faces stability issues in reasoning training. ByteDance's DAPO addresses this through four techniques:

1. **Preventing entropy collapse**: Stopping model outputs from becoming overly deterministic and losing exploration ability
2. **Dynamic batch filtering**: Discarding uninformative training samples
3. **Token-level gradient computation**: Finer-grained gradient signals than sequence-level
4. **Length reward adjustment**: Preventing the model from learning to "write longer answers for higher rewards"

### 5.5 The Boundaries of Reasoning Enhancement

RLVR's effectiveness is remarkable on tasks with verifiers, but it has clear applicability boundaries:

- **Well-suited**: Mathematical reasoning, code generation, formal proofs, structured output
- **Less suited**: Open-ended writing, creative tasks, subjective Q&A
- **Under exploration**: Multi-step planning, tool use, agent behavior

> **Checkpoint**: What is the biggest difference between GRPO and PPO? Why is RLVR particularly well-suited for math and code tasks?

---

## Chapter 6: Data Engineering -- The Deciding Factor in Post-Training

### 6.1 Quality Over Quantity

This is perhaps one of the most counter-intuitive findings in post-training: **fewer but better data points often outperform more but mixed-quality data**.

IBM Research conducted a detailed quality audit of two mainstream open-source post-training datasets (Tulu-3-SFT-Mix and SmolTalk), designed a data mixing recipe (TuluTalk), and with 14% fewer samples than either original dataset, matched or exceeded their performance on key benchmarks.

### 6.2 Quality Dimensions for SFT Data

Building a high-quality SFT dataset requires attention to the following dimensions:

| Dimension | Description | Common Issues |
| --- | --- | --- |
| Accuracy | Factually correct, no hallucinations | GPT-generated data may contain errors |
| Diversity | Coverage across multiple tasks and domains | Dataset biased toward certain task types |
| Complexity | Includes different difficulty levels | All simple Q&A, lacking deep reasoning |
| Response quality | Detailed, structured, helpful | Responses too short or lacking explanation |
| Safety | Contains no harmful content | Unfiltered web data |

### 6.3 Collecting Preference Data

Preference data (for RLHF/DPO) comes from two main sources:

**Human annotation**: Have annotators rank the model's multiple responses. The advantage is controllable quality; the drawback is high cost and slow speed. InstructGPT's annotation team required specialized training.

**Synthetic generation**: Use a stronger model (like GPT-4) to judge response quality, or have the model itself generate positive and negative examples. Tools like HuggingFace's Distilabel support large-scale synthetic data generation.

### 6.4 Synthetic Data Methods and Risks

Synthetic data is becoming mainstream, but several risks demand vigilance:

- **Model collapse**: If a model only learns from its own generated data, it may gradually lose diversity
- **Hallucination amplification**: Errors in synthetic data get reinforced during training
- **Homogenization**: All models distilling from the same strong model leads to reduced ecosystem diversity

SPIN (Self-Play Improvement) improves the model by having it distinguish its own outputs from human outputs. SPICE mitigates hallucination by introducing external documents into the self-play process.

### 6.5 Practical Data Recipe Recommendations

A reference data mixing strategy:

1. **Foundation layer**: High-quality human data covering core task types (30-40%)
2. **Expansion layer**: Synthetic data for diversity and scale (40-50%)
3. **Calibration layer**: Targeted data for weak areas (10-20%)
4. **Deduplication & filtering**: Remove duplicates, low-quality, and harmful samples

> **Checkpoint**: Why can "fewer but better data" outperform "more but mediocre data"? Try explaining from the perspectives of overfitting and noise.

---

## Chapter 7: Alignment and Safety -- Making Models Both Useful and Safe

### 7.1 The Tension Between Safety and Usefulness

One of the most difficult problems in post-training is finding the balance between "safe" and "useful."

On one extreme is over-refusal: the model says "I can't answer that" to any sensitive topic, even when the question is a legitimate medical consultation or security research discussion. On the other extreme is over-compliance: the model readily fulfills harmful requests, becoming a tool for generating malicious content.

Good alignment isn't simply teaching the model to refuse -- it's enabling the model to **assess intent, evaluate risk, and choose an appropriate response strategy**.

### 7.2 Main Safety Alignment Methods

| Method | Principle | Advantage | Limitation |
| --- | --- | --- | --- |
| Safety SFT | Fine-tune with safe conversation examples | Simple and direct | Prone to over-refusal |
| Safety RLHF | Add safety dimension to preferences | Flexible, enables multi-objective optimization | High annotation cost |
| Constitutional AI | Use rules for model self-review and correction | Scalable, reduces human annotation | Rule design is difficult |
| Red-teaming | Proactively find model safety vulnerabilities | Discovers real risks | Can only find known attack patterns |
| MOSAIC framework | "Plan-Check-Act or Refuse" workflow | Structured decisions, suited for agent scenarios | Increases inference overhead |

### 7.3 The Fragility of Shallow Safety Alignment

Recent research has revealed a disturbing fact: many safety alignment techniques only affect the first few tokens of a model's output, while deeper in the generation, the model may still drift toward unsafe directions. This is why "jailbreak" attacks can bypass safety mechanisms -- they essentially trick the model into skipping the initial tokens where it learned to "refuse."

DPO also has limitations for safety alignment: its loss function is not optimal for the task of "learning to refuse," because it optimizes pairwise comparisons rather than absolute safety standards.

### 7.4 Multi-Objective Optimization in Practice

Modern safety alignment must simultaneously pursue multiple objectives: helpful, harmless, and honest. In practice, a layered strategy is typically adopted:

1. **Foundation layer**: Establish basic safe behavior patterns through SFT
2. **Optimization layer**: Balance usefulness and safety through multi-objective RLHF/DPO
3. **Defense layer**: Build runtime guardrails through red-teaming, input filtering, and output review
4. **Monitoring layer**: Continuously monitor for anomalous patterns after deployment, iterating on improvements

> **Checkpoint**: Why can jailbreak attacks succeed? What does this imply for the choice of safety alignment methods?

---

## Chapter 8: Evaluation and Method Selection -- A Methodology for Judging Post-Training Effectiveness

### 8.1 Why Evaluating Post-Training Is Hard

Evaluating a post-trained model is far harder than evaluating a pre-trained one. Pre-training can be measured by perplexity, but post-training's objectives are multi-dimensional -- useful, safe, accurate, natural, format-compliant -- and these dimensions are hard to capture in a single number.

### 8.2 Three Tiers of Evaluation Methods

**Automatic metrics**: Fast but coarse. Traditional metrics like perplexity, BLEU, and ROUGE only measure surface matching and cannot assess whether a response is genuinely helpful. They're better as quick screening tools than final judgment criteria.

**Task benchmarks**: Structured but limited. MT-Bench and Arena-Hard use multi-turn conversations to evaluate different capability dimensions; MMLU tests breadth of knowledge. In 2026, the industry has about 15 mainstream benchmarks in active use, but only 4 reliably predict production performance.

**Human evaluation and arena platforms**: Closest to reality but highest cost. Chatbot Arena calculates Elo scores through 6M+ user votes in blind head-to-head comparisons, making it currently the closest approximation to "real user preference."

### 8.3 Practical Evaluation Recommendations

| Evaluation Scenario | Recommended Method | Notes |
| --- | --- | --- |
| Rapid iteration | Automatic metrics + small-scale human spot-checks | Don't rely on numbers alone |
| Pre-release | MT-Bench + domain-specific tests | Cover safety and edge cases |
| Method selection | Arena-Hard + human blind evaluation | Ensure evaluation set matches target scenario |
| Safety audit | Red-teaming + known attack pattern library | Continuously update attack vectors |

### 8.4 Post-Training Method Selection Decisions

Finally, let's put all methods together for a practical selection reference:

| Your Situation | Recommended Method | Rationale |
| --- | --- | --- |
| First post-training, limited resources | SFT + DPO | Simple pipeline, mature tooling |
| Pursuing conversation quality, have annotation budget | SFT + RLHF (PPO) | Online learning yields better results |
| Improving reasoning, verifiable tasks | SFT + GRPO/RLVR | Effectiveness proven by DeepSeek-R1 |
| Only binary feedback data | SFT + KTO | No paired preference data needed |
| Tight GPU memory, quick experiments | SFT + SimPO | No reference model needed |
| Production-grade full optimization | SFT + RLHF/GRPO + Safety Alignment | Multi-stage combination for best results |

> **Checkpoint**: If you were doing post-training for a customer service LLM, which method combination would you choose? Why?

---

## Practice Section: Hands-On Post-Training

### Complete an SFT Fine-Tuning with the TRL Library

Use HuggingFace's TRL (Transformer Reinforcement Learning) library to practice SFT on a small model:

1. Choose a small model (e.g., Qwen2.5-1.5B or Llama-3.2-1B)
2. Prepare 1,000 high-quality instruction-response data points
3. Train for 1-2 epochs using `SFTTrainer`
4. Compare response quality before and after training

Focus areas: training loss curve, response format, signs of Catastrophic Forgetting.

### Align an SFT Model with DPO

Perform DPO training on top of your SFT model:

1. Prepare 500 paired preference data points (chosen/rejected pairs)
2. Train using `DPOTrainer`
3. Compare response quality between SFT-only and SFT+DPO
4. Experiment with adjusting the beta parameter and observe the effect on results

Focus areas: direction of quality changes, signs of overfitting, impact of beta on results.

### Design a Post-Training Plan for a Medical Q&A Scenario

Design a post-training plan for the following scenario, writing a 1-page technical proposal:

> Scenario: You need to customize an LLM for a medical Q&A scenario. The base model is Qwen2.5-7B. Requirements: accurately answer common medical questions, refuse to provide diagnostic advice, support both Chinese and English.

The proposal should include: chosen post-training methods, data requirements, training steps, evaluation plan, and safety measures.

### Self-Check List

- [ ] I can explain what problem each of SFT, RLHF, DPO, and GRPO solves
- [ ] I can articulate the core difference between RLHF and DPO
- [ ] I understand why data quality matters more than quantity
- [ ] I know the main challenges of Safety Alignment
- [ ] I can select the right post-training method for a specific scenario

---

## References

- Ouyang et al., *Training language models to follow instructions with human feedback*, NeurIPS 2022 -- The industrial starting point for RLHF
- Rafailov et al., *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*, NeurIPS 2023 -- The original DPO paper
- Shao et al., *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models*, 2024 -- Where GRPO was first proposed
- DeepSeek-AI, *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*, 2025 -- The reasoning model benchmark
- *Reinforcement Learning for LLM Post-Training: A Survey*, arXiv 2407.16216 -- A continuously updated comprehensive survey
- *A Comprehensive Survey of Direct Preference Optimization*, arXiv 2410.15595 -- The full landscape of DPO variants
- *Fixing It in Post: A Comparative Study of LLM Post-Training Data Quality and Model Performance*, NeurIPS 2025 -- Empirical study on data quality
- HuggingFace, *Guide to Reinforcement Learning Post-Training Algorithms* -- Algorithm comparison reference

## Further Reading

- **Getting started**: Phil Schmid, *How to align open LLMs in 2025 with DPO & synthetic data* -- Hands-on guide
- **Deep dive into GRPO**: Cameron R. Wolfe, *Group Relative Policy Optimization (GRPO)* -- Detailed mathematical derivation
- **Open-source frameworks**: verl (HybridFlow), rLLM, slime -- Production-grade RL post-training frameworks
- **Evaluation platform**: Chatbot Arena (lmarena.ai) -- Model battle leaderboard based on real user votes
- **Industry trends**: llm-stats.com, *Post-Training in 2026: GRPO, DAPO, RLVR & Beyond* -- The 2026 post-training technology landscape
