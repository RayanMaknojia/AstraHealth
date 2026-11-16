"""Check for near-duplicates across splits, including rotated and flipped copies."""
import csv, sys
from collections import Counter
import imagehash
from PIL import Image

rows = list(csv.DictReader(open(sys.argv[1])))
thr = int(sys.argv[2]) if len(sys.argv) > 2 else 8

def variants(path):
    im = Image.open(path).convert("RGB")
    out = []
    for flip in (False, True):
        b = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
        for rot in (0, 90, 180, 270):
            out.append(imagehash.phash(b.rotate(rot, expand=True)))
    return out

base = {r["path"]: imagehash.phash(Image.open(r["path"]).convert("RGB")) for r in rows}
train = [r for r in rows if r["split"] == "train"]
hits = Counter()
leaked = []
for r in rows:
    if r["split"] == "train":
        continue
    vs = variants(r["path"])
    best = min(min(v - base[t["path"]] for v in vs) for t in train)
    if best <= thr:
        hits[(r["split"], r["label"])] += 1
        leaked.append(r["path"])
print("val/test images with a rotated/flipped/near copy in train:", sum(hits.values()), "of", sum(1 for r in rows if r["split"] != "train"))
for k, v in sorted(hits.items()):
    print("  ", k, v)
open(sys.argv[1] + ".leaked.txt", "w").write("\n".join(leaked))
