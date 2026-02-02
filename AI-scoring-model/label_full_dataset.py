"""
Label full dataset with all 7 facial metrics using OpenAI GPT-4o Vision API.
Based on the production prompt from scorer-node but optimized for full range usage.
"""

import os
import json
import base64
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# ============================================================================
# Configuration
# ============================================================================

LOCAL_ENV = Path(__file__).parent / ".env"
SCORER_ENV = Path(__file__).parent.parent / "scorer-node" / ".env"

if LOCAL_ENV.exists():
    load_dotenv(LOCAL_ENV, override=True)
else:
    load_dotenv(SCORER_ENV, override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError(f"OPENAI_API_KEY not found")

# Paths
IMAGES_DIR = Path(__file__).parent / "Images"
OUTPUT_FILE = Path(__file__).parent / "new_images_scores.json"
PROGRESS_FILE = Path(__file__).parent / "labeling_progress.json"
FINAL_COMBINED_FILE = Path(__file__).parent / "final_combined_dataset.json"
EXISTING_SCORES_FILE = Path(__file__).parent / "complete_scores.json"

# Model config
MODEL = "gpt-4o"
TEMPERATURE = 0.1

# All 7 metrics
ALL_METRICS = [
    "jawline",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "facial_symmetry",
    "skin_quality",
    "sexual_dimorphism",
]

# ============================================================================
# Prompt - Based on production scorer with full range optimization
# ============================================================================

SYSTEM_PROMPT = """
You are a facial structure analysis system for a computer vision training dataset.
Your role is to measure visible facial characteristics and output standardized numerical scores.
This data trains ML models to recognize facial feature patterns - it's technical measurement, not personal judgment.

SCORING PHILOSOPHY:
Each metric measures a specific structural characteristic on a 0-100 continuous scale.
Your scores should reflect the natural distribution of human facial features:
- Some faces have exceptional characteristics (90-100)
- Some faces have strong characteristics (75-89)
- Many faces are average (50-74)
- Some faces have weaker characteristics (30-49)
- Some faces have notably weak characteristics (0-29)

Do NOT cluster all scores in the middle ranges. Real human faces show wide variance.

THE 7 METRICS TO SCORE:

1. JAWLINE (0-100): Mandibular definition and structure
   Evaluate: Edge sharpness, gonial angle definition, chin projection, cervicomental angle
   - 90-100: Exceptionally sharp, well-defined mandibular contour with clear angles
   - 75-89: Clear definition with good projection and visible structure
   - 50-74: Average definition, some softness but structure present
   - 30-49: Soft or rounded, minimal angular definition
   - 0-29: Very soft, undefined, or recessed jaw structure

2. CHEEKBONES (0-100): Zygomatic prominence and midface structure
   Evaluate: Malar projection, highlight continuity, midface contour depth
   - 90-100: Striking zygomatic projection with clear facial contours
   - 75-89: Well-defined cheekbones with good projection
   - 50-74: Moderate presence, average projection
   - 30-49: Flat or minimal cheekbone prominence
   - 0-29: Very flat midface with no visible cheekbone structure

3. EYES_SYMMETRY (0-100): Periorbital balance and alignment
   Evaluate: Palpebral fissure parity, canthal tilt alignment, lid crease consistency
   - 90-100: Near-perfect symmetry in size, shape, and position
   - 75-89: Minor differences only visible on close inspection
   - 50-74: Noticeable but minor asymmetries
   - 30-49: Clear asymmetry in one or more aspects
   - 0-29: Significant asymmetry affecting appearance

4. NOSE_HARMONY (0-100): Nasal proportion and integration with face
   Evaluate: Dorsum straightness, tip definition, width balance, overall proportion
   - 90-100: Excellently proportioned, harmonious with other features
   - 75-89: Well-proportioned with minor imperfections
   - 50-74: Average proportions, some width or shape irregularities
   - 30-49: Noticeable disproportion or irregularity
   - 0-29: Significant disproportion affecting facial harmony

5. FACIAL_SYMMETRY (0-100): Overall left-right balance
   Evaluate: Feature alignment across midline, contour parity, proportional balance
   - 90-100: Exceptional bilateral symmetry across all features
   - 75-89: High symmetry with very minor deviations
   - 50-74: Average symmetry, small noticeable differences
   - 30-49: Multiple visible asymmetries
   - 0-29: Significant overall facial asymmetry

6. SKIN_QUALITY (0-100): Visible skin surface characteristics
   Evaluate: Texture smoothness, tone uniformity, clarity, visible imperfections
   - 90-100: Exceptionally clear, even-toned, smooth appearance
   - 75-89: Smooth with minimal visible texture or imperfections
   - 50-74: Average texture, some visible pores or minor blemishes
   - 30-49: Uneven texture, multiple visible imperfections
   - 0-29: Significant skin texture issues or blemishes

7. SEXUAL_DIMORPHISM (0-100): Expression of gender-typical facial structure
   This measures how strongly the face expresses characteristics typical for their apparent gender.
   FOR MASCULINE PRESENTATION: Angular jaw, brow ridge, wider structure, defined features
   FOR FEMININE PRESENTATION: Softer contours, fuller lips, delicate brow, rounded features
   Score reflects strength of gender-typical expression, NOT a preference for any gender.
   - 90-100: Exceptionally strong gender-typical characteristics
   - 75-89: Clearly defined gender-typical features
   - 50-74: Moderate expression with some mixed characteristics
   - 30-49: Weaker expression, more androgynous features
   - 0-29: Very weak gender-typical expression

CRITICAL INSTRUCTIONS:
1. Score each metric INDEPENDENTLY based on visible evidence
2. Use the FULL 0-100 range - do not artificially cluster scores
3. Different faces WILL have different score distributions
4. Avoid round numbers (multiples of 5 or 10) when possible
5. Base scores purely on visible structural characteristics

OUTPUT FORMAT:
Return ONLY a valid JSON object with exactly 7 integer keys.
No explanation, no text, no markdown - just the JSON object.

Example: {"jawline": 72, "cheekbones": 84, "eyes_symmetry": 68, "nose_harmony": 55, "facial_symmetry": 71, "skin_quality": 89, "sexual_dimorphism": 77}
""".strip()

USER_PROMPT = """Analyze this face and score all 7 metrics. Use the full 0-100 range based on what you observe - exceptional features can score 90+, weak features can score below 30. Return ONLY a JSON object with the 7 scores."""

# ============================================================================
# Helper Functions
# ============================================================================

def encode_image_to_base64(image_path: Path) -> str:
    """Read image and encode to base64 data URL."""
    with open(image_path, "rb") as f:
        data = f.read()

    suffix = image_path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(suffix, "image/jpeg")

    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def parse_scores(raw_response: str) -> dict:
    """Parse JSON response from model."""
    text = raw_response.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
        else:
            raise ValueError(f"Could not parse JSON: {text[:200]}")

    # Validate all 7 keys
    for key in ALL_METRICS:
        if key not in data:
            raise ValueError(f"Missing key '{key}'")
        val = data[key]
        if not isinstance(val, (int, float)):
            raise ValueError(f"Invalid value for '{key}': {val}")
        data[key] = max(0, min(100, round(float(val))))

    return {k: data[k] for k in ALL_METRICS}


def score_image(client: OpenAI, image_path: Path, max_retries: int = 3) -> dict:
    """Score a single image for all 7 metrics."""
    data_url = encode_image_to_base64(image_path)

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                temperature=TEMPERATURE,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": USER_PROMPT},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
            )

            raw = response.choices[0].message.content
            scores = parse_scores(raw)
            return scores

        except Exception as e:
            print(f"  Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def load_progress() -> dict:
    """Load progress file if exists."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed": {}, "failed": []}


def save_progress(progress: dict):
    """Save progress to file."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)


def save_output(scores: dict, failed: list):
    """Save scores to output file."""
    data_list = []
    for filename in sorted(scores.keys()):
        record = {"image": filename}
        record.update(scores[filename])
        data_list.append(record)

    output = {
        "metadata": {
            "description": "Full 7-metric facial scores from Images folder",
            "metrics": ALL_METRICS,
            "score_range": "0-100",
            "total_images": len(data_list),
            "failed_images": len(failed),
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "model": MODEL,
        },
        "scores": scores,
        "data": data_list,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)


def get_all_images(directory: Path, prefix_filter: str = None) -> list:
    """Recursively get all images from directory (deduplicated)."""
    seen = set()
    images = []
    for ext in ["*.jpg", "*.jpeg", "*.png"]:
        for img in directory.rglob(ext):
            # Use lowercase name to avoid duplicates on case-insensitive systems
            key = str(img.resolve()).lower()
            if key not in seen:
                # Apply prefix filter if specified
                if prefix_filter and not img.name.upper().startswith(prefix_filter.upper()):
                    continue
                seen.add(key)
                images.append(img)
    return sorted(images, key=lambda x: x.name.lower())


def combine_datasets():
    """Combine new scores with existing complete_scores.json."""
    print("\nCombining datasets...")

    combined_scores = {}

    # Load existing scores
    if EXISTING_SCORES_FILE.exists():
        with open(EXISTING_SCORES_FILE, "r") as f:
            existing = json.load(f)
        for filename, scores in existing.get("scores", {}).items():
            combined_scores[f"normalized_dataset/{filename}"] = scores
        print(f"  Loaded {len(existing.get('scores', {}))} existing scores")

    # Load new scores
    if OUTPUT_FILE.exists():
        with open(OUTPUT_FILE, "r") as f:
            new_data = json.load(f)
        for filename, scores in new_data.get("scores", {}).items():
            combined_scores[filename] = scores
        print(f"  Loaded {len(new_data.get('scores', {}))} new scores")

    # Create combined output
    data_list = []
    for filename in sorted(combined_scores.keys()):
        record = {"image": filename}
        record.update(combined_scores[filename])
        data_list.append(record)

    combined = {
        "metadata": {
            "description": "Combined facial scores dataset for ML training",
            "metrics": ALL_METRICS,
            "score_range": "0-100",
            "total_images": len(data_list),
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        },
        "scores": combined_scores,
        "data": data_list,
    }

    with open(FINAL_COMBINED_FILE, "w") as f:
        json.dump(combined, f, indent=2)

    print(f"  Combined dataset saved: {len(data_list)} total images")
    print(f"  Output: {FINAL_COMBINED_FILE}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 70)
    print("Full Dataset Labeling - 7 Metrics")
    print("=" * 70)

    client = OpenAI(api_key=OPENAI_API_KEY)

    # Get all images (filter by prefix if needed - set to None for all images)
    PREFIX_FILTER = "CM"  # Only process images starting with "CM" (set to None for all)

    print(f"\nScanning: {IMAGES_DIR}")
    if PREFIX_FILTER:
        print(f"Filter: Only images starting with '{PREFIX_FILTER}'")
    all_images = get_all_images(IMAGES_DIR, prefix_filter=PREFIX_FILTER)
    print(f"Found {len(all_images)} images")

    # Load progress
    progress = load_progress()
    completed = progress["completed"]
    failed = progress.get("failed", [])
    print(f"Already completed: {len(completed)}")

    # Filter remaining (use relative path as key)
    remaining = [img for img in all_images if str(img.relative_to(IMAGES_DIR)).replace("\\", "/") not in completed]
    print(f"Remaining to process: {len(remaining)}")

    if not remaining:
        print("\nAll images already processed!")
        combine_datasets()
        return

    print("-" * 70)

    # Process images
    start_time = time.time()

    for i, image_path in enumerate(remaining):
        # Use relative path as key to handle same-name files in different folders
        rel_path = str(image_path.relative_to(IMAGES_DIR)).replace("\\", "/")

        print(f"[{i+1}/{len(remaining)}] {rel_path}", end=" ... ", flush=True)

        try:
            scores = score_image(client, image_path)
            completed[rel_path] = scores

            # Show all 7 scores in compact format
            s = scores
            print(f"jaw={s['jawline']} chk={s['cheekbones']} eye={s['eyes_symmetry']} nose={s['nose_harmony']} sym={s['facial_symmetry']} skin={s['skin_quality']} dim={s['sexual_dimorphism']}")

            # Save progress every 50 images
            if (i + 1) % 50 == 0:
                save_progress({"completed": completed, "failed": failed})
                save_output(completed, failed)
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed * 3600
                print(f"  [Saved progress: {len(completed)} done, {rate:.0f}/hr]")

            # Rate limiting
            time.sleep(0.3)

        except Exception as e:
            print(f"FAILED - {e}")
            if filename not in failed:
                failed.append(filename)

    # Final save
    save_progress({"completed": completed, "failed": failed})
    save_output(completed, failed)

    # Combine datasets
    combine_datasets()

    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print("COMPLETE")
    print("=" * 70)
    print(f"Processed: {len(completed)} images")
    print(f"Failed: {len(failed)} images")
    print(f"Time: {elapsed/3600:.1f} hours")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Combined: {FINAL_COMBINED_FILE}")

    if failed:
        print(f"\nFailed images: {failed[:10]}{'...' if len(failed) > 10 else ''}")


if __name__ == "__main__":
    main()
