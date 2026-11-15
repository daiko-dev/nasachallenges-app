from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "SphereX Viewer and Data Visualizer (SVDV)"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: List[str] = [
        "*",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]
    CACHE_DIR: str = ".cache"
    IRSA_TIMEOUT_SECONDS: float = 12.0
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
