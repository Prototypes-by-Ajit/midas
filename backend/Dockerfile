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
COPY backend/requirements.txt .

# Install Python dependencies to a specific directory
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
COPY --chown=midas:midas backend/. .

# Bake CNN model weights into image (55MB - production ready)
COPY --chown=midas:midas backend/models/midas_v1_final_best.pth /app/models/midas_v1_final_best.pth

# Create only models directory (uploads/temp use Supabase/ephemeral storage)
RUN mkdir -p /app/models && \
    chown -R midas:midas /app

# Switch to non-root user
USER midas

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    WORKERS=1

# Health check with Python (no curl dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/api/v1/health').read()" || exit 1

# Expose port
EXPOSE ${PORT}

# Start application with optimized settings
CMD ["sh", "-c", "uvicorn app.main_agent:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-1} --timeout-keep-alive 75"]
