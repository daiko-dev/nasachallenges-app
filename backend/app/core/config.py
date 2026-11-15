from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

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
    IRSA_TIMEOUT_SECONDS: float = 5.0
    
    # Supabase RAG configuration
    SUPABASE_URL: str = "https://bhngctabyagxmgceeapw.supabase.co"
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # API security key
    API_KEY: Optional[str] = None
    
    # Self-hosted transformer model configuration
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
