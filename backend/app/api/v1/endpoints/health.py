from datetime import datetime, timezone
from fastapi import APIRouter
import httpx
from app.schemas.manifest import HealthStatus

router = APIRouter()

@router.get("/health", response_model=HealthStatus)
def check_health():
    """Checks system health and IRSA upstream accessibility."""
    now_utc = datetime.now(timezone.utc).isoformat()
    irsa_status = "up"
    try:
        # Quick 2-second probe
        with httpx.Client(timeout=2.0) as client:
            r = client.get("https://irsa.ipac.caltech.edu")
            if r.status_code >= 500:
                irsa_status = "down"
    except Exception:
        irsa_status = "down"
        
    return HealthStatus(irsa=irsa_status, checkedUtc=now_utc)
