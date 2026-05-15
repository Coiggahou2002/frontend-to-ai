# 7. 生产坑

你完全可以端到端跑完一次微调，然后上线一个坏掉的模型。生产里的微调灾难，绝大多数不是"算法没起作用"——而是运维问题。这一页讲你必然会撞到的 8 种失败模式，大致按你撞到它们的先后排序。

## 1. 灾难性遗忘

**症状**：微调后的模型在你这个具体任务上很厉害，但丢掉了基座原本的能力——基础事实问答、简单推理、工具调用，甚至无关话题上的指令遵循。

**为什么**：微调会移动权重。推得太狠（高 lr、太多 epoch、高 LoRA rank）就会把权重从基座编码的广义能力上带偏。

**缓解**：
- 降低学习率（试着减半）。
- 减少 epoch。大多数 SFT 任务 1–3 个 epoch 就够了；10+ 是在求遗忘。
- 减小 LoRA `r`（覆盖容量更小）。
- **掺通用数据**——哪怕在你的任务数据里掺 10–20% 的通用 instruction 数据，都能保留大量通用行为。（[第 12 章 §2](../post-training) 把这件事叫 PPO-ptx。）
- 上线前永远在基座和微调上都跑一份"通用能力" eval（[§5](./evaluating-the-finetune)）。

## 2. Chat-template 不匹配

**症状**：推理时模型把 chat 标签当字面文本输出（`<|im_start|>assistant\n`），或者输出乱码，或者根本停不下来。

**为什么**：训练和推理用了不一样的 chat 格式。有时是训练时用了错的 tokenizer；有时是推理时忘了 `add_generation_prompt=True`；有时是有人手写了一个自定义 template，而不是调 `tokenizer.apply_chat_template`。

**修法**：永远一致地用 `tokenizer.apply_chat_template`。训练时：

```python
text = tok.apply_chat_template(messages, tokenize=False)
```

推理时：

```python
text = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
```

推理时的 `add_generation_prompt=True` 是用来追加一个空的 `assistant` 回合，让模型从那里继续往下写（[第 0 章 §3](../how-llms-work/completion-to-conversation)）。微调之后最常见的推理 bug 就是忘了它。

## 3. 基座升级把 adapter 弄坏了

**症状**：上游发了 `Qwen2.5-3B-Instruct-v2`（或者就地把现有 tag 改了，这种事真发生过），你那个针对 v1 权重训的 adapter 套到 v2 上突然开始输出垃圾。

**为什么**：LoRA adapter 在数学上就是对一组特定冻结权重的 delta。adapter 不知道下面是什么；它只是把 `B @ A` 加到它指着的那个矩阵上。新权重 → 错误的 delta 方向 → 错误的输出。

**缓解**：
- **锁定基座版本。** 加载代码里用完整 commit hash：`AutoModelForCausalLM.from_pretrained(BASE, revision="<hash>")`。别依赖浮动的 tag。
- **为重训做计划。** 把每次基座升级都当作一个项目：所有 adapter 重训、重评、一起上。基座架构发生大变（换了一个完全不同的架构）的时候连数据集可能都得改。
- **别把业务绑死在 6 个月前的基座上。** 如果你现实上根本升不动基座，那是商业风险，不是技术问题——开源小模型迭代很快，你的微调会随时间显得越来越糟。

## 4. "我们在测试集上训练了"

**症状**：eval 指标好得离谱。生产表现一般。用户抱怨。差距重现不出来。

**为什么**：eval set 泄漏到了训练集。最常见是因为：
- train 和 eval 都从同一个数据池生成出来，没去重。
- 一个"数据增强"脚本生成了 eval 样本的近似变体，结果都被丢进了 train。
- 复用了上一次的 eval set 训新模型，没检查新的 train set 有没有覆盖那些 prompt。

**修法**：每次训练前都用 prompt 部分的哈希去重，跨 split 删掉碰撞：

```python
import hashlib
def hash_prompt(messages):
    user_text = "".join(m["content"] for m in messages if m["role"] == "user")
    return hashlib.sha256(user_text.encode()).hexdigest()

train_hashes = {hash_prompt(ex["messages"]) for ex in train_set}
eval_set = [ex for ex in eval_set if hash_prompt(ex["messages"]) not in train_hashes]
```

要更稳的保护：**eval set 由人手工策划，并且永远不和训练数据共享来源**。再激进一点：用 MinHash 做模糊去重抓近似重复。

## 5. 训练和部署的量化精度不一致

**症状**：你的微调在 notebook 里 eval 跑得不错，但部署后输出微妙地变差——语气有点漂、偶尔出坏答案、任务指标边际下降。

**为什么**：你训练时是 QLoRA（4-bit 基座，fp16 计算）。部署时合并成 fp16 又量化成 8-bit。"先 merge 再 re-quantize"这条路并不能精确复现训练时模型看到的算术，小的数值漂移会沿着长序列累积起来。

**缓解**：
- **用和训练一样的精度部署。** 如果训练时用 NF4，部署时基座也保持 NF4——大多数 multi-LoRA 部署栈都支持这点。
- 如果你必须 merge 再量化，把 merge 后量化的版本完整跑一遍 eval set 验证。别假设它和训练时等价。
- 别用比训练更低的精度部署（4-bit 训练就别 2-bit 部署）。

## 6. 没有回归集

**症状**：你团队 6 个月里发了 4 次微调。没人能讲清楚 v3 比 v2 是真的好还是假的好，也没人能讲清楚 v4 是不是修了 v3 引入的回归。

**为什么**：每次微调都用一份临时凑的 eval set。版本之间没有一把固定的尺。

**修法**：**第一天就建一份回归集**，并且不去动它。每个微调候选都对它跑一遍。这份集合应该包含：
- 你在意的每个能力上的代表性 prompt。
- 几条"通用能力"prompt 用来抓遗忘。
- 几条"v1 当年很烂"的 prompt 用来看那些是否被修了。
- 你亲眼在生产里见过出错的 prompt。

把回归集当 CI 测试套件来对待。如果你要改它，也给它打版本号（`v1`、`v2`……），并且永远不要在没有显式确认的情况下用一个旧版本的 set 跑新微调。[第 13 章](../evaluation) 讲一个真正产品级的 eval 纪律是什么样。

## 7. 拒答策略回归

**症状**：微调之后，模型要么开始拒答它原本会答的（过度拒答），要么开始答它原本会拒答的（拒答不足——给消费级产品上线后这件事比前者糟糕得多）。

**为什么**：基座变成"Instruct"时经过的后训练划好了拒答边界。你的微调把那些边界挪了——有时是有意的，有时是顺带的。更宽的框架见 [第 2 章 §9](../llm-apis-and-prompts/failure-modes)。

**缓解**：
- 在回归集里加一份 **安全 eval**：该拒答的 prompt（明显有害）、该回答的 prompt（敏感领域里的合法问题）。各自跟踪拒答率。
- 如果你*故意*要挪拒答边界（比如让模型能讨论安全研究），那就刻意做：在训练数据里包入对齐过的样本，再在安全 eval 上验证。
- 如果上线给终端用户，**每次微调都审核拒答行为**，不是只有首发时审。

## 8. Tool-use 格式回归

**症状**：微调之后模型在新任务上很厉害，但不再发出有效的工具调用。你的 agent 没法正常工作了。

**为什么**：你训练时没带 tool-use 样本。模型"忘了"怎么发 tool-call 格式。和灾难性遗忘（#1）是同一种机制，只是具体到工具调用上。

**修法**：
- 如果你的模型推理时要调工具，**永远在训练集里包入 tool-use 样本**——哪怕你的微调任务和工具无关。训练样本里有 5–10% 是 tool-call 样本就能可靠地保留格式。
- 把 tool-call 合法性加进回归集：几条该触发 tool call 的 prompt，检查 JSON 参数合法性和 function name 是否正确。
- 见 [第 2 章 §6](../llm-apis-and-prompts/tool-use) 看 tool-use 消息长什么样。

## 一个元模式

如果你看这八个坑，里面有六个最终都归约为 **"建一份全面的 eval set，并且每次都跑"**。灾难性遗忘、拒答回归、tool-use 回归、基座升级翻车、train-test 泄漏、没有回归集——所有这些问题，好的 eval 都能抓到，差的或者没有 eval 就让它们溜过去。

埋头做微调时的诱惑就是跳过 eval、直接上线。代价会在几周后在生产里付出来——你说不清是哪一次过去的微调引入了 bug，得从头重训一次。**先建 eval。再做微调。**

---

到这里你已经有了工程上需要的所有部件：什么时候微调、LoRA / QLoRA 的机械原理、怎么准备数据、怎么在便宜硬件上跑训练循环、怎么评估结果、怎么部署、以及那 8 个坑。同样的代码换更大的模型 + 更大的 GPU 是线性扩展的。

接下来，这一切在底层是怎么工作的理论部分——[第 12 章](../post-training)。
