"""Build the skin photo dataset: map folders to app labels, drop broken images,
dedupe across sources with perceptual hashing (rotation and flip aware), split 70/15/15 by duplicate group.

    python build_dataset.py --sources DIR [DIR ...] --out manifest.csv
"""
import argparse, csv, random
from collections import Counter, defaultdict
from pathlib import Path

import imagehash
from PIL import Image

# Source folder name -> app label (src/types SkinLabel). Other folders are ignored.
FOLDER_MAP = {
    "abrasion": "abrasion", "abrasions": "abrasion",
    "bruises": "bruise", "bruise": "bruise",
    "burns": "burn", "burn": "burn",
    "cut": "laceration", "cuts": "laceration", "laceration": "laceration",
    "normal": "normal",
}
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SEED = 42


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="+", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-distance", type=int, default=8)
    a = ap.parse_args()

    rows, dropped = [], Counter()
    for src in a.sources:
        for d in sorted(Path(src).iterdir()):
            if not d.is_dir():
                continue
            label = FOLDER_MAP.get(d.name.lower())
            if not label:
                dropped[d.name] += 1
                continue
            for f in sorted(d.rglob("*")):
                if f.suffix.lower() not in EXTS:
                    continue
                try:
                    with Image.open(f) as im:
                        im = im.convert("RGB")
                        if min(im.size) < 64:
                            dropped["too_small"] += 1
                            continue
                        h = imagehash.phash(im)
                        vs = []
                        for flip in (False, True):
                            b = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
                            for rot in (0, 90, 180, 270):
                                vs.append(imagehash.phash(b.rotate(rot, expand=True)))
                except Exception:
                    dropped["broken"] += 1
                    continue
                rows.append({"path": str(f.resolve()), "label": label, "source": Path(src).name, "source_folder": d.name, "phash": h, "variants": vs})

    # Group near-duplicates (union-find on pHash distance).
    parent = list(range(len(rows)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            # Rotated or flipped copies count as duplicates too.
            if min(v - rows[j]["phash"] for v in rows[i]["variants"]) <= a.max_distance:
                parent[find(i)] = find(j)
    groups = defaultdict(list)
    for i in range(len(rows)):
        groups[find(i)].append(i)

    # Keep one image per group; drop groups whose copies disagree on the label.
    kept, conflicts, dupes = [], 0, 0
    for idxs in groups.values():
        labels = {rows[i]["label"] for i in idxs}
        if len(labels) > 1:
            conflicts += 1
            continue
        dupes += len(idxs) - 1
        kept.append(rows[idxs[0]])

    # Stratified split by label.
    rng = random.Random(SEED)
    by_label = defaultdict(list)
    for r in kept:
        by_label[r["label"]].append(r)
    for label, items in by_label.items():
        rng.shuffle(items)
        n = len(items)
        n_tr, n_va = round(n * 0.70), round(n * 0.15)
        for k, r in enumerate(items):
            r["split"] = "train" if k < n_tr else "val" if k < n_tr + n_va else "test"

    with open(a.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["path", "label", "source", "source_folder", "split", "phash"])
        w.writeheader()
        for r in kept:
            w.writerow({k: (str(v) if k == "phash" else v) for k, v in r.items() if k != "variants"})

    print(f"images read: {len(rows)}  duplicates removed: {dupes}  conflicting groups dropped: {conflicts}  kept: {len(kept)}")
    print("ignored folders / problems:", dict(dropped))
    table = Counter((r["label"], r["split"]) for r in kept)
    for label in sorted(by_label):
        print(f"  {label:11s} train {table[(label,'train')]:4d}  val {table[(label,'val')]:3d}  test {table[(label,'test')]:3d}")


if __name__ == "__main__":
    main()
