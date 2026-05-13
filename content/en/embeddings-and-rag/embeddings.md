# 2. Embeddings 101

An **embedding** is a function `text -> vector` such that semantically similar texts produce vectors that are close in space.

```
"the cat sat on the mat"      -> [0.012, -0.044, 0.131, ...,  0.029]   (1024 floats)
"a feline rested on the rug"  -> [0.015, -0.041, 0.128, ...,  0.031]   (close to the first)
"kubernetes pod scheduling"   -> [-0.211, 0.073, -0.018, ..., -0.009]  (far from both)
```

A useful TS analogy: think of embeddings as a `Map<string, number[]>` the model uses for semantic indexing — but the keys are *continuous* (any text, not just exact strings), and "lookup" is "find the nearest key in vector space" instead of exact match. That's the whole interface.

The vector itself is opaque — no individual coordinate means anything human-readable. What matters is the **geometric relationship** between vectors.

## Cosine similarity, by hand

The standard way to measure how close two embeddings are:

```
cos(θ)  =  (a · b) / (‖a‖ · ‖b‖)
```

Range: −1 (opposite) to 1 (identical direction). For text embeddings, the floor is usually around 0; near-1 means very similar.

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

That's it. That single function call is the heart of vector search. Everything in this chapter is about making it fast at scale and precise enough to be useful.

## Generating embeddings

### Hosted: OpenAI

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

Two API calls' worth of vectors and you can already see the geometry working: the two cat sentences are close, the kubernetes one is far.

### Self-hosted: sentence-transformers

The Python ecosystem's go-to for open embedding models is `sentence-transformers`, which wraps Hugging Face models behind a simple `.encode()` API.

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

Same shape contract — a 2-D `numpy` array of `(n_texts, d_dimensions)`. The numbers are different (different model, different geometry), but the *relationships* are similar: cat sentences cluster, kubernetes is alone.

## Dimensions and the storage trade-off

| Model | Dimensions | Notes |
|---|---:|---|
| `bge-small-en-v1.5` (open) | 384 | Cheap, fast, fine for prototypes and small corpora |
| `bge-large-en-v1.5` (open) | 1024 | Strong open default for English |
| `voyage-3` (hosted) | 1024 | Retrieval-tuned, very strong |
| `text-embedding-3-large` (hosted) | 3072 (truncatable) | Top-quality closed model; supports MRL truncation |

Higher dimensions = more semantic detail captured, but:

- **Storage**: vectors are stored as `float32` by default (4 bytes/dim). 1M vectors × 3072 dims × 4 bytes = **12 GB** just for the vectors.
- **Search latency**: every comparison touches every dimension. Doubling dims roughly doubles the per-vector cost.
- **Compression**: many DBs support `float16` (halves storage, near-zero quality loss) or **scalar/product quantization** (4–8x compression with measurable but small quality loss).

A practical default: start at 1024 dims (bge-large or voyage-3). Go higher only if your eval set ([§7](./evaluating-rag)) shows it actually helps.

## Normalization — why dot product = cosine

Cosine similarity divides by the magnitudes. **If your vectors are already L2-normalized** (norm = 1), the division is a no-op:

```
if  ‖a‖ = ‖b‖ = 1   then   cos(θ) = a · b
```

Most modern embedding models — bge, voyage, OpenAI's `text-embedding-3-*` — return pre-normalized vectors. This means in your vector DB you can use **inner-product (dot)** distance, which is faster than cosine and gives identical results.

```python
v = model.encode(["hello world"])[0]
print(np.linalg.norm(v))  # -> ~1.0  (pre-normalized)
```

If a model isn't pre-normalized, normalize once at write time and never think about it again:

```python
def normalize(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)
```

## A quick note on multimodality

Some embedding models — CLIP, SigLIP, OpenAI's vision-aware encoders — put **text and images in the same vector space**. Embed an image, embed a query like "red sneaker on white background," and dot-product comparison surfaces the relevant images. The `text -> vector` interface generalizes to `(text|image|audio) -> vector`.

Most production retrieval is still text-only. If you need image or video search, the same pipeline pattern applies — just swap the encoder. We won't deep-dive multimodal here.

## Choosing an embedding model in 2026

Don't agonize. Three reasonable defaults:

| Pick | When |
|---|---|
| `text-embedding-3-large` (OpenAI) | You're already on OpenAI for chat; want top quality with no ops; Matryoshka truncation lets you trade dims for cost |
| `voyage-3` (Voyage AI) | Retrieval-specific quality is your bottleneck; willing to pay for state-of-the-art on retrieval benchmarks |
| `bge-large-en-v1.5` or `bge-m3` (open) | Cost or data residency matters; want to self-host; need multilingual (`bge-m3`) |

Pick one, build the pipeline, run your eval set ([§7](./evaluating-rag)), then swap. **Embedding model is the second-biggest knob in a RAG system, behind chunking** ([§4](./chunking)) — but only the eval set will tell you which one wins on your corpus.

Next: [Vector Search & ANN →](./vector-search)
