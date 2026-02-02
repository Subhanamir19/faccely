# Dockerfile for Facial Scoring ML API
# Optimized for Railway deployment

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY api/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy model files
COPY model_output/ /app/model_output/

# Copy API code
COPY api/ /app/api/

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run the API - use shell form with explicit sh -c for variable expansion
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port $PORT"]
