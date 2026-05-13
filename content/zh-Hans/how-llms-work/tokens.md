# 1. Token——模型实际读取的内容

来自终端用户体验的最常见心智模型是错的：模型不读字符，也不读单词。它读的是 **token**。

一个 token 是一段文本——通常几个字符长，有时是一个完整的短单词，有时是一个片段。从文本到 token 的映射由每个模型自带的**分词器（tokenizer）**确定。大多数现代 LLM 的分词器使用 **Byte Pair Encoding（BPE）** 的某种变体：从原始字节开始，反复合并最频繁的字节对，直到形成一个通常在 32K–256K 之间的词表。

一个对 TS 开发者有用的类比：token 就像 parser 中 lexer 输出的 token。你的源代码是 `const x = 42;`，但 parser 看到的不是字符，而是 `[Const, Identifier("x"), Equals, Number(42), Semicolon]`。Token 是系统真正在其上做推理的单元，字符在它的感知层之下。

## 一个具体的例子

来看这个句子：

```
Tokenization is fundamental to understanding LLMs.
```

用一个典型的 BPE 分词器（这里用 GPT-4 的 `cl100k_base`）跑一遍，得到的结果大概是：

```
["Token", "ization", " is", " fundamental", " to", " understanding", " LL", "Ms", "."]
```

九个 token。注意几点：

- `Tokenization` 被拆成了 `Token` + `ization`。常见词根和常见后缀各自成 token。
- 前导空格是 token 的一部分——`" is"` 是一个 token，不是 `" "` + `"is"`。这就是为什么模型对你空格和换行的位置很敏感。
- `LLMs` 变成了 `LL` + `Ms`。不太常见的拼写会被拆碎。
- 句号自己是一个 token。

换一个分词器不同的模型，拆分结果就会不一样。中文、日文、韩文相对于英文，每个字符通常会产生 2–3 倍的 token，因为它们的字符在 BPE 词表中比较稀有。冷门语言和代码混杂的文本就更糟。

## 一些速算经验

| 内容类型                                     | 大致 token 数                            |
|---|---|
| 英文散文                                     | 约 1.3 token/词，约 4 字符/token         |
| 代码（Python/TypeScript）                    | 约 1.5 token/词，空格和操作符各自占 token |
| 中文 / 日文 / 韩文                           | 约 1.5–2 token/字符                       |
| URL、哈希值、base64                          | 几乎 1 token/字符（很丑）                 |

## 为什么这件事很重要

你会在整个 AI 生态里到处看到 "token"：

- **价格**以 token 计价。API 按每百万输入 token 和每百万输出 token 收费，输出通常贵 3–5 倍。
- **上下文窗口大小**以 token 为单位，不是字符或单词。
- **延迟**随 token 数量增长——输入侧（prefill 阶段）和输出侧（decode 阶段）都是。
- **限流**以每分钟 token 数（tokens-per-minute）计。

LLM 工程里几乎每一个有意义的数字都是 token 数。如果你只从这一节学一件实操的事：在你的开发环境里装一个分词器，时不时把你的 prompt 跑一下，建立"这段东西大概有多少 token"的直觉，就像你已经有"这个 JSON 负载大概多少字节"的直觉一样。

```python
# Python: 用 tiktoken（OpenAI 的分词器）数 token
import tiktoken
enc = tiktoken.encoding_for_model("gpt-4o")
tokens = enc.encode("Tokenization is fundamental to understanding LLMs.")
print(len(tokens))   # 9
print(tokens)        # [4421, 2065, 374, 16188, 311, 8830, 445, 43, 82, 13]
```

每个 token 不过是一个整数 ID，是模型词表中的一个索引。模型的输入是一串整数，输出是另一个整数。其余的一切——编码、解码、人类可读的文本——都是发生在边界上的管道工作。

下一节：[下一个 token 预测 →](./next-token-prediction)
