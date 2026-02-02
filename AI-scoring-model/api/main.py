"""
FastAPI microservice for facial scoring ML model.
Replaces OpenAI API scoring with local PyTorch EfficientNet model.
"""

import os
import sys
import io
import base64
from pathlib import Path
from typing import Optional

print("=== ML Scoring API Starting ===", flush=True)
print(f"Python version: {sys.version}", flush=True)
print(f"Working directory: {os.getcwd()}", flush=True)

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
print("FastAPI imported", flush=True)

import torch
print(f"PyTorch version: {torch.__version__}", flush=True)
import torch.nn as nn
from torchvision import transforms
print("torchvision imported", flush=True)
from PIL import Image
import timm
print("All imports complete", flush=True)

# ============================================================================
# Configuration
# ============================================================================

MODEL_DIR = Path(__file__).parent.parent / "model_output"
MODEL_PATH = MODEL_DIR / "best_model.pth"

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
# Model Definition (must match train_model.py)
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
# Global Model Instance
# ============================================================================

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model: Optional[FacialScoreModel] = None

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

transform = get_inference_transform()

def load_model():
    """Load the trained model."""
    global model
    if model is not None:
        return model

    # Find the model file
    possible_paths = [
        MODEL_PATH,
        Path("/app/model_output/best_model.pth"),
        Path("./model_output/best_model.pth"),
        Path("../model_output/best_model.pth"),
    ]

    model_path = None
    for path in possible_paths:
        print(f"Checking path: {path} - exists: {path.exists()}", flush=True)
        if path.exists():
            model_path = path
            break

    if model_path is None:
        print(f"ERROR: Model not found at any path!", flush=True)
        raise RuntimeError(f"Model not found. Tried: {possible_paths}")

    print(f"Loading model from: {model_path}", flush=True)
    try:
        model = FacialScoreModel(pretrained=False)
        print("Model architecture created", flush=True)

        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
        print("Checkpoint loaded", flush=True)

        model.load_state_dict(checkpoint["model_state_dict"])
        print("State dict loaded", flush=True)

        model = model.to(device)
        model.eval()

        print(f"Model loaded successfully (epoch {checkpoint['epoch'] + 1})", flush=True)
        print(f"Device: {device}", flush=True)
        return model
    except Exception as e:
        print(f"ERROR loading model: {e}", flush=True)
        raise

# ============================================================================
# API Models
# ============================================================================

class Scores(BaseModel):
    jawline: int
    cheekbones: int
    eyes_symmetry: int
    nose_harmony: int
    facial_symmetry: int
    skin_quality: int
    sexual_dimorphism: int

class ScoreResponse(BaseModel):
    scores: Scores
    modelVersion: str = "efficientnet_b0_v1"

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="Facial Scoring ML API",
    description="EfficientNet-B0 model for facial feature scoring",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Load model on startup."""
    print("=== Startup event triggered ===", flush=True)
    try:
        load_model()
        print("=== Startup complete ===", flush=True)
    except Exception as e:
        print(f"=== Startup FAILED: {e} ===", flush=True)
        # Don't raise - let the app start so we can see health check errors

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    print(f"Health check called, model loaded: {model is not None}", flush=True)
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )
    return HealthResponse(
        status="ok",
        model_loaded=True,
        device=str(device)
    )

@app.get("/")
async def root():
    """Root endpoint for basic connectivity test."""
    return {"status": "ok", "service": "facial-scoring-ml"}

def process_image(image: Image.Image) -> dict:
    """Process a single image and return scores."""
    if model is None:
        raise RuntimeError("Model not loaded")

    # Ensure RGB
    image = image.convert("RGB")

    # Apply transforms
    image_tensor = transform(image).unsqueeze(0).to(device)

    # Inference
    with torch.no_grad():
        output = model(image_tensor)

    # Convert to 0-100 scale and round to integers
    scores_list = (output.squeeze().cpu().numpy() * 100).tolist()

    return {
        metric: int(round(score))
        for metric, score in zip(METRICS, scores_list)
    }

@app.post("/score", response_model=ScoreResponse)
async def score_image(image: UploadFile = File(...)):
    """
    Score a single facial image.

    Accepts: image file (JPEG, PNG, WebP)
    Returns: 7 facial metric scores (0-100 scale)
    """
    try:
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        scores = process_image(pil_image)

        return ScoreResponse(
            scores=Scores(**scores),
            modelVersion="efficientnet_b0_v1"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score/base64", response_model=ScoreResponse)
async def score_image_base64(data_url: str = Form(...)):
    """
    Score a facial image from base64 data URL.

    Accepts: data URL (data:image/png;base64,...)
    Returns: 7 facial metric scores (0-100 scale)
    """
    try:
        # Parse data URL
        if "," in data_url:
            header, encoded = data_url.split(",", 1)
        else:
            encoded = data_url

        # Decode base64
        image_bytes = base64.b64decode(encoded)
        pil_image = Image.open(io.BytesIO(image_bytes))
        scores = process_image(pil_image)

        return ScoreResponse(
            scores=Scores(**scores),
            modelVersion="efficientnet_b0_v1"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score/pair", response_model=ScoreResponse)
async def score_image_pair(
    frontal: UploadFile = File(...),
    side: UploadFile = File(...)
):
    """
    Score using both frontal and side profile images.

    Note: Current model only uses frontal image.
    Side profile support planned for future versions.

    Returns: 7 facial metric scores (0-100 scale)
    """
    try:
        # For now, just use the frontal image
        # Future: Train a model that uses both views
        contents = await frontal.read()
        pil_image = Image.open(io.BytesIO(contents))
        scores = process_image(pil_image)

        return ScoreResponse(
            scores=Scores(**scores),
            modelVersion="efficientnet_b0_v1"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score/pair-bytes", response_model=ScoreResponse)
async def score_pair_bytes(
    front: str = Form(...),
    side: str = Form(...)
):
    """
    Score using base64 data URLs for frontal and side images.

    Note: Current model only uses frontal image.
    """
    try:
        # Parse frontal data URL
        if "," in front:
            _, encoded = front.split(",", 1)
        else:
            encoded = front

        image_bytes = base64.b64decode(encoded)
        pil_image = Image.open(io.BytesIO(image_bytes))
        scores = process_image(pil_image)

        return ScoreResponse(
            scores=Scores(**scores),
            modelVersion="efficientnet_b0_v1"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
