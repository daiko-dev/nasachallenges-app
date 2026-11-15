from typing import Optional, Dict, Any
import httpx

from app.schemas.manifest import Candidate, CandidateMatch

JPL_SBIDENT_API_URL = "https://ssd-api.jpl.nasa.gov/sb_ident.api"

def match_known_sbident(
    cand: Candidate,
    epoch_utc: str,
    tol_arcsec: float = 30.0,
    mock_payload: Optional[Dict[str, Any]] = None,
    api_url: Optional[str] = None,
    timeout_s: float = 5.0
) -> Optional[CandidateMatch]:
    """
    Crossmatches a moving candidate with known Small-Body / asteroid orbits using JPL SBIdent API.
    Review Focus 4: If network is slow or unreachable, gracefully returns None.
    """
    if not cand.track:
        return None
        
    # Use position from first available track point
    pt = cand.track[0]
    ra = pt.ra
    dec = pt.dec
    
    payload = mock_payload
    if payload is None:
        target_url = api_url or JPL_SBIDENT_API_URL
        params = {
            "sb-kind": "a",
            "obs-time": epoch_utc,
            "fov-ra-center": f"{ra:.5f}",
            "fov-dec-center": f"{dec:.5f}",
            "fov-ra-lim": f"{tol_arcsec / 3600.0:.5f}",
            "fov-dec-lim": f"{tol_arcsec / 3600.0:.5f}",
            "mag-required": "false"
        }
        try:
            with httpx.Client(timeout=timeout_s) as client:
                resp = client.get(target_url, params=params)
                if resp.status_code == 200:
                    payload = resp.json()
        except Exception:
            return None
            
    if not payload:
        return None
        
    # Parse JPL response
    count = payload.get("count", 0)
    data = payload.get("data", [])
    if count == 0 or not data:
        return None
        
    first_row = data[0]
    obj_name = str(first_row[0])
    
    # Distance / separation (default or parsed)
    sep_arcsec = tol_arcsec
    if len(first_row) >= 5:
        try:
            sep_arcsec = float(first_row[4])
        except (ValueError, TypeError):
            pass
    elif len(first_row) >= 2:
        try:
            sep_arcsec = float(first_row[-1])
        except (ValueError, TypeError):
            pass
            
    if sep_arcsec <= tol_arcsec:
        return CandidateMatch(
            catalog="JPL SBIdent",
            name=obj_name,
            sepArcsec=round(sep_arcsec, 2)
        )
        
    return None
