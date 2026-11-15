import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    """
    Returns a singleton instance of the Supabase Client.
    Uses SUPABASE_SERVICE_ROLE_KEY if available for write operations,
    otherwise SUPABASE_KEY. Returns None if credentials are not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not url or not key:
        logger.warning("Supabase URL or Key not set. Supabase client will be uninitialized.")
        return None

    try:
        _supabase_client = create_client(url, key)
        logger.info(f"Supabase client initialized for {url}")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None
