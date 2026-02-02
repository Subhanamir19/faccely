"""
Organize all scored images into a clean training_data folder.
Copies images and creates a unified scores file for ML training.
"""

import json
import shutil
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
TRAINING_DIR = BASE_DIR / "training_data"
IMAGES_SUBDIR = TRAINING_DIR / "images"

# Source files
ORIGINAL_SCORES = BASE_DIR / "complete_scores.json"
NEW_SCORES = BASE_DIR / "new_images_scores.json"
PROGRESS_FILE = BASE_DIR / "labeling_progress.json"

# Source image folders
NORMALIZED_DIR = BASE_DIR / "normalized_dataset"
IMAGES_DIR = BASE_DIR / "Images"

# Output
FINAL_SCORES_FILE = TRAINING_DIR / "scores.json"
FINAL_CSV_FILE = TRAINING_DIR / "scores.csv"

ALL_METRICS = [
    "jawline",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "facial_symmetry",
    "skin_quality",
    "sexual_dimorphism",
]


def main():
    print("=" * 60)
    print("Organizing Training Data")
    print("=" * 60)

    # Create directories
    TRAINING_DIR.mkdir(exist_ok=True)
    IMAGES_SUBDIR.mkdir(exist_ok=True)

    all_scores = {}
    copied = 0
    skipped = 0

    # 1. Load original 429 scores
    print("\n1. Loading original scores...")
    if ORIGINAL_SCORES.exists():
        with open(ORIGINAL_SCORES, "r") as f:
            data = json.load(f)
        for filename, scores in data.get("scores", {}).items():
            # Check if has all 7 metrics
            if all(m in scores for m in ALL_METRICS):
                all_scores[filename] = scores
        print(f"   Loaded {len(all_scores)} from complete_scores.json")

    # 2. Load new scores (from progress file for most up-to-date)
    print("\n2. Loading new image scores...")
    new_count = 0
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            progress = json.load(f)
        for rel_path, scores in progress.get("completed", {}).items():
            if all(m in scores for m in ALL_METRICS):
                # Use just filename as key (strip folder path)
                filename = Path(rel_path).name
                all_scores[f"new_{filename}"] = scores
                new_count += 1
    print(f"   Loaded {new_count} from new images")

    print(f"\n   TOTAL: {len(all_scores)} images with complete scores")

    # 3. Copy images to training folder
    print("\n3. Copying images to training_data/images/...")

    for key, scores in all_scores.items():
        # Determine source path
        if key.startswith("new_"):
            # New image - find in Images folder
            original_name = key[4:]  # Remove "new_" prefix
            # Search for file
            matches = list(IMAGES_DIR.rglob(original_name))
            if matches:
                src = matches[0]
            else:
                print(f"   WARNING: Could not find {original_name}")
                skipped += 1
                continue
            dest_name = original_name
        else:
            # Original image - in normalized_dataset
            src = NORMALIZED_DIR / key
            dest_name = key

        dest = IMAGES_SUBDIR / dest_name

        if src.exists():
            if not dest.exists():
                shutil.copy2(src, dest)
                copied += 1
            # Update key to match destination filename
            all_scores[key] = scores
        else:
            print(f"   WARNING: Source not found: {src}")
            skipped += 1

    print(f"   Copied: {copied} images")
    print(f"   Skipped: {skipped} images")

    # 4. Create clean scores file
    print("\n4. Creating scores files...")

    # Remap keys to just filenames
    clean_scores = {}
    for key, scores in all_scores.items():
        if key.startswith("new_"):
            filename = key[4:]
        else:
            filename = key
        clean_scores[filename] = scores

    # JSON format
    data_list = []
    for filename in sorted(clean_scores.keys()):
        record = {"image": filename}
        record.update(clean_scores[filename])
        data_list.append(record)

    output = {
        "metadata": {
            "description": "Complete training dataset with 7 facial metrics",
            "metrics": ALL_METRICS,
            "score_range": "0-100",
            "total_images": len(data_list),
        },
        "scores": clean_scores,
        "data": data_list,
    }

    with open(FINAL_SCORES_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"   Saved: {FINAL_SCORES_FILE}")

    # CSV format (easier for some ML frameworks)
    with open(FINAL_CSV_FILE, "w") as f:
        header = ["image"] + ALL_METRICS
        f.write(",".join(header) + "\n")
        for record in data_list:
            row = [record["image"]] + [str(record[m]) for m in ALL_METRICS]
            f.write(",".join(row) + "\n")
    print(f"   Saved: {FINAL_CSV_FILE}")

    # Summary
    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"Training data folder: {TRAINING_DIR}")
    print(f"Images: {IMAGES_SUBDIR} ({len(data_list)} files)")
    print(f"Scores JSON: {FINAL_SCORES_FILE}")
    print(f"Scores CSV: {FINAL_CSV_FILE}")


if __name__ == "__main__":
    main()
