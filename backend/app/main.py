from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.v1.endpoints import field, health, rag

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API and Scientific Analysis Engine for SphereX Viewer and Data Visualizer (SVDV)",
    version="0.1.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include endpoints at both /api and /api/v1
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(field.router, prefix="/api", tags=["Fields"])
app.include_router(rag.router, prefix="/api", tags=["RAG"])

app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health v1"])
app.include_router(field.router, prefix=settings.API_V1_STR, tags=["Fields v1"])
app.include_router(rag.router, prefix=settings.API_V1_STR, tags=["RAG v1"])

# Mount static frames directory if exists
data_dir = Path(__file__).parent / "data"
if not data_dir.exists():
    data_dir.mkdir(parents=True, exist_ok=True)
app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")
