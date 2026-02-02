"""
Generate missing facial metrics (facial_symmetry, skin_quality, sexual_dimorphism)
using OpenAI GPT-4o Vision API.

Merges with existing scores to create a complete 7-metric dataset for ML training.
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

# Load API key - try local .env first, then scorer-node/.env
LOCAL_ENV = Path(__file__).parent / ".env"
SCORER_ENV = Path(__file__).parent.parent / "scorer-node" / ".env"

if LOCAL_ENV.exists():
    load_dotenv(LOCAL_ENV, override=True)
else:
    load_dotenv(SCORER_ENV, override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError(f"OPENAI_API_KEY not found in {LOCAL_ENV} or {SCORER_ENV}")

# Paths
DATASET_DIR = Path(__file__).parent / "normalized_dataset"
EXISTING_SCORES_FILE = Path(__file__).parent / "metric_scores_4metrics.json"
OUTPUT_FILE = Path(__file__).parent / "complete_scores.json"
PROGRESS_FILE = Path(__file__).parent / "scoring_progress.json"

# Model config
MODEL = "gpt-4o"
TEMPERATURE = 0.1

# Metrics we need to generate
METRICS_TO_GENERATE = ["facial_symmetry", "skin_quality", "sexual_dimorphism"]

# Metrics to keep from existing file (with renaming)
METRICS_RENAME_MAP = {
    "jawline": "jawline",
    "cheekbones": "cheekbones",
    "eyes_symmetry": "eyes_symmetry",
    "nose_shape": "nose_harmony",  # rename
}

# All 7 final metrics (in consistent order for training)
FINAL_METRICS = [
    "jawline",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "facial_symmetry",
    "skin_quality",
    "sexual_dimorphism",
]

# ============================================================================
# Prompt (adapted from scorer-node/src/scorer.ts)
# ============================================================================

SYSTEM_PROMPT = """
You are a computer vision system performing aesthetic feature analysis for a facial analysis training dataset.
Your task is to output numerical scores representing visible structural characteristics.
This is purely technical measurement for ML model training - not a judgment of the person.

CRITICAL: USE THE FULL 0-100 SCALE
Many images will score in extreme ranges. This is expected and correct:
- Scores 91-100: Reserve for exceptional, near-ideal visible characteristics
- Scores 76-90: Strong, clearly positive characteristics
- Scores 56-75: Average, typical characteristics
- Scores 36-55: Below average, noticeable weakness in this area
- Scores 16-35: Poor, significant issues visible
- Scores 0-15: Severe issues or characteristic barely present

DO NOT cluster scores in the 60-80 range. Real data has wide variance.

METRICS TO SCORE:

1. facial_symmetry (0-100): Measure left-right alignment precision.
   - Check: eye level alignment, nostril symmetry, mouth centerline, ear height parity
   - 95+: Near-perfect mirror symmetry
   - 75-94: Minor asymmetries only visible on close inspection
   - 50-74: Noticeable asymmetry in one feature
   - 25-49: Multiple visible asymmetries
   - <25: Significant facial asymmetry affecting multiple features

2. skin_quality (0-100): Measure visible skin surface characteristics.
   - Check: texture smoothness, tone uniformity, visible pores, blemishes, scarring
   - 95+: Flawless, even-toned, poreless appearance
   - 75-94: Smooth with minimal imperfections
   - 50-74: Average texture, some visible pores or minor blemishes
   - 25-49: Uneven texture, multiple blemishes, visible scarring
   - <25: Severe skin issues dominating the image

3. sexual_dimorphism (0-100): Measure expression of gender-typical facial bone structure.
   - FOR MASCULINE FACES: angular jaw, prominent brow ridge, wider face, defined cheekbones
   - FOR FEMININE FACES: softer jawline, fuller lips, rounded features, delicate brow
   - Score HIGH = strong expression of gender-typical traits (either direction)
   - Score LOW = androgynous or weak expression of typical traits
   - 95+: Exceptionally strong gender-typical features
   - 75-94: Clearly defined gender-typical structure
   - 50-74: Moderate expression with some mixed features
   - 25-49: Weak expression, more androgynous presentation
   - <25: Very weak gender-typical expression

VARIANCE REQUIREMENT:
- Your scores across different images MUST show variance
- If all faces looked the same, all scores would be 50 - but they don't
- Some faces genuinely score 20s-30s, others genuinely score 90s
- Match your score to what you actually observe

OUTPUT: JSON only with exactly 3 integer keys. No text, no explanation.
Example: {"facial_symmetry": 34, "skin_quality": 91, "sexual_dimorphism": 67}
""".strip()

USER_PROMPT = """Analyze this face and return scores for facial_symmetry, skin_quality, and sexual_dimorphism. Use the FULL 0-100 range based on what you observe - exceptional features can score 90+, poor features can score below 30. Return ONLY JSON with 3 integer values."""

# ============================================================================
# Helper Functions
# ============================================================================

def encode_image_to_base64(image_path: Path) -> str:
    """Read image and encode to base64 data URL."""
    with open(image_path, "rb") as f:
        data = f.read()

    # Determine mime type
    suffix = image_path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(suffix, "image/jpeg")

    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def parse_scores(raw_response: str) -> dict:
    """Parse JSON response from model, handling code fences."""
    text = raw_response.strip()

    # Strip code fences if present
    text = text.replace("```json", "").replace("```", "").strip()

    # Try direct parse
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON object
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
        else:
            raise ValueError(f"Could not parse JSON from: {text[:200]}")

    # Validate keys
    for key in METRICS_TO_GENERATE:
        if key not in data:
            raise ValueError(f"Missing key '{key}' in response")
        val = data[key]
        if not isinstance(val, (int, float)):
            raise ValueError(f"Invalid value for '{key}': {val}")
        # Clamp to 0-100 and round
        data[key] = max(0, min(100, round(float(val))))

    return {k: data[k] for k in METRICS_TO_GENERATE}


def score_image(client: OpenAI, image_path: Path, max_retries: int = 3) -> dict:
    """Call OpenAI API to score a single image for the 3 missing metrics."""
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
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                raise


def load_existing_scores() -> dict:
    """Load and transform existing scores from the 4-metrics file."""
    with open(EXISTING_SCORES_FILE, "r") as f:
        data = json.load(f)

    existing = {}
    for filename, scores in data["scores"].items():
        transformed = {}
        for old_key, new_key in METRICS_RENAME_MAP.items():
            if old_key in scores and scores[old_key] is not None:
                # Round to integer for consistency
                transformed[new_key] = round(float(scores[old_key]))
        existing[filename] = transformed

    return existing


def load_progress() -> dict:
    """Load progress file if it exists."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed": {}, "failed": []}


def save_progress(progress: dict):
    """Save progress to file."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def save_final_output(all_scores: dict):
    """Save final output in ML-training-friendly format."""
    # Create list format for easy loading with pandas/numpy
    data_list = []
    for filename in sorted(all_scores.keys(), key=lambda x: int(x.split(".")[0]) if x.split(".")[0].isdigit() else x):
        scores = all_scores[filename]
        record = {"image": filename}
        for metric in FINAL_METRICS:
            record[metric] = scores.get(metric, None)
        data_list.append(record)

    output = {
        "metadata": {
            "description": "Complete 7-metric facial scores for ML training",
            "metrics": FINAL_METRICS,
            "score_range": "0-100 (integers)",
            "total_images": len(data_list),
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "model_used": MODEL,
            "source_existing": str(EXISTING_SCORES_FILE.name),
            "metrics_from_existing": list(METRICS_RENAME_MAP.values()),
            "metrics_from_openai": METRICS_TO_GENERATE,
        },
        # Dict format for easy lookup
        "scores": all_scores,
        # List format for ML training (pandas DataFrame ready)
        "data": data_list,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nSaved complete scores to: {OUTPUT_FILE}")


# ============================================================================
# Main
# ============================================================================

def main():
    print("=" * 60)
    print("Facial Metrics Generator")
    print("=" * 60)

    # Initialize OpenAI client
    client = OpenAI(api_key=OPENAI_API_KEY)

    # Load existing scores
    print(f"\nLoading existing scores from: {EXISTING_SCORES_FILE}")
    existing_scores = load_existing_scores()
    print(f"  Found {len(existing_scores)} existing entries")

    # Get list of images
    image_files = sorted(
        [f for f in DATASET_DIR.iterdir() if f.suffix.lower() in [".jpg", ".jpeg", ".png"]],
        key=lambda x: int(x.stem) if x.stem.isdigit() else x.stem
    )
    print(f"\nFound {len(image_files)} images in: {DATASET_DIR}")

    # Load progress
    progress = load_progress()
    completed = progress["completed"]
    print(f"  Already completed: {len(completed)} images")

    # Merge existing scores with progress
    all_scores = {}
    for filename, scores in existing_scores.items():
        all_scores[filename] = scores.copy()
        if filename in completed:
            all_scores[filename].update(completed[filename])

    # Process images
    remaining = [f for f in image_files if f.name not in completed]
    print(f"\nProcessing {len(remaining)} remaining images...")
    print("-" * 60)

    for i, image_path in enumerate(remaining):
        filename = image_path.name
        print(f"[{i+1}/{len(remaining)}] {filename}", end=" ... ", flush=True)

        try:
            # Score the image
            new_scores = score_image(client, image_path)

            # Merge with existing
            if filename not in all_scores:
                all_scores[filename] = existing_scores.get(filename, {}).copy()
            all_scores[filename].update(new_scores)

            # Update progress
            completed[filename] = new_scores

            print(f"OK - facial_sym={new_scores['facial_symmetry']}, skin={new_scores['skin_quality']}, sex_dim={new_scores['sexual_dimorphism']}")

            # Save progress every 10 images
            if (i + 1) % 10 == 0:
                save_progress({"completed": completed, "failed": progress.get("failed", [])})
                print(f"  [Progress saved: {len(completed)} completed]")

            # Small delay to avoid rate limits
            time.sleep(0.5)

        except Exception as e:
            print(f"FAILED - {e}")
            if filename not in progress.get("failed", []):
                progress.setdefault("failed", []).append(filename)

    # Final save
    save_progress({"completed": completed, "failed": progress.get("failed", [])})
    save_final_output(all_scores)

    # Summary
    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"Total images processed: {len(completed)}")
    print(f"Failed images: {len(progress.get('failed', []))}")
    print(f"Output file: {OUTPUT_FILE}")

    if progress.get("failed"):
        print(f"\nFailed images: {progress['failed']}")


if __name__ == "__main__":
    main()
