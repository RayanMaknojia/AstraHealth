# Model Card: Onboard Skin Photo Model (skin-v1.0)

**Hackathon prototype. First look only. Not a diagnosis and not a medical device.**

## What it does

Sorts a skin photo into one of 5 classes: abrasion, bruise, burn, laceration (cut), normal skin. Below 60% confidence the app shows **Unsure** and sends the photo to the flight surgeon.

## Model

* MobileNetV3-Large (timm `mobilenetv3_large_100`), ImageNet pretrained
* Stage 1: new head only, 3 epochs
* Stage 2: full fine-tune, AdamW, cosine schedule, label smoothing 0.1, class weighted loss, early stopping on validation macro F1
* Augmentation: random crop (70 to 100%), flip, rotation up to 15°, mild colour jitter
* Temperature scaling fitted on the validation split (T = 0.545)
* Exported to ONNX (opset 17), 16.8 MB, about 35 ms per photo in onnxruntime-web

## Results (test split, 69 photos never seen in training)

| Metric | Value |
|---|---|
| Accuracy | **89.9%** |
| Macro F1 | **0.887** |
| Answered (confidence ≥ 60%, the app's cutoff) | 91% of photos |
| Accuracy on answered photos | **95.2%** |
| Sent to "Unsure" | 9% of photos |

The cutoff was picked on the validation split: at 60%, 83% of validation photos are answered with 87.7% accuracy (at 70%: 74% answered, 90.2% accuracy). 60% was chosen so fewer photos come back "Unsure".

| Class | Precision | Recall | F1 | Test photos |
|---|---|---|---|---|
| Abrasion | 0.79 | 0.92 | 0.85 | 12 |
| Bruise | 0.88 | 0.94 | 0.91 | 16 |
| Burn | 0.88 | 0.70 | 0.78 | 10 |
| Laceration | 0.93 | 0.88 | 0.90 | 16 |
| Normal skin | 1.00 | 1.00 | 1.00 | 15 |

Confusion matrix (rows = true, columns = predicted; order abrasion, bruise, burn, laceration, normal):

```
abrasion    11  0  0  1  0
bruise       1 15  0  0  0
burn         1  2  7  0  0
laceration   1  0  1 14  0
normal       0  0  0  0 15
```

**Main weakness:** burns. 3 of 10 test burns were called something else, and 40% of burns go to "Unsure".

## How sure are these numbers?

Not very. The test split is only 69 photos (62 correct). The 95% confidence interval for accuracy is about 81% to 95%. Treat 90% as a rough figure.

## Why the numbers are honest

The source data contains many rotated and flipped copies of the same photo. A first run that only removed exact look-alikes scored 98% on validation, because 209 of 279 validation and test photos had a rotated or flipped copy in training. The dataset builder now removes duplicates in any rotation or flip. `leak_check.py` confirms that no validation or test photo has a copy in training.

## Limits

* Trained on only 462 unique photos taken from the internet, not in space
* Lighting, cameras and skin tones in the training photos are not balanced. The model may do worse on darker skin and under spacecraft lighting
* Normal skin scored 100%. This may be partly because the normal photos look different in style (background, framing), not only because the skin is healthy
* Doesn't know bites, rashes, scabs, scars or infections. Those photos usually come back "Unsure" or as the closest of the 5 classes
* Severity, escalation and SOS are decided by fixed rules using vitals and notes, never by the model alone

## Intended use

A quick first look on board, to suggest first aid and decide whether to send the photo to the flight surgeon. Not for clinical decisions.
