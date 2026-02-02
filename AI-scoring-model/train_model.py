"""
Train facial scoring model using EfficientNet-B0 backbone.
Optimized for ~1,200 image dataset with 7 regression outputs.
"""

import os
import json
import random
import numpy as np
from pathlib import Path
from PIL import Image
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import timm

# ============================================================================
# Configuration
# ============================================================================

# Paths
BASE_DIR = Path(__file__).parent
TRAINING_DIR = BASE_DIR / "training_data"
IMAGES_DIR = TRAINING_DIR / "images"
SCORES_FILE = TRAINING_DIR / "scores.json"
OUTPUT_DIR = BASE_DIR / "model_output"

# Model config
MODEL_NAME = "efficientnet_b0"  # Good balance of accuracy and size for ~1K images
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

# Training config
BATCH_SIZE = 16
NUM_EPOCHS = 100
LEARNING_RATE = 1e-4
WEIGHT_DECAY = 1e-4
PATIENCE = 15  # Early stopping patience
VAL_SPLIT = 0.2

# Reproducibility
SEED = 42

def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

# ============================================================================
# Dataset
# ============================================================================

class FacialScoreDataset(Dataset):
    def __init__(self, image_paths, scores_dict, transform=None):
        self.image_paths = image_paths
        self.scores_dict = scores_dict
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        filename = img_path.name

        # Load image
        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)

        # Get scores (normalized to 0-1)
        scores = self.scores_dict.get(filename, {})
        labels = torch.tensor(
            [scores.get(m, 50) / 100.0 for m in METRICS],
            dtype=torch.float32
        )

        return image, labels, filename

# ============================================================================
# Model
# ============================================================================

class FacialScoreModel(nn.Module):
    """EfficientNet-B0 with 7 regression outputs."""

    def __init__(self, pretrained=True):
        super().__init__()

        # Load pretrained backbone
        self.backbone = timm.create_model(
            MODEL_NAME,
            pretrained=pretrained,
            num_classes=0,  # Remove classifier
        )

        # Get feature dimension
        self.feature_dim = self.backbone.num_features

        # Regression head
        self.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(self.feature_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, NUM_METRICS),
            nn.Sigmoid(),  # Output 0-1 range
        )

    def forward(self, x):
        features = self.backbone(x)
        return self.head(features)

# ============================================================================
# Training Functions
# ============================================================================

def get_transforms(is_training=True):
    """Get data transforms with augmentation for training."""
    if is_training:
        return transforms.Compose([
            transforms.Resize((IMAGE_SIZE + 32, IMAGE_SIZE + 32)),
            transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(15),
            transforms.ColorJitter(
                brightness=0.2,
                contrast=0.2,
                saturation=0.2,
                hue=0.1
            ),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])


def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0

    for images, labels, _ in loader:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)

    return total_loss / len(loader.dataset)


def validate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for images, labels, _ in loader:
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * images.size(0)
            all_preds.append(outputs.cpu())
            all_labels.append(labels.cpu())

    all_preds = torch.cat(all_preds)
    all_labels = torch.cat(all_labels)

    # Calculate per-metric MAE (in 0-100 scale)
    mae_per_metric = (all_preds - all_labels).abs().mean(dim=0) * 100

    return total_loss / len(loader.dataset), mae_per_metric


def plot_training_history(history, output_path):
    """Plot training curves."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    # Loss
    axes[0].plot(history["train_loss"], label="Train")
    axes[0].plot(history["val_loss"], label="Validation")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].set_title("Training Loss")
    axes[0].legend()
    axes[0].grid(True)

    # Per-metric MAE
    for i, metric in enumerate(METRICS):
        axes[1].plot([h[i] for h in history["val_mae"]], label=metric)
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("MAE (0-100 scale)")
    axes[1].set_title("Validation MAE per Metric")
    axes[1].legend(loc="upper right", fontsize=8)
    axes[1].grid(True)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"Saved training plot: {output_path}")


# ============================================================================
# Main Training
# ============================================================================

def main():
    print("=" * 70)
    print("Facial Score Model Training")
    print("=" * 70)

    set_seed(SEED)
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\nDevice: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # Load data
    print(f"\nLoading data from: {SCORES_FILE}")
    with open(SCORES_FILE, "r") as f:
        data = json.load(f)
    scores_dict = data["scores"]

    # Get image paths
    image_paths = [p for p in IMAGES_DIR.glob("*.jpg") if p.name in scores_dict]
    image_paths += [p for p in IMAGES_DIR.glob("*.png") if p.name in scores_dict]
    print(f"Found {len(image_paths)} images with scores")

    if len(image_paths) == 0:
        print("ERROR: No images found!")
        return

    # Split train/val
    random.shuffle(image_paths)
    split_idx = int(len(image_paths) * (1 - VAL_SPLIT))
    train_paths = image_paths[:split_idx]
    val_paths = image_paths[split_idx:]
    print(f"Train: {len(train_paths)}, Validation: {len(val_paths)}")

    # Create datasets
    train_dataset = FacialScoreDataset(
        train_paths, scores_dict, transform=get_transforms(is_training=True)
    )
    val_dataset = FacialScoreDataset(
        val_paths, scores_dict, transform=get_transforms(is_training=False)
    )

    train_loader = DataLoader(
        train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=True
    )

    # Create model
    print(f"\nCreating model: {MODEL_NAME}")
    model = FacialScoreModel(pretrained=True)
    model = model.to(device)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")

    # Loss and optimizer
    criterion = nn.L1Loss()  # MAE loss - more robust for regression
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )

    # Training history
    history = {"train_loss": [], "val_loss": [], "val_mae": []}
    best_val_loss = float("inf")
    patience_counter = 0

    print(f"\nStarting training for {NUM_EPOCHS} epochs...")
    print("-" * 70)

    for epoch in range(NUM_EPOCHS):
        # Train
        train_loss = train_epoch(model, train_loader, criterion, optimizer, device)

        # Validate
        val_loss, val_mae = validate(model, val_loader, criterion, device)

        # Update scheduler
        scheduler.step(val_loss)

        # Record history
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_mae"].append(val_mae.tolist())

        # Print progress
        avg_mae = val_mae.mean().item()
        lr = optimizer.param_groups[0]["lr"]
        print(
            f"Epoch {epoch+1:3d}/{NUM_EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_loss:.4f} | "
            f"Val MAE: {avg_mae:.2f} | "
            f"LR: {lr:.2e}"
        )

        # Check for improvement
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0

            # Save best model
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": val_loss,
                "val_mae": val_mae.tolist(),
            }, OUTPUT_DIR / "best_model.pth")
            print(f"  -> Saved best model (MAE: {avg_mae:.2f})")
        else:
            patience_counter += 1

        # Early stopping
        if patience_counter >= PATIENCE:
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    # Plot training history
    plot_training_history(history, OUTPUT_DIR / "training_history.png")

    # Load best model and export
    print("\n" + "=" * 70)
    print("Exporting Best Model")
    print("=" * 70)

    checkpoint = torch.load(OUTPUT_DIR / "best_model.pth")
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    print(f"Best model from epoch {checkpoint['epoch']+1}")
    print(f"Validation Loss: {checkpoint['val_loss']:.4f}")
    print(f"Per-metric MAE:")
    for i, metric in enumerate(METRICS):
        print(f"  {metric}: {checkpoint['val_mae'][i]:.2f}")

    # Export to ONNX
    print("\nExporting to ONNX...")
    dummy_input = torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE).to(device)
    onnx_path = OUTPUT_DIR / "facial_scorer.onnx"

    try:
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=["image"],
            output_names=["scores"],
            dynamic_axes={
                "image": {0: "batch_size"},
                "scores": {0: "batch_size"},
            },
        )
        print(f"Saved ONNX model: {onnx_path}")
    except Exception as e:
        print(f"ONNX export failed: {e}")
        print("You can export later with: pip install onnxscript && python -c \"...\"")
        print("The PyTorch model (best_model.pth) is still saved and usable.")

    # Save model config
    config = {
        "model_name": MODEL_NAME,
        "image_size": IMAGE_SIZE,
        "metrics": METRICS,
        "num_metrics": NUM_METRICS,
        "normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225],
        },
        "output_range": "0-1 (multiply by 100 for 0-100 scale)",
        "best_val_mae": checkpoint["val_mae"],
        "training_images": len(train_paths),
        "validation_images": len(val_paths),
    }
    with open(OUTPUT_DIR / "model_config.json", "w") as f:
        json.dump(config, f, indent=2)
    print(f"Saved config: {OUTPUT_DIR / 'model_config.json'}")

    print("\n" + "=" * 70)
    print("TRAINING COMPLETE")
    print("=" * 70)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Files:")
    print(f"  - best_model.pth (PyTorch checkpoint)")
    print(f"  - facial_scorer.onnx (ONNX for deployment)")
    print(f"  - model_config.json (model configuration)")
    print(f"  - training_history.png (training curves)")


if __name__ == "__main__":
    main()
