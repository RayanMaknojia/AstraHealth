# Onboard Skin Photo Model

The Photo Check "first look" runs this model in the browser. It works offline and needs no API key.

* **Model:** MobileNetV3-Large, pretrained on ImageNet and fine-tuned on public wound photos
* **Classes:** abrasion, bruise, burn, laceration (cut), normal skin, plus "unsure" when confidence is below 60%
* **Runs in:** the browser, with onnxruntime-web (WebAssembly). About 35 ms per photo
* **Files used by the app:** `public/models/skin_classifier.onnx` (16.8 MB) and `public/models/model_meta.json`
* **App code:** `src/services/skinModel.ts` (loads and runs the model) and `src/services/photoCheckService.ts` (first aid, severity rules, sync queue)

Results and limits: [MODEL_CARD.md](MODEL_CARD.md). Data sources: [DATA_CARD.md](DATA_CARD.md).

## How the app uses it

1. The astronaut takes or uploads a photo in Photo Check.
2. `skinModel.ts` stretches the photo to 224 x 224, turns it into numbers and runs the model.
3. The model returns a probability for each of the 5 classes.
4. If the top class is below 60%, the result is **Unsure** and goes to the flight surgeon.
5. First aid steps come from `SKIN_GUIDANCE` in `src/data/phase3Data.ts`.
6. Severity comes from the same deterministic rules as before (`judgeSkinSeverity`). They use pain, notes, temperature, heart rate, SpO2 and earlier photos. For example, a possible infection with a fever becomes an Alert and recommends SOS.

## Retrain

Run these from the repo root. Keep the downloaded data outside the repo, or in `ml/skin_classifier/data/` (git ignored).

```bash
pip install -r ml/skin_classifier/requirements.txt

# 1. Get the data
git clone --depth 1 https://github.com/RucksikaaR/Wound-detection-and-diagnosis.git ../mldata/wound
git clone --depth 1 https://github.com/PogusTheWhisper/Surgicare-ALB.git ../mldata/surgicare

# 2. Pretrained weights (ImageNet)
curl -L -o ../mldata/mobilenetv3_large_100_ra-f55367f5.pth \
  https://github.com/rwightman/pytorch-image-models/releases/download/v0.1-weights/mobilenetv3_large_100_ra-f55367f5.pth

# 3. Build the dataset (maps labels, removes duplicates including rotated and flipped copies, splits 70/15/15)
python ml/skin_classifier/scripts/build_dataset.py \
  --sources ../mldata/wound ../mldata/surgicare/careful_this_contain_wound_image \
  --out ../mldata/manifest.csv

# 4. Check that no validation or test photo has a copy in training (should print 0)
python ml/skin_classifier/scripts/leak_check.py ../mldata/manifest.csv 8

# 5. Train, evaluate, calibrate and export
python ml/skin_classifier/scripts/train.py \
  --manifest ../mldata/manifest.csv \
  --weights ../mldata/mobilenetv3_large_100_ra-f55367f5.pth \
  --out ml/skin_classifier

# 6. Copy the new model into the app
cp ml/skin_classifier/export/skin_classifier.onnx ml/skin_classifier/export/model_meta.json public/models/
```

Training takes about 4 minutes on a laptop CPU. Results are written to `reports/metrics.json`.

## Model file format

| | |
|---|---|
| Input | `image`: float32 `[1, 3, 224, 224]`, RGB, values 0 to 1, photo stretched to 224 x 224 |
| Output | `probs`: float32 `[1, 5]`, calibrated probabilities in this order: abrasion, bruise, burn, laceration, normal |
| Built in | ImageNet normalisation, temperature calibration, softmax |

## Files

| Path | What it is |
|---|---|
| `scripts/build_dataset.py` | Label mapping, rotation and flip aware duplicate removal, split |
| `scripts/leak_check.py` | Confirms no validation or test photo has a copy in training |
| `scripts/train.py` | Training, test evaluation, calibration, "unsure" threshold, ONNX export |
| `reports/metrics.json` | All test results |
| `reports/parity_reference.json` | Expected outputs for 5 test photos, used to check the exported model |
| `export/model_meta.json` | Input and output format, threshold, version |
