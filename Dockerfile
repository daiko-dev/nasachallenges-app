# Multi‑stage Dockerfile for the SVDV backend (FastAPI)
# -----------------------------------------------------
# Stage 1 – build / install dependencies
FROM python:3.14-slim AS builder

# Install build dependencies (uv, gcc, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy only pyproject and lock files first for caching
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies into a virtual environment
RUN uv venv .venv && \
    uv pip install --no-cache-dir -r <(uv pip freeze) && \
    echo "Dependencies installed"

# Stage 2 – runtime image
FROM python:3.14-slim AS runtime

# Add a non‑root user
RUN useradd -m appuser
WORKDIR /app

# Copy the virtual environment from builder
COPY --from=builder /app/.venv .venv

# Copy the source code
COPY backend/app ./app
COPY backend/tests ./tests  # optional for debugging

# Expose the port expected by Render (environment variable $PORT)
EXPOSE $PORT

# Switch to non‑root user
USER appuser

# Command to run the API
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${PORT:-8000}"]
