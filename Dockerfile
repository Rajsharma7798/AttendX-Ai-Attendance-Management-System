# ==========================================================
#  AttendX — Biometric Attendance System
#  Dockerfile
#
#  Builds a production-ready image with:
#   - Python 3.10 (slim Debian Bookworm)
#   - dlib (compiled from source — needed by face_recognition)
#   - OpenCV (headless), face_recognition, FastAPI, Firebase
#   - Frontend served as static files via FastAPI
# ==========================================================

# ── Stage 1: Builder ──────────────────────────────────────
# Compile dlib + install all heavy deps in a build stage
# so the final image only contains what's needed at runtime.
FROM python:3.10-slim-bookworm AS builder

# System packages required to compile dlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libboost-python-dev \
    libboost-thread-dev \
    libx11-dev \
    libgtk-3-dev \
    libssl-dev \
    pkg-config \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create and activate a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip/wheel/setuptools first
RUN pip install --upgrade pip wheel setuptools

# Install dlib (compiled from source — the PyPI wheel often fails)
# This is the slowest step (~5-10 min). Docker caches it as a layer.
RUN pip install --no-cache-dir dlib==19.24.2

# Install all remaining Python dependencies
COPY requirements.docker.txt .
RUN pip install --no-cache-dir -r requirements.docker.txt


# ── Stage 2: Runtime ─────────────────────────────────────
FROM python:3.10-slim-bookworm AS runtime

LABEL maintainer="AttendX Dev"
LABEL description="AttendX Biometric Attendance System — FastAPI + facial recognition"
LABEL version="2.1"

# Runtime system libraries only (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # OpenCV headless runtime requirements
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1 \
    # dlib runtime requirements
    libopenblas0 \
    liblapack3 \
    # General utilities
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ── App Setup ─────────────────────────────────────────────
WORKDIR /app

# Copy project source code
COPY server/          ./server/
COPY frontend/        ./frontend/

# Create directories for persistent data and credentials
# These will be overridden by Docker volumes at runtime
RUN mkdir -p /app/data /app/creds

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Tell the app where to write Excel files (mounted volume)
    ATTENDX_DATA_DIR=/app/data \
    # Tell firebase_utils where to find the service account key
    GOOGLE_APPLICATION_CREDENTIALS=/app/creds/serviceAccountKey.json

# Patch main.py paths to use the env-var data dir at runtime
# (The actual env-var override happens via entrypoint)

EXPOSE 8000

# Health check — verify the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/attendance')" \
    || exit 1

# ── Entrypoint ────────────────────────────────────────────
CMD ["python", "-m", "uvicorn", "server.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]
