# 9. 实战与参考

动手跑一次后训练，一份自检清单，以及值得读的论文。

## 用 TRL 库完成一次 SFT 微调

使用 HuggingFace 的 TRL（Transformer Reinforcement Learning）库，在一个小模型上实践 [SFT](./sft)：

1. 选择一个小模型（如 Qwen2.5-1.5B 或 Llama-3.2-1B）
2. 准备 1000 条高质量指令-回复数据
3. 使用 `SFTTrainer` 训练 1-2 个 epoch
4. 对比训练前后的回答质量

关注点：训练损失曲线、回答格式、Catastrophic Forgetting（灾难性遗忘）的迹象。

## 用 DPO 对齐一个 SFT 模型

在 SFT 模型的基础上进行 [DPO](./dpo) 训练：

1. 准备 500 条配对偏好数据（chosen/rejected 对）
2. 使用 `DPOTrainer` 训练
3. 对比 SFT-only 和 SFT+DPO 的回答质量
4. 尝试调整 beta 参数，观察对结果的影响

关注点：回答质量的变化方向、过拟合迹象、beta 对结果的影响。

## 为医疗问答场景设计后训练方案

为以下场景设计后训练方案，写一个 1 页的技术方案：

> 场景：你需要为一个医疗问答场景定制一个大模型。基座模型是 Qwen2.5-7B。要求：准确回答常见医学问题，拒绝给出诊断建议，支持中英文。

方案应包含：选择的后训练方法、数据需求、训练步骤、评估方案和安全措施。

## 自检清单

- [ ] 我能解释 SFT、RLHF、DPO、GRPO 各自解决什么问题
- [ ] 我能说出 RLHF 和 DPO 的核心区别
- [ ] 我理解为什么数据质量比数量更重要
- [ ] 我知道 Safety Alignment 的主要挑战是什么
- [ ] 我能为一个具体场景选择合适的后训练方法

---

## 参考资料

- Ouyang et al., *Training language models to follow instructions with human feedback*, NeurIPS 2022 — RLHF 的工业化起点
- Rafailov et al., *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*, NeurIPS 2023 — DPO 原始论文
- Shao et al., *DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models*, 2024 — GRPO 首次提出
- DeepSeek-AI, *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*, 2025 — 推理模型标杆
- *Reinforcement Learning for LLM Post-Training: A Survey*, arXiv 2407.16216 — 持续更新的综合综述
- *A Comprehensive Survey of Direct Preference Optimization*, arXiv 2410.15595 — DPO 变体全景
- *Fixing It in Post: A Comparative Study of LLM Post-Training Data Quality and Model Performance*, NeurIPS 2025 — 数据质量实证研究
- HuggingFace, *Guide to Reinforcement Learning Post-Training Algorithms* — 算法对比参考

## 延伸阅读

- **入门实践**：Phil Schmid, *How to align open LLMs in 2025 with DPO & synthetic data* — 动手指南
- **深入 GRPO**：Cameron R. Wolfe, *Group Relative Policy Optimization (GRPO)* — 数学推导详解
- **开源框架**：verl (HybridFlow), rLLM, slime — 生产级 RL 后训练框架
- **评估平台**：Chatbot Arena (lmarena.ai) — 基于真实用户投票的模型对战排行榜
- **行业趋势**：llm-stats.com, *Post-Training in 2026: GRPO, DAPO, RLVR & Beyond* — 2026 年后训练技术全景

---

后训练这条线讲完了。下一章把镜头拉远，讨论整个 LLM 应用栈的评估与可观测性——不只是训练那一次跑。

下一节: [第 11 章：评估与可观测性](../evaluation)
