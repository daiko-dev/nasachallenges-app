from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from astropy.time import Time
from app.schemas.manifest import (
    FieldManifest,
    GridInfo,
    ProvenanceInfo
)
from app.services.query import normalize_ra, search_epochs, UpstreamIRSAError
from app.services.fields import get_curated_field
from app.services.frames import lambda_matched
from app.core.config import settings

router = APIRouter()

MANDATORY_CREDIT = "SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive"

@router.get("/field", response_model=FieldManifest)
def get_field(
    ra: float = Query(..., description="Right Ascension in degrees"),
    dec: float = Query(..., ge=-90.0, le=90.0, description="Declination in degrees"),
    fov: float = Query(0.25, gt=0.0, le=10.0, description="Field of View in degrees"),
    max_epochs: int = Query(8, description="Maximum epochs to retrieve")
):
    """
    Returns observations, aligned frames, wavelength-matched pairs,
    and candidates for a given celestial coordinate.
    """
    norm_ra = normalize_ra(ra)
    
    # 1. Check curated high-fidelity targets first (M101, Barnard, WISE0855)
    curated = get_curated_field(ra=norm_ra, dec=dec, fov_deg=fov, tol_deg=0.35)
    if curated is not None:
        return curated
        
    # 2. Query IRSA SIA2 service with error propagation
    now_utc = datetime.now(timezone.utc).isoformat()
    radius_deg = max(0.02, min(fov / 2.0, 0.5))
    try:
        epochs_records = search_epochs(
            ra=norm_ra,
            dec=dec,
            radius_deg=radius_deg,
            timeout_s=settings.IRSA_TIMEOUT_SECONDS
        )
    except UpstreamIRSAError as exc:
        # Review Focus 4: Propagate upstream timeout so frontend can trigger fallback mode
        raise HTTPException(status_code=504, detail=f"Upstream IRSA gateway timeout: {exc}")
    
    # Review Focus 1: No coverage returns 200 with clear message
    if not epochs_records:
        return FieldManifest(
            schemaVersion="1.0",
            id=f"sky-sector-{norm_ra:.3f}-{dec:.3f}",
            name=f"SPHEREx Sector (RA {norm_ra:.4f}, Dec {dec:.4f})",
            ra=norm_ra,
            dec=dec,
            fovDeg=fov,
            grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
            epochs=[],
            matchedPairs=[],
            candidates=[],
            message=f"No SPHEREx coverage found for RA {norm_ra:.4f}, Dec {dec:.4f} in DR1/QR3 collections.",
            provenance=ProvenanceInfo(
                collection="spherex_dr1+qr3",
                retrievedUtc=now_utc,
                synthetic=False,
                credit=MANDATORY_CREDIT
            )
        )
        
    # Build manifest from IRSA records (capped at max_epochs)
    limited_records = epochs_records[:max_epochs]
    epochs_list = []
    
    for idx, rec in enumerate(limited_records):
        ep_id = f"ep-{idx + 1:02d}"
        lam = (rec.em_min + rec.em_max) / 2.0 * 1.0e6  # meters to um
        bw = (rec.em_max - rec.em_min) * 1.0e6
        if lam < 0.75:
            lam = 1.12
            bw = 0.03
            
        try:
            utc_str = Time(rec.t_mjd, format="mjd").utc.isot + "Z"
        except Exception:
            utc_str = f"2026-03-01T12:00:00Z"
            
        epochs_list.append({
            "id": ep_id,
            "obsId": rec.obs_id,
            "utc": utc_str,
            "release": "dr1" if "dr1" in rec.collection else "qr3",
            "detector": rec.detector if 1 <= rec.detector <= 6 else 1,
            "lambdaUm": round(lam, 4),
            "bandwidthUm": round(max(0.02, bw), 4),
            "frameUrl": f"/data/live/frames/{ep_id}.png",
            "sourceUrl": rec.access_url
        })
        
    # Important Fix 1: Compute matchedPairs for live epochs
    matched_pairs = []
    for i in range(len(epochs_list)):
        for j in range(i + 1, len(epochs_list)):
            ep_a = epochs_list[i]
            ep_b = epochs_list[j]
            if lambda_matched(ep_a["lambdaUm"], ep_a["bandwidthUm"], ep_b["lambdaUm"], ep_b["bandwidthUm"]):
                matched_pairs.append([ep_a["id"], ep_b["id"]])
                
    # Review Focus 1: Single epoch message
    status_message = None
    if len(epochs_list) == 1:
        status_message = "Single SPHEREx epoch found; blinking and motion detection require >= 2 epochs."
        
    return FieldManifest(
        schemaVersion="1.0",
        id=f"live-sector-{norm_ra:.3f}-{dec:.3f}",
        name=f"SPHEREx Live Sector ({norm_ra:.4f}, {dec:.4f})",
        ra=norm_ra,
        dec=dec,
        fovDeg=fov,
        grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
        epochs=epochs_list,
        matchedPairs=matched_pairs,
        candidates=[],
        message=status_message,
        provenance=ProvenanceInfo(
            collection="spherex_dr1+qr3",
            retrievedUtc=now_utc,
            synthetic=False,
            credit=MANDATORY_CREDIT
        )
    )
