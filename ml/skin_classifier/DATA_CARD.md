# Data Card: Skin Photo Dataset

## Sources

| Source | Link | License | Folders used |
|---|---|---|---|
| Wound detection and diagnosis (RucksikaaR) | https://github.com/RucksikaaR/Wound-detection-and-diagnosis | GPL-3.0 (repository license) | Abrasion, Bruises, Burns, Cuts, Laceration, Normal |
| Surgicare ALB (PogusTheWhisper) | https://github.com/PogusTheWhisper/Surgicare-ALB | No license file | Abrasions, Bruises, Burns, Cut, Normal |

Both sets were originally collected from the internet. Chronic wound folders (diabetic, pressure, venous, surgical) were not used, because they don't match injuries in a spacecraft.

**The photos are not committed to this repo.** Only the trained model is. Download the photos with the commands in README.md.

## Label mapping

| Source folder | App label |
|---|---|
| Abrasion, Abrasions | `abrasion` |
| Bruises | `bruise` |
| Burns | `burn` |
| Cut, Cuts, Laceration | `laceration` |
| Normal | `normal` |

## Cleaning

| Step | Count |
|---|---|
| Photos read | 1,213 |
| Too small (under 64 px) | 3 removed |
| Duplicates removed (same photo, or a rotated or flipped copy, pHash distance ≤ 8) | 751 |
| **Unique photos kept** | **462** |

## Split (70 / 15 / 15, stratified, seed 42)

| Class | Train | Val | Test |
|---|---|---|---|
| Abrasion | 56 | 12 | 12 |
| Bruise | 76 | 16 | 16 |
| Burn | 47 | 10 | 10 |
| Laceration | 76 | 16 | 16 |
| Normal | 69 | 15 | 15 |
| **Total** | **324** | **69** | **69** |

## Known gaps

* Small: 462 unique photos. More data is the best way to improve the model
* No photos taken in space or under spacecraft lighting
* Skin tone range is not documented and is likely uneven
* Internet photos vary in quality, and some may be mislabelled
