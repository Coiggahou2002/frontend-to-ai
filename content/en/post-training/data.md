# 6. Data Engineering

The deciding factor in post-training.

## Quality over quantity

This is perhaps one of the most counter-intuitive findings in post-training: **fewer but better data points often outperform more but mixed-quality data**.

IBM Research conducted a detailed quality audit of two mainstream open-source post-training datasets (Tulu-3-SFT-Mix and SmolTalk), designed a data mixing recipe (TuluTalk), and with 14% fewer samples than either original dataset, matched or exceeded their performance on key benchmarks.

If you only remember one thing from this entire chapter, make it this one. Algorithm choice is a 1.1x lever; data quality is a 2-3x lever.

## Quality dimensions for SFT data

Building a high-quality [SFT](./sft) dataset requires attention to the following dimensions:

| Dimension | Description | Common Issues |
| --- | --- | --- |
| Accuracy | Factually correct, no hallucinations | GPT-generated data may contain errors |
| Diversity | Coverage across multiple tasks and domains | Dataset biased toward certain task types |
| Complexity | Includes different difficulty levels | All simple Q&A, lacking deep reasoning |
| Response quality | Detailed, structured, helpful | Responses too short or lacking explanation |
| Safety | Contains no harmful content | Unfiltered web data |

## Collecting preference data

Preference data (for [RLHF](./rlhf) / [DPO](./dpo)) comes from two main sources:

**Human annotation**: Have annotators rank the model's multiple responses. The advantage is controllable quality; the drawback is high cost and slow speed. InstructGPT's annotation team required specialized training.

**Synthetic generation**: Use a stronger model (like GPT-4) to judge response quality, or have the model itself generate positive and negative examples. Tools like HuggingFace's Distilabel support large-scale synthetic data generation.

## Synthetic data methods and risks

Synthetic data is becoming mainstream, but several risks demand vigilance:

- **Model collapse**: If a model only learns from its own generated data, it may gradually lose diversity
- **Hallucination amplification**: Errors in synthetic data get reinforced during training
- **Homogenization**: All models distilling from the same strong model leads to reduced ecosystem diversity

SPIN (Self-Play Improvement) improves the model by having it distinguish its own outputs from human outputs. SPICE mitigates hallucination by introducing external documents into the self-play process.

## Practical data recipe recommendations

A reference data mixing strategy:

1. **Foundation layer**: High-quality human data covering core task types (30-40%)
2. **Expansion layer**: Synthetic data for diversity and scale (40-50%)
3. **Calibration layer**: Targeted data for weak areas (10-20%)
4. **Deduplication & filtering**: Remove duplicates, low-quality, and harmful samples

Once your data is in shape and your method is chosen, the next concern is whether the resulting model is actually safe to ship.

> **Checkpoint**: Why can "fewer but better data" outperform "more but mediocre data"? Try explaining from the perspectives of overfitting and noise.

Next: [Alignment and Safety](./safety)
