#!/bin/sh
# Startup script for ML Scoring API
# Handles PORT environment variable properly

echo "=== Starting ML Scoring API ==="
echo "PORT env: $PORT"

# Default to 8000 if PORT not set
PORT="${PORT:-8000}"
echo "Using PORT: $PORT"

# Start uvicorn
exec uvicorn api.main:app --host 0.0.0.0 --port "$PORT"
