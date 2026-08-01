# ============================================================================
# Stage 1: Builder - Install dependencies and compile Python packages
# ============================================================================
FROM python:3.11-slim AS builder

# Install build dependencies for Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    libpq-dev \
    libcairo2-dev \
    libgdk-pixbuf-2.0-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /build

# Copy requirements and install dependencies
COPY requirements.txt .

# Install CPU-only torch/torchvision FIRST, into the same prefix.
# Default PyPI torch bundles the CUDA runtime (~2GB of nvidia_* wheels) which is
# dead weight here — inference is CPU-only (see cnn_model_service). PYTHONPATH
# makes this prefix visible to the next pip run so it resolves torch as already
# satisfied instead of pulling the CUDA build from PyPI.
#
# This is done in the Dockerfile rather than requirements.txt on purpose:
# `+cpu` wheels are published for linux/windows only, so pinning them in
# requirements.txt would break `pip install` for macOS devs.
ENV PYTHONPATH=/build/deps/lib/python3.11/site-packages
RUN pip install --no-cache-dir --prefix=/build/deps \
    --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

# Install the remaining dependencies from PyPI
RUN pip install --no-cache-dir --prefix=/build/deps -r requirements.txt

# ============================================================================
# Stage 2: Runtime - Minimal production image
# ============================================================================
FROM python:3.11-slim

# Install runtime dependencies (including OpenCV and WeasyPrint dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    shared-mime-info \
    fontconfig \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r midas && useradd -r -g midas -u 1001 midas

# Set working directory
WORKDIR /app

# Copy installed dependencies from builder
COPY --from=builder /build/deps /usr/local

# Copy application code
COPY --chown=midas:midas . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/temp /app/logs /app/models /app/.cache/huggingface /app/.cache/torch && \
    chown -R midas:midas /app

# Switch to non-root user
USER midas

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS=1 \
    HOME=/app \
    XDG_CACHE_HOME=/app/.cache \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface \
    TORCH_HOME=/app/.cache/torch

# Bake the embedding model into the image.
# embeddings.py calls SentenceTransformer(settings.embedding_model) lazily, which
# downloads ~90MB from HuggingFace on first use. Baking it makes the image
# self-contained: no network dependency during pod startup, and every replica
# starts warm instead of re-downloading on each cold start.
# Keep this model id in sync with `embedding_model` in app/config.py.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Health check with Python (no curl dependency).
# Uses /readyz (not /api/v1/health) so the check reflects real dependency
# readiness — /readyz now returns 503 when Supabase is unreachable.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/readyz').read()" || exit 1

# Copy entrypoint script
COPY --chown=midas:midas docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Expose port (Railway sets PORT dynamically)
EXPOSE 8000

# Use entrypoint script to start services
ENTRYPOINT ["/app/docker-entrypoint.sh"]
