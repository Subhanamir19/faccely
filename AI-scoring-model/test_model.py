"""
Test script for the facial scoring ML model.
Tests the model on validation images and compares predictions with ground truth.
"""

import os
import json
import random
from pathlib import Path
from PIL import Image
import torch
import torch.nn as nn
from torchvision import transforms
import timm

# ============================================================================
# Configuration (must match train_model.py)
# ============================================================================

BASE_DIR = Path(__file__).parent
TRAINING_DIR = BASE_DIR / "training_data"
IMAGES_DIR = TRAINING_DIR / "images"
SCORES_FILE = TRAINING_DIR / "scores.json"
MODEL_PATH = BASE_DIR / "model_output" / "best_model.pth"

MODEL_NAME = "efficientnet_b0"
IMAGE_SIZE = 224
NUM_METRICS = 7
METRICS = [
    "jawline",
    "cheekbones",
    "eyes_symmetry",
    "nose_harmony",
    "facial_symmetry",
    "skin_quality",
    "sexual_dimorphism",
]

# ============================================================================
# Model (same as train_model.py)
# ============================================================================

class FacialScoreModel(nn.Module):
    """EfficientNet-B0 with 7 regression outputs."""

    def __init__(self, pretrained=False):
        super().__init__()

        self.backbone = timm.create_model(
            MODEL_NAME,
            pretrained=pretrained,
            num_classes=0,
        )

        self.feature_dim = self.backbone.num_features

        self.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(self.feature_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, NUM_METRICS),
            nn.Sigmoid(),
        )

    def forward(self, x):
        features = self.backbone(x)
        return self.head(features)

# ============================================================================
# Test Functions
# ============================================================================

def get_inference_transform():
    """Get inference transforms (no augmentation)."""
    return transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        ),
    ])


def load_model(model_path, device):
    """Load the trained model."""
    print(f"Loading model from: {model_path}")

    model = FacialScoreModel(pretrained=False)
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()

    print(f"Model loaded from epoch {checkpoint['epoch'] + 1}")
    print(f"Validation MAE from training:")
    for i, metric in enumerate(METRICS):
        print(f"  {metric}: {checkpoint['val_mae'][i]:.2f}")

    return model


def predict_single_image(model, image_path, transform, device):
    """Predict scores for a single image."""
    image = Image.open(image_path).convert("RGB")
    image_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(image_tensor)

    # Convert to 0-100 scale
    scores = (output.squeeze().cpu().numpy() * 100).tolist()
    return {metric: round(score, 1) for metric, score in zip(METRICS, scores)}


def run_tests(num_samples=20):
    """Run tests on random samples from the dataset."""
    print("=" * 70)
    print("FACIAL SCORING MODEL - TEST SUITE")
    print("=" * 70)

    # Check if model exists
    if not MODEL_PATH.exists():
        print(f"\nERROR: Model not found at {MODEL_PATH}")
        print("Please train the model first by running: python train_model.py")
        return False

    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nDevice: {device}")

    # Load model
    model = load_model(MODEL_PATH, device)
    transform = get_inference_transform()

    # Load ground truth scores
    print(f"\nLoading ground truth from: {SCORES_FILE}")
    with open(SCORES_FILE, "r") as f:
        data = json.load(f)
    scores_dict = data["scores"]

    # Get available images
    image_files = [f for f in IMAGES_DIR.glob("*.jpg") if f.name in scores_dict]
    image_files += [f for f in IMAGES_DIR.glob("*.png") if f.name in scores_dict]

    print(f"Total images available: {len(image_files)}")

    # Sample random images for testing
    random.seed(42)
    test_images = random.sample(image_files, min(num_samples, len(image_files)))
    print(f"Testing on {len(test_images)} random samples\n")

    # Run predictions and compare
    print("-" * 70)
    total_errors = {metric: 0 for metric in METRICS}
    max_errors = {metric: 0 for metric in METRICS}

    results = []

    for i, img_path in enumerate(test_images):
        filename = img_path.name
        ground_truth = scores_dict[filename]
        predictions = predict_single_image(model, img_path, transform, device)

        # Calculate errors
        errors = {}
        for metric in METRICS:
            gt = ground_truth.get(metric, 50)
            pred = predictions[metric]
            error = abs(gt - pred)
            errors[metric] = error
            total_errors[metric] += error
            max_errors[metric] = max(max_errors[metric], error)

        avg_error = sum(errors.values()) / len(errors)
        results.append({
            "filename": filename,
            "avg_error": avg_error,
            "predictions": predictions,
            "ground_truth": ground_truth,
            "errors": errors
        })

        # Print sample result
        print(f"\nSample {i+1}: {filename}")
        print(f"{'Metric':<20} {'Ground Truth':>12} {'Prediction':>12} {'Error':>8}")
        print("-" * 55)
        for metric in METRICS:
            gt = ground_truth.get(metric, 50)
            pred = predictions[metric]
            err = errors[metric]
            status = "OK" if err < 10 else "WARN" if err < 15 else "BAD"
            print(f"{metric:<20} {gt:>12.1f} {pred:>12.1f} {err:>7.1f} {status}")
        print(f"{'Average Error':<20} {'':<12} {'':<12} {avg_error:>7.1f}")

    # Summary statistics
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    print(f"\n{'Metric':<20} {'Mean Error':>12} {'Max Error':>12}")
    print("-" * 45)

    all_passed = True
    for metric in METRICS:
        mean_error = total_errors[metric] / len(test_images)
        max_error = max_errors[metric]
        status = "PASS" if mean_error < 10 else "WARN" if mean_error < 15 else "FAIL"
        if status == "FAIL":
            all_passed = False
        print(f"{metric:<20} {mean_error:>11.2f} {max_error:>11.2f}  [{status}]")

    overall_mean = sum(total_errors.values()) / (len(METRICS) * len(test_images))
    print("-" * 45)
    print(f"{'Overall':<20} {overall_mean:>11.2f}")

    # Final verdict
    print("\n" + "=" * 70)
    if overall_mean < 8:
        print("[PASS] TEST PASSED - Model performs excellently (MAE < 8)")
        test_passed = True
    elif overall_mean < 10:
        print("[PASS] TEST PASSED - Model performs well (MAE < 10)")
        test_passed = True
    elif overall_mean < 12:
        print("[WARN] TEST WARNING - Model performs acceptably (MAE < 12)")
        test_passed = True
    else:
        print("[FAIL] TEST FAILED - Model needs improvement (MAE >= 12)")
        test_passed = False

    print(f"Overall Mean Absolute Error: {overall_mean:.2f} points (on 0-100 scale)")
    print("=" * 70)

    return test_passed


def test_single_image(image_path):
    """Test prediction on a specific image."""
    print("=" * 70)
    print("SINGLE IMAGE TEST")
    print("=" * 70)

    image_path = Path(image_path)
    if not image_path.exists():
        print(f"ERROR: Image not found: {image_path}")
        return None

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_model(MODEL_PATH, device)
    transform = get_inference_transform()

    predictions = predict_single_image(model, image_path, transform, device)

    print(f"\nImage: {image_path.name}")
    print("-" * 40)
    for metric, score in predictions.items():
        print(f"{metric:<20}: {score:>6.1f}")

    return predictions


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Test specific image
        test_single_image(sys.argv[1])
    else:
        # Run full test suite
        success = run_tests(num_samples=20)
        sys.exit(0 if success else 1)
