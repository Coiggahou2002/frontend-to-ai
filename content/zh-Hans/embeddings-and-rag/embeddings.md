# 2. Embeddings 入门

一个 **embedding** 是一个 `text -> vector` 的函数，它使得语义相近的文本生成在空间中距离接近的向量。

```
"the cat sat on the mat"      -> [0.012, -0.044, 0.131, ...,  0.029]   (1024 floats)
"a feline rested on the rug"  -> [0.015, -0.041, 0.128, ...,  0.031]   (close to the first)
"kubernetes pod scheduling"   -> [-0.211, 0.073, -0.018, ..., -0.009]  (far from both)
```

一个对 TS 开发者有用的类比：把 embedding 想成一个模型用来做语义索引的 `Map<string, number[]>`——但 key 是*连续的*（任何文本都可以，不局限于精确字符串），而"查找"是"在向量空间里找最近的 key"，而不是精确匹配。整个接口就是这样。

向量本身是不透明的——任何单个坐标对人来说都没有可读含义。重要的是向量之间的**几何关系**。

## 手算 cosine 相似度

衡量两个 embedding 距离的标准方式：

```
cos(θ)  =  (a · b) / (‖a‖ · ‖b‖)
```

取值范围：−1（方向相反）到 1（方向相同）。对文本 embedding 来说，下限通常在 0 附近；接近 1 表示非常相似。

```python
import numpy as np

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# Pretend these came from an embedding model.
a = np.array([0.012, -0.044, 0.131, 0.029])
b = np.array([0.015, -0.041, 0.128, 0.031])
c = np.array([-0.211, 0.073, -0.018, -0.009])

print(cosine(a, b))   # -> ~0.999  (very similar)
print(cosine(a, c))   # -> ~-0.4   (unrelated)
```

就这么简单。这一个函数调用就是向量检索的全部核心。本章后面所有内容都是为了让它在大规模下足够快、足够精确，能真正用起来。

## 生成 embedding

### 托管：OpenAI

```python
from openai import OpenAI
client = OpenAI()

texts = [
    "the cat sat on the mat",
    "a feline rested on the rug",
    "kubernetes pod scheduling",
]

resp = client.embeddings.create(
    model="text-embedding-3-large",
    input=texts,
)
vectors = [np.array(d.embedding) for d in resp.data]
print(vectors[0].shape)  # (3072,)

print(cosine(vectors[0], vectors[1]))  # -> ~0.83
print(cosine(vectors[0], vectors[2]))  # -> ~0.05
```

两次 API 调用拿到一些向量，几何关系已经显现了：两句关于猫的句子是相近的，关于 kubernetes 的那句很远。

### 自部署：sentence-transformers

Python 生态里跑开源 embedding 模型的首选是 `sentence-transformers`，它把 Hugging Face 模型包在一个简单的 `.encode()` API 后面。

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("BAAI/bge-large-en-v1.5")
vectors = model.encode([
    "the cat sat on the mat",
    "a feline rested on the rug",
    "kubernetes pod scheduling",
])
print(vectors.shape)   # (3, 1024)
```

形状契约是一样的——一个 `(n_texts, d_dimensions)` 的二维 `numpy` 数组。数值不一样（不同模型，不同几何），但*关系*是相似的：两句关于猫的句子聚在一起，kubernetes 那句独自待着。

## 维度与存储的取舍

| 模型 | 维度 | 备注 |
|---|---:|---|
| `bge-small-en-v1.5`（开源） | 384 | 便宜、快，原型和小语料够用 |
| `bge-large-en-v1.5`（开源） | 1024 | 英文场景下强力的开源默认 |
| `voyage-3`（托管） | 1024 | 检索调优过，非常强 |
| `text-embedding-3-large`（托管） | 3072（可截断） | 顶级闭源模型；支持 MRL 截断 |

维度更高 = 捕获的语义细节更多，但：

- **存储**：向量默认存为 `float32`（每维 4 字节）。1M 向量 × 3072 维 × 4 字节 = **12 GB**，仅向量本身。
- **检索延迟**：每次比较都要走过每一维。维度翻倍，单向量代价大致翻倍。
- **压缩**：很多 DB 支持 `float16`（存储减半，质量损失接近零）或**标量/积量化**（4 到 8 倍压缩，有可测但很小的质量损失）。

实操默认值：从 1024 维起步（bge-large 或 voyage-3）。只在你的评估集（[§7](./evaluating-rag)）显示更高维度真的有帮助时才往上调。

## 归一化——为什么 dot product = cosine

cosine 相似度要除以模长。**如果你的向量已经做了 L2 归一化**（模长 = 1），这次除法就是空操作：

```
if  ‖a‖ = ‖b‖ = 1   then   cos(θ) = a · b
```

大多数现代 embedding 模型——bge、voyage、OpenAI 的 `text-embedding-3-*`——都返回预归一化的向量。这意味着在你的向量 DB 里可以用**内积（dot）**距离，比 cosine 更快，结果完全一样。

```python
v = model.encode(["hello world"])[0]
print(np.linalg.norm(v))  # -> ~1.0  (pre-normalized)
```

如果某个模型没有预归一化，写入时归一化一次，之后就再也不用想这件事了：

```python
def normalize(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)
```

## 关于多模态的简短一节

有些 embedding 模型——CLIP、SigLIP、OpenAI 带视觉的编码器——把**文本和图像放进同一个向量空间**。embed 一张图、embed 一个像 "red sneaker on white background" 这样的 query，dot product 比较就能浮现相关图片。`text -> vector` 的接口推广成了 `(text|image|audio) -> vector`。

生产中的检索大多还是纯文本。如果你需要图像或视频检索，相同的流水线模式仍然适用——换掉 encoder 即可。这里不深入多模态。

## 2026 年怎么选 embedding 模型

不要纠结。三个合理的默认：

| 选这个 | 什么时候 |
|---|---|
| `text-embedding-3-large`（OpenAI） | 你已经在 OpenAI 上跑 chat；想要顶级质量且零运维；Matryoshka 截断让你可以用维度换成本 |
| `voyage-3`（Voyage AI） | 检索专项质量是你的瓶颈；愿意为检索基准上的 SOTA 付钱 |
| `bge-large-en-v1.5` 或 `bge-m3`（开源） | 成本或数据驻留是问题；想自部署；需要多语言（`bge-m3`） |

挑一个，把流水线搭起来，跑你的评估集（[§7](./evaluating-rag)），然后再换。**embedding 模型是 RAG 系统里仅次于切块的第二大旋钮**（[§4](./chunking)）——但只有评估集才能告诉你哪一个在你的语料上赢。

下一节: [向量检索与 ANN →](./vector-search)
