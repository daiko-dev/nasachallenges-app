# Multi-stage Dockerfile for the SVDV backend (FastAPI)
# -----------------------------------------------------
# Stage 1 - build / install dependencies
FROM python:3.14-slim AS builder

# Install build dependencies (uv, gcc, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy only the lock/dependency files first for caching
COPY backend/pyproject.toml backend/uv.lock backend/requirements.txt ./

# Install dependencies into a virtual environment
RUN uv venv .venv && \
    uv pip install --no-cache-dir -r requirements.txt && \
    echo "Dependencies installed"

# Stage 2 - runtime image
FROM python:3.14-slim AS runtime

# Add a non-root user
RUN useradd -m appuser
WORKDIR /app

# Copy the virtual environment from builder
COPY --from=builder /app/.venv .venv

# Copy the source code
COPY backend/app ./app
COPY backend/tests ./tests

# Expose the port expected by Render (environment variable $PORT)
EXPOSE ${PORT:-8000}

# Switch to non-root user
USER appuser

# Command to run the API (shell form so ${PORT} expands)
CMD /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
