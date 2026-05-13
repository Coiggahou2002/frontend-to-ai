# LLM API 与 Prompt 工程

第 0 章讲了模型在机制上做什么。本章讲怎么用代码跟它对话。

这是一个一线开发者视角的 API 表面与周边工程实践之旅。看完本章，你应该能够：

- 调用任何一家主流闭源模型提供商的 chat completion 接口，并解析响应
- 基于成本、延迟和运维标准，为给定工作负载挑选提供商
- 把 prompt 当作代码：纳入版本管理、可测试、有结构
- 强制模型输出符合你定义的 schema 的 JSON
- 跑一个工具调用（tool-use）生命周期，并理解为什么"agent"并不神奇
- 用流式输出做低延迟的 UX
- 在上线前估算成本和延迟
- 识别在生产环境中你一定会遇到的三种失败模式

本章会一直用 `anthropic` 和 `openai` 两个 Python SDK。这里的内容在 TypeScript / JS 里同样适用——SDK 几乎一模一样——但正如第 1 章所说，AI 生态以 Python 为先，在这个领域里你读到的 Python 会比 JS 多。

## 本章内容

1. [LLM API 调用的结构](./api-call-shape) —— 网线上传的是什么，OpenAI 与 Anthropic 并排对比
2. [选择提供商](./choosing-provider) —— 闭源 API 还是自部署，2026 年的决策表
3. [把 Prompt 工程当作软件工程](./prompt-as-code) —— prompt 是文件，不是 f-string
4. [System Prompt](./system-prompts) —— 人设、格式、护栏
5. [结构化输出](./structured-output) —— 三个层次，最终落到 schema 约束的生成
6. [Function Calling / 工具调用](./tool-use) —— 那个最终演化成"agent"的协议
7. [流式输出](./streaming) —— TTFT、SSE，以及为什么"流式 + 工具调用"很麻烦
8. [成本与延迟基础](./cost-and-latency) —— 输入 vs 输出的定价、prompt 缓存、TTFT vs 总延迟
9. [常见失败模式](./failure-modes) —— 幻觉、prompt 注入、拒答
