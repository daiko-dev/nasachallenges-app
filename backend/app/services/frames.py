import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional
import numpy as np
from PIL import Image
from astropy.wcs import WCS
from reproject import reproject_interp

from app.schemas.manifest import (
    FieldManifest,
    Epoch,
    GridInfo,
    ProvenanceInfo,
    Candidate
)
from app.services.cutouts import Cutout

@dataclass
class FieldSpec:
    id: str
    name: str
    ra: float
    dec: float
    fov_deg: float = 0.1
    max_epochs: int = 10

def lambda_matched(
    lam_a: float,
    bw_a: float,
    lam_b: float,
    bw_b: float,
    frac: float = 0.5
) -> bool:
    """
    Review Focus 3: Checks whether two observation epochs share a compatible wavelength band.
    Avoids attributing color differences to photometric or astrometric variability.
    """
    max_bw = max(bw_a, bw_b)
    return abs(lam_a - lam_b) <= (frac * max_bw)

def create_common_wcs(
    ra: float,
    dec: float,
    pix_scale_arcsec: float = 6.2,
    shape: Tuple[int, int] = (60, 60)
) -> WCS:
    """Creates a standard astronomical TAN projection WCS centered at (ra, dec)."""
    w = WCS(naxis=2)
    w.wcs.crpix = [shape[1] / 2.0, shape[0] / 2.0]
    deg_per_px = pix_scale_arcsec / 3600.0
    w.wcs.cdelt = [-deg_per_px, deg_per_px]
    w.wcs.crval = [ra, dec]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return w

def reproject_to_common_grid(
    image: np.ndarray,
    source_wcs: WCS,
    target_wcs: WCS,
    shape: Tuple[int, int] = (60, 60)
) -> np.ndarray:
    """Reprojects an input image array onto the common target WCS grid."""
    array_reprojected, _ = reproject_interp(
        (image, source_wcs),
        target_wcs,
        shape_out=shape
    )
    return array_reprojected.astype(np.float32)

def render_frame_png(
    array: np.ndarray,
    out_path: Path,
    vmin_pct: float = 1.0,
    vmax_pct: float = 99.5
) -> Path:
    """
    Renders an astronomical 2D image array to an RGBA PNG with alpha transparency for masked/NaN pixels.
    Uses robust percentile stretch.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    mask = np.isnan(array)
    valid_vals = array[~mask]
    
    rgba = np.zeros((*array.shape, 4), dtype=np.uint8)
    
    if len(valid_vals) > 0:
        vmin = np.percentile(valid_vals, vmin_pct)
        vmax = np.percentile(valid_vals, vmax_pct)
        if vmax <= vmin:
            vmax = vmin + 1.0
            
        scaled = np.clip((array - vmin) / (vmax - vmin), 0.0, 1.0)
        scaled_clean = np.nan_to_num(scaled, nan=0.0)
        # Apply gentle asinh contrast curve
        stretched = (np.arcsinh(scaled_clean * 3.0) / np.arcsinh(3.0) * 255.0).astype(np.uint8)
        
        rgba[..., 0] = stretched  # R
        rgba[..., 1] = stretched  # G
        rgba[..., 2] = stretched  # B
        rgba[..., 3] = np.where(mask, 0, 255)  # Alpha: 0 on NaN/masked
    else:
        rgba[..., 3] = 0
        
    img = Image.fromarray(rgba, mode="RGBA")
    img.save(out_path, format="PNG")
    return out_path

def build_field_manifest(
    spec: FieldSpec,
    cutouts: List[Tuple[Cutout, str, str, str]],  # (Cutout, utc, release, source_url)
    out_dir: Path,
    grid_shape: Tuple[int, int] = (60, 60),
    pix_scale_arcsec: float = 6.2,
    candidates: Optional[List[Candidate]] = None
) -> FieldManifest:
    """
    Reprojects all epochs for a field to a common grid, renders PNG frames,
    computes wavelength matched pairs, and serializes manifest.json.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    
    target_wcs = create_common_wcs(
        ra=spec.ra,
        dec=spec.dec,
        pix_scale_arcsec=pix_scale_arcsec,
        shape=grid_shape
    )
    
    epoch_objects: List[Epoch] = []
    
    for idx, (cutout, utc, release, source_url) in enumerate(cutouts):
        epoch_id = f"ep-{idx + 1:02d}"
        reproj_img = reproject_to_common_grid(
            cutout.cleaned_image,
            cutout.wcs,
            target_wcs,
            shape=grid_shape
        )
        png_rel_path = f"frames/{epoch_id}.png"
        png_abs_path = out_dir / png_rel_path
        render_frame_png(reproj_img, png_abs_path)
        
        epoch_obj = Epoch(
            id=epoch_id,
            obsId=cutout.obs_id,
            utc=utc,
            release=release,  # type: ignore
            detector=cutout.detector,  # type: ignore
            lambdaUm=round(float(cutout.lambda_um), 4),
            bandwidthUm=round(float(cutout.bandwidth_um), 4),
            frameUrl=f"/data/{spec.id}/{png_rel_path}",
            sourceUrl=source_url
        )
        epoch_objects.append(epoch_obj)
        
    # Compute matchedPairs
    matched_pairs: List[Tuple[str, str]] = []
    for i in range(len(epoch_objects)):
        for j in range(i + 1, len(epoch_objects)):
            ep_a = epoch_objects[i]
            ep_b = epoch_objects[j]
            if lambda_matched(ep_a.lambdaUm, ep_a.bandwidthUm, ep_b.lambdaUm, ep_b.bandwidthUm):
                matched_pairs.append((ep_a.id, ep_b.id))
                
    manifest = FieldManifest(
        schemaVersion="1.0",
        id=spec.id,
        name=spec.name,
        ra=spec.ra,
        dec=spec.dec,
        fovDeg=spec.fov_deg,
        grid=GridInfo(
            widthPx=grid_shape[1],
            heightPx=grid_shape[0],
            pixScaleArcsec=pix_scale_arcsec
        ),
        epochs=epoch_objects,
        matchedPairs=matched_pairs,
        candidates=candidates or [],
        message=None,
        provenance=ProvenanceInfo(
            collection="spherex_dr1",
            retrievedUtc="2026-11-15T12:00:00Z",
            synthetic=False,
            credit="SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive"
        )
    )
    
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest.model_dump(), indent=2), encoding="utf-8")
    return manifest
