"""Fine-tune MobileNetV3-Large (ImageNet weights) on the skin photo manifest,
evaluate on the held-out test split, calibrate confidence, export ONNX.

    python train.py --manifest manifest.csv --weights mobilenetv3_large_100_ra-f55367f5.pth --out ../
"""
import argparse, csv, json, random, time
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from torchvision import transforms as T

CLASSES = ["abrasion", "bruise", "burn", "laceration", "normal"]  # model output order
SIZE = 224
MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
SEED = 42


def seed_all(s):
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def load_split(manifest, split):
    rows = [r for r in csv.DictReader(open(manifest)) if r["split"] == split]
    imgs = [Image.open(r["path"]).convert("RGB").resize((256, 256), Image.BILINEAR) for r in rows]
    return rows, imgs, torch.tensor([CLASSES.index(r["label"]) for r in rows])


TRAIN_TF = T.Compose([
    T.RandomResizedCrop(SIZE, scale=(0.7, 1.0), ratio=(0.8, 1.25)),
    T.RandomHorizontalFlip(), T.RandomRotation(15),
    T.ColorJitter(0.2, 0.2, 0.2, 0.03),
    T.ToTensor(), T.Normalize(MEAN, STD),
])
EVAL_TF = T.Compose([T.Resize((SIZE, SIZE)), T.ToTensor(), T.Normalize(MEAN, STD)])


def batches(imgs, ys, tf, bs, shuffle):
    idx = list(range(len(imgs)))
    if shuffle:
        random.shuffle(idx)
    for k in range(0, len(idx), bs):
        b = idx[k:k + bs]
        yield torch.stack([tf(imgs[i]) for i in b]), ys[b]


@torch.no_grad()
def logits_for(model, imgs, ys):
    model.eval()
    return torch.cat([model(x) for x, _ in batches(imgs, ys, EVAL_TF, 64, False)])


def macro_f1(logits, ys):
    return f1_score(ys.numpy(), logits.argmax(1).numpy(), average="macro")


def run_epoch(model, opt, imgs, ys, weights, bs=32):
    model.train()
    tot = 0.0
    for x, y in batches(imgs, ys, TRAIN_TF, bs, True):
        opt.zero_grad()
        loss = F.cross_entropy(model(x), y, weight=weights, label_smoothing=0.1)
        loss.backward(); opt.step()
        tot += loss.item() * len(y)
    return tot / len(imgs)


def fit_temperature(logits, ys):
    t = torch.ones(1, requires_grad=True)
    opt = torch.optim.LBFGS([t], lr=0.05, max_iter=200)
    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(logits / t.clamp(min=0.05), ys)
        loss.backward()
        return loss
    opt.step(closure)
    return float(t.detach().clamp(min=0.05))


def ece(probs, ys, bins=10):
    conf, pred = probs.max(1)
    edges = torch.linspace(0, 1, bins + 1)
    e = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            e += m.float().mean() * abs((pred[m] == ys[m]).float().mean() - conf[m].mean())
    return float(e)


def selective(probs, ys, thr):
    conf, pred = probs.max(1)
    keep = conf >= thr
    cov = float(keep.float().mean())
    acc = float((pred[keep] == ys[keep]).float().mean()) if keep.any() else 0.0
    return cov, acc


class Exported(nn.Module):
    """Input: float32 [1,3,224,224] RGB in 0..1. Output: calibrated probabilities [1,5]."""
    def __init__(self, net, temperature):
        super().__init__()
        self.net, self.t = net, temperature
        self.register_buffer("mean", torch.tensor(MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(STD).view(1, 3, 1, 1))
    def forward(self, x):
        return torch.softmax(self.net((x - self.mean) / self.std) / self.t, dim=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--weights", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--epochs", type=int, default=18)
    a = ap.parse_args()
    seed_all(SEED)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    out = Path(a.out)
    (out / "reports").mkdir(parents=True, exist_ok=True)
    (out / "export").mkdir(parents=True, exist_ok=True)

    tr_rows, tr_imgs, tr_y = load_split(a.manifest, "train")
    _, va_imgs, va_y = load_split(a.manifest, "val")
    te_rows, te_imgs, te_y = load_split(a.manifest, "test")
    counts = torch.bincount(tr_y, minlength=len(CLASSES)).float()
    weights = counts.sum() / (len(CLASSES) * counts)

    model = timm.create_model("mobilenetv3_large_100", pretrained=False, num_classes=1000)
    model.load_state_dict(torch.load(a.weights, map_location="cpu"))
    model.reset_classifier(len(CLASSES))

    # Stage 1: train the new head only.
    for p in model.parameters():
        p.requires_grad = False
    for p in model.get_classifier().parameters():
        p.requires_grad = True
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=3e-3, weight_decay=1e-4)
    t0 = time.time()
    for ep in range(3):
        loss = run_epoch(model, opt, tr_imgs, tr_y, weights)
        print(f"head ep{ep+1} loss {loss:.3f} val macroF1 {macro_f1(logits_for(model, va_imgs, va_y), va_y):.3f} ({time.time()-t0:.0f}s)", flush=True)

    # Stage 2: fine-tune everything with early stopping on val macro F1.
    for p in model.parameters():
        p.requires_grad = True
    opt = torch.optim.AdamW(model.parameters(), lr=4e-4, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=a.epochs)
    best, best_state, patience = -1.0, None, 0
    for ep in range(a.epochs):
        loss = run_epoch(model, opt, tr_imgs, tr_y, weights)
        sched.step()
        f1 = macro_f1(logits_for(model, va_imgs, va_y), va_y)
        print(f"full ep{ep+1} loss {loss:.3f} val macroF1 {f1:.3f} ({time.time()-t0:.0f}s)", flush=True)
        if f1 > best:
            best, best_state, patience = f1, {k: v.clone() for k, v in model.state_dict().items()}, 0
        else:
            patience += 1
            if patience >= 5:
                break
    model.load_state_dict(best_state)

    # Calibration and the "unsure" threshold (validation split only).
    va_logits = logits_for(model, va_imgs, va_y)
    temp = fit_temperature(va_logits, va_y)
    va_p_raw, va_p = F.softmax(va_logits, 1), F.softmax(va_logits / temp, 1)
    thr = 0.70
    for cand in np.arange(0.40, 0.951, 0.01):
        cov, acc = selective(va_p, va_y, cand)
        if acc >= 0.90 and cov > 0:
            thr = float(round(cand, 2)); break
    thr = max(thr, 0.70)  # never below the app's 70% floor

    # Test split, evaluated once.
    te_logits = logits_for(model, te_imgs, te_y)
    te_p = F.softmax(te_logits / temp, 1)
    pred = te_p.argmax(1)
    cov, sel_acc = selective(te_p, te_y, thr)
    conf = te_p.max(1).values
    unsure_by_class = {c: round(float((conf[te_y == i] < thr).float().mean()), 3) for i, c in enumerate(CLASSES)}
    report = classification_report(te_y.numpy(), pred.numpy(), target_names=CLASSES, output_dict=True, zero_division=0)
    metrics = {
        "model": "mobilenetv3_large_100 (ImageNet pretrained, fine-tuned)",
        "classes": CLASSES,
        "train_images": int(len(tr_y)), "val_images": int(len(va_y)), "test_images": int(len(te_y)),
        "test_accuracy": round(float((pred == te_y).float().mean()), 4),
        "test_macro_f1": round(float(f1_score(te_y, pred, average="macro")), 4),
        "per_class": {c: {k: round(report[c][k], 3) for k in ("precision", "recall", "f1-score", "support")} for c in CLASSES},
        "confusion_matrix": confusion_matrix(te_y, pred).tolist(),
        "best_val_macro_f1": round(best, 4),
        "temperature": round(temp, 4),
        "ece_val_before": round(ece(va_p_raw, va_y), 4), "ece_val_after": round(ece(va_p, va_y), 4),
        "unsure_threshold": thr,
        "test_coverage": round(cov, 4), "test_selective_accuracy": round(sel_acc, 4),
        "test_unsure_rate_by_class": unsure_by_class,
        "train_seconds": round(time.time() - t0),
    }
    (out / "reports" / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))

    # Export ONNX with normalisation + temperature + softmax baked in.
    model.eval()
    exp = Exported(model, temp).eval()
    dummy = torch.rand(1, 3, SIZE, SIZE)
    onnx_path = out / "export" / "skin_classifier.onnx"
    torch.onnx.export(exp, dummy, str(onnx_path), input_names=["image"], output_names=["probs"], opset_version=17, dynamo=False)
    torch.save(model.state_dict(), out / "reports" / "best_state.pt")
    # Reference outputs for parity checks (first 5 test images, 0..1 inputs).
    ref = []
    for r, im in list(zip(te_rows, te_imgs))[:5]:
        x = T.Compose([T.Resize((SIZE, SIZE)), T.ToTensor()])(Image.open(r["path"]).convert("RGB")).unsqueeze(0)
        with torch.no_grad():
            ref.append({"path": r["path"], "label": r["label"], "probs": [round(float(v), 5) for v in exp(x)[0]]})
    (out / "reports" / "parity_reference.json").write_text(json.dumps(ref, indent=2))
    (out / "export" / "model_meta.json").write_text(json.dumps({
        "version": "skin-v1.0", "input": {"name": "image", "shape": [1, 3, SIZE, SIZE], "range": "0..1 RGB", "resize": "stretch to 224x224, bilinear"},
        "output": {"name": "probs", "classes": CLASSES, "calibrated": True},
        "unsure_threshold": thr, "temperature_baked_in": True,
    }, indent=2))


if __name__ == "__main__":
    main()
