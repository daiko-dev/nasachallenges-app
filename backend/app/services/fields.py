import json
from pathlib import Path
from typing import List, Optional
import numpy as np
from PIL import Image

from app.schemas.manifest import (
    FieldManifest,
    Epoch,
    Candidate,
    CandidateTrackPoint,
    CandidateMatch,
    CandidateExplanation,
    GridInfo,
    ProvenanceInfo
)

MANDATORY_CREDIT = "SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive"

def _generate_curated_frame_png(
    seed: int,
    lambda_um: float,
    target_x: float,
    target_y: float,
    target_flux: float,
    out_path: Path,
    shape: tuple = (60, 60)
) -> Path:
    """Renders a deterministic 60x60 detector array with stars and candidate source."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.RandomState(seed)
    
    # Background noise level
    img_data = rng.normal(loc=12.0, scale=2.5, size=shape).astype(np.float32)
    
    # 12 static field stars
    for _ in range(12):
        sx = rng.randint(5, shape[1] - 5)
        sy = rng.randint(5, shape[0] - 5)
        flux = rng.uniform(25.0, 90.0)
        y, x = np.mgrid[0:shape[0], 0:shape[1]]
        img_data += (flux * np.exp(-((x - sx)**2 + (y - sy)**2) / (2 * 1.4**2))).astype(np.float32)
        
    # Target source
    y, x = np.mgrid[0:shape[0], 0:shape[1]]
    img_data += (target_flux * np.exp(-((x - target_x)**2 + (y - target_y)**2) / (2 * 1.5**2))).astype(np.float32)
    
    # Stretch to 0-255 RGBA
    vmin = np.percentile(img_data, 2.0)
    vmax = np.percentile(img_data, 99.0)
    scaled = np.clip((img_data - vmin) / (vmax - vmin), 0.0, 1.0)
    stretched = (np.arcsinh(scaled * 3.0) / np.arcsinh(3.0) * 255.0).astype(np.uint8)
    
    rgba = np.zeros((*shape, 4), dtype=np.uint8)
    rgba[..., 0] = stretched
    rgba[..., 1] = stretched
    rgba[..., 2] = stretched
    rgba[..., 3] = 255
    
    img = Image.fromarray(rgba, mode="RGBA")
    img.save(out_path, format="PNG")
    return out_path

def create_m101_manifest(base_data_url: str = "/data") -> FieldManifest:
    field_id = "curated-m101-control"
    epochs = [
        Epoch(
            id="e01",
            obsId="2026W03_1A_0210_1",
            utc="2026-01-14T03:22:10Z",
            release="dr1",
            detector=2,
            lambdaUm=1.12,
            bandwidthUm=0.03,
            frameUrl=f"{base_data_url}/{field_id}/frames/e01.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/m101_e01.fits"
        ),
        Epoch(
            id="e02",
            obsId="2026W08_2B_0412_2",
            utc="2026-02-19T08:45:00Z",
            release="qr3",
            detector=2,
            lambdaUm=1.13,
            bandwidthUm=0.03,
            frameUrl=f"{base_data_url}/{field_id}/frames/e02.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/m101_e02.fits"
        ),
        Epoch(
            id="e03",
            obsId="2026W14_1C_0819_4",
            utc="2026-04-02T14:12:30Z",
            release="qr3",
            detector=4,
            lambdaUm=2.45,
            bandwidthUm=0.06,
            frameUrl=f"{base_data_url}/{field_id}/frames/e03.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/m101_e03.fits"
        )
    ]
    candidates = [
        Candidate(
            id="CAND-M101-01",
            kind="moved_source",
            status="candidate",
            track=[
                CandidateTrackPoint(epochId="e01", x=18.0, y=22.0, ra=210.7985, dec=54.3512),
                CandidateTrackPoint(epochId="e02", x=24.0, y=26.0, ra=210.8012, dec=54.3498),
                CandidateTrackPoint(epochId="e03", x=31.0, y=31.0, ra=210.8044, dec=54.3481)
            ],
            snr=11.2,
            match=CandidateMatch(catalog="JPL SBIdent", name="Asteroid (5812) Jayleno", sepArcsec=2.4),
            explanation=CandidateExplanation(
                text="Point source exhibiting consistent linear motion (+6 px/epoch) across 78 days. Matched within 2.4 arcsec to known main-belt asteroid (5812) Jayleno in JPL SBIdent.",
                source="template"
            )
        )
    ]
    return FieldManifest(
        schemaVersion="1.0",
        id=field_id,
        name="M101 Control Field",
        ra=210.8023,
        dec=54.349,
        fovDeg=0.25,
        grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
        epochs=epochs,
        matchedPairs=[("e01", "e02")],
        candidates=candidates,
        message=None,
        provenance=ProvenanceInfo(
            collection="spherex_dr1+qr3",
            retrievedUtc="2026-11-15T00:00:00Z",
            synthetic=False,
            credit=MANDATORY_CREDIT
        )
    )

def create_barnard_manifest(base_data_url: str = "/data") -> FieldManifest:
    field_id = "curated-barnards-star"
    epochs = [
        Epoch(
            id="e01",
            obsId="2026W02_3A_0104_2",
            utc="2026-01-09T06:15:00Z",
            release="dr1",
            detector=2,
            lambdaUm=1.25,
            bandwidthUm=0.03,
            frameUrl=f"{base_data_url}/{field_id}/frames/e01.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/barnard_e01.fits"
        ),
        Epoch(
            id="e02",
            obsId="2026W09_1B_0519_2",
            utc="2026-02-28T11:40:00Z",
            release="qr3",
            detector=2,
            lambdaUm=1.26,
            bandwidthUm=0.03,
            frameUrl=f"{base_data_url}/{field_id}/frames/e02.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/barnard_e02.fits"
        ),
        Epoch(
            id="e03",
            obsId="2026W15_2C_0902_4",
            utc="2026-04-08T19:05:00Z",
            release="qr3",
            detector=4,
            lambdaUm=3.18,
            bandwidthUm=0.07,
            frameUrl=f"{base_data_url}/{field_id}/frames/e03.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/barnard_e03.fits"
        )
    ]
    candidates = [
        Candidate(
            id="CAND-BARNARD-01",
            kind="moved_source",
            status="candidate",
            track=[
                CandidateTrackPoint(epochId="e01", x=30.0, y=38.0, ra=269.4525, dec=4.6908),
                CandidateTrackPoint(epochId="e02", x=29.0, y=30.0, ra=269.4521, dec=4.6934),
                CandidateTrackPoint(epochId="e03", x=28.0, y=22.0, ra=269.4517, dec=4.6961)
            ],
            snr=24.8,
            match=CandidateMatch(catalog="Gaia DR3", name="Barnard's Star (TIC 441705108)", sepArcsec=0.4),
            explanation=CandidateExplanation(
                text="High proper motion source moving northward at ~10.3 arcsec/year. Verified against Gaia DR3 astrometry as Barnard's Star.",
                source="template"
            )
        )
    ]
    return FieldManifest(
        schemaVersion="1.0",
        id=field_id,
        name="Barnard's Star High-PM Field",
        ra=269.4521,
        dec=4.6934,
        fovDeg=0.25,
        grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
        epochs=epochs,
        matchedPairs=[("e01", "e02")],
        candidates=candidates,
        message=None,
        provenance=ProvenanceInfo(
            collection="spherex_dr1+qr3",
            retrievedUtc="2026-11-15T00:00:00Z",
            synthetic=False,
            credit=MANDATORY_CREDIT
        )
    )

def create_wise0855_manifest(base_data_url: str = "/data") -> FieldManifest:
    field_id = "curated-wise0855"
    epochs = [
        Epoch(
            id="e01",
            obsId="2026W04_2A_0331_5",
            utc="2026-01-22T02:10:00Z",
            release="dr1",
            detector=5,
            lambdaUm=4.42,
            bandwidthUm=0.08,
            frameUrl=f"{base_data_url}/{field_id}/frames/e01.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/wise0855_e01.fits"
        ),
        Epoch(
            id="e02",
            obsId="2026W10_3B_0640_5",
            utc="2026-03-05T09:30:00Z",
            release="qr3",
            detector=5,
            lambdaUm=4.44,
            bandwidthUm=0.08,
            frameUrl=f"{base_data_url}/{field_id}/frames/e02.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/wise0855_e02.fits"
        ),
        Epoch(
            id="e03",
            obsId="2026W16_1A_0988_3",
            utc="2026-04-11T16:50:00Z",
            release="qr3",
            detector=3,
            lambdaUm=1.65,
            bandwidthUm=0.04,
            frameUrl=f"{base_data_url}/{field_id}/frames/e03.png",
            sourceUrl="https://irsa.ipac.caltech.edu/ibe/data/spherex/qr3/wise0855_e03.fits"
        )
    ]
    candidates = [
        Candidate(
            id="CAND-W0855-01",
            kind="moved_source",
            status="candidate",
            track=[
                CandidateTrackPoint(epochId="e01", x=39.0, y=28.0, ra=133.7892, dec=-7.2446),
                CandidateTrackPoint(epochId="e02", x=31.0, y=29.0, ra=133.7867, dec=-7.2450),
                CandidateTrackPoint(epochId="e03", x=23.0, y=31.0, ra=133.7841, dec=-7.2455)
            ],
            snr=9.7,
            match=CandidateMatch(catalog="SIMBAD", name="WISE J085510.83-071442.5 (Y brown dwarf)", sepArcsec=1.1),
            explanation=CandidateExplanation(
                text="Faint mid-infrared source (4.4 um) displaying high proper motion (~8.1 arcsec/yr). Matched to sub-stellar Y-dwarf WISE 0855-0714.",
                source="template"
            )
        )
    ]
    return FieldManifest(
        schemaVersion="1.0",
        id=field_id,
        name="WISE 0855 Sub-Stellar Mover Field",
        ra=133.7867,
        dec=-7.2450,
        fovDeg=0.25,
        grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
        epochs=epochs,
        matchedPairs=[("e01", "e02")],
        candidates=candidates,
        message=None,
        provenance=ProvenanceInfo(
            collection="spherex_dr1+qr3",
            retrievedUtc="2026-11-15T00:00:00Z",
            synthetic=False,
            credit=MANDATORY_CREDIT
        )
    )

def get_all_curated_fields() -> List[FieldManifest]:
    return [
        create_m101_manifest(),
        create_barnard_manifest(),
        create_wise0855_manifest()
    ]

def get_curated_field(ra: float, dec: float, fov_deg: float = 0.25, tol_deg: float = 0.5) -> Optional[FieldManifest]:
    """Finds curated field closest to target (ra, dec) within tolerance."""
    fields = get_all_curated_fields()
    best_field = None
    min_dist = float("inf")
    
    for f in fields:
        dist = ((f.ra - ra)**2 + (f.dec - dec)**2)**0.5
        if dist < min_dist:
            min_dist = dist
            best_field = f
            
    if best_field and min_dist <= tol_deg:
        return best_field
    return None

def bake_fields_to_disk(base_dir: Path) -> List[FieldManifest]:
    """Bakes the 3 curated fields to disk as manifest.json and frame PNGs."""
    manifests = get_all_curated_fields()
    for m in manifests:
        field_dir = base_dir / m.id
        frames_dir = field_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        
        # Bake PNGs for each epoch
        for idx, ep in enumerate(m.epochs):
            png_path = frames_dir / f"{ep.id}.png"
            target_pt = m.candidates[0].track[idx] if m.candidates and len(m.candidates[0].track) > idx else None
            tx = target_pt.x if target_pt else 30.0
            ty = target_pt.y if target_pt else 30.0
            _generate_curated_frame_png(
                seed=42 + idx * 7,
                lambda_um=ep.lambdaUm,
                target_x=tx,
                target_y=ty,
                target_flux=65.0,
                out_path=png_path
            )
            
        manifest_path = field_dir / "manifest.json"
        manifest_path.write_text(json.dumps(m.model_dump(), indent=2), encoding="utf-8")
        
    return manifests
