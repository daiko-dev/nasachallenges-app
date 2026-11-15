from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import settings

def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> bool:
    """
    Validates simple API key against settings.API_KEY.
    If no API_KEY is configured in the environment (e.g. local dev),
    requests are permitted.
    """
    if not settings.API_KEY:
        return True
        
    if not x_api_key or x_api_key != settings.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return True
