import os
import hashlib
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Union
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
import httpx

class TargetOutsideError(Exception):
    """Raised when the target coordinate falls outside or dangerously close to the detector edge."""
    pass

@dataclass
class Cutout:
    image: np.ndarray
    flags: np.ndarray
    variance: np.ndarray
    cleaned_image: np.ndarray
    wcs: WCS
    lambda_um: float
    bandwidth_um: float
    detector: int
    obs_id: str

def _open_fits(source: Union[Path, str, bytes, fits.HDUList]) -> fits.HDUList:
    if isinstance(source, fits.HDUList):
        return source
    if isinstance(source, bytes):
        import io
        return fits.open(io.BytesIO(source))
    return fits.open(source)

def inspect_cutout_hdus(source: Union[Path, str, fits.HDUList]) -> List[str]:
    """Returns list of extension names in the FITS cutout."""
    hdul = _open_fits(source)
    names = []
    for h in hdul:
        extname = h.header.get("EXTNAME", "")
        if not extname:
            extname = "IMAGE" if h.is_image else f"HDU_{len(names)}"
        names.append(extname)
    if isinstance(source, (Path, str)):
        hdul.close()
    return names

def lambda_at(source: Union[Path, str, fits.HDUList], ra: float, dec: float) -> Tuple[float, float]:
    """
    Extracts central wavelength (lambda in um) and bandwidth (bw in um)
    from WCS-WAVE extension or primary header.
    """
    hdul = _open_fits(source)
    try:
        lam = None
        bw = None
        
        # Check WCS-WAVE extension if present
        if "WCS-WAVE" in hdul:
            wave_hdr = hdul["WCS-WAVE"].header
            lam = wave_hdr.get("LAMBDA") or wave_hdr.get("CRVAL1")
            bw = wave_hdr.get("BANDWID") or wave_hdr.get("CDELT1", 0.035)
            
        # Fallback to Primary header
        if lam is None:
            lam = hdul[0].header.get("LAMBDA") or hdul[0].header.get("WAVELEN", 1.42)
        if bw is None:
            bw = hdul[0].header.get("BANDWID") or hdul[0].header.get("BANDPASS", 0.035)
            
        # Guarantee within instrument range 0.75 - 5.0 um
        lam = float(lam)
        bw = float(bw)
        if lam < 1e-3:
            lam *= 1e6
        if bw < 1e-3:
            bw *= 1e6
        if lam < 0.75:
            lam = 0.75
        elif lam > 5.0:
            lam = 5.0
            
        return lam, bw
    finally:
        if isinstance(source, (Path, str)):
            hdul.close()

def read_cutout(
    source: Union[Path, str, bytes, fits.HDUList],
    ra: float,
    dec: float,
    edge_margin_px: int = 3
) -> Cutout:
    """Reads a SPHEREx cutout FITS, validates FOV margins, and creates masked/cleaned array."""
    hdul = _open_fits(source)
    try:
        primary = hdul[0]
        image_data = primary.data.astype(np.float32)
        h, w = image_data.shape
        
        wcs = WCS(primary.header)
        # Calculate pixel coordinates for (ra, dec)
        # Using origin=0 for 0-indexed array
        px, py = wcs.world_to_pixel_values(ra, dec)
        
        # Review Focus 2: Check edge boundary
        if (
            px < edge_margin_px
            or px > (w - 1 - edge_margin_px)
            or py < edge_margin_px
            or py > (h - 1 - edge_margin_px)
        ):
            raise TargetOutsideError(
                f"Target (RA={ra}, Dec={dec}) is near detector edge at pixel ({px:.1f}, {py:.1f}) in {w}x{h} cutout."
            )
            
        # Extract FLAGS
        if "FLAGS" in hdul:
            flags_data = hdul["FLAGS"].data.astype(np.uint16)
        else:
            flags_data = np.zeros_like(image_data, dtype=np.uint16)
            
        # Extract VARIANCE
        if "VARIANCE" in hdul:
            variance_data = hdul["VARIANCE"].data.astype(np.float32)
        else:
            variance_data = np.full_like(image_data, 1.0, dtype=np.float32)
            
        # Masked array: any pixel with flags > 0 is masked to NaN
        cleaned_image = np.copy(image_data)
        cleaned_image[flags_data > 0] = np.nan
        
        # Detector and Obs ID
        det = int(primary.header.get("DETECTOR", 1))
        obs_id = str(primary.header.get("OBSID", "SPX_CUTOUT"))
        
        lam, bw = lambda_at(hdul, ra, dec)
        
        return Cutout(
            image=image_data,
            flags=flags_data,
            variance=variance_data,
            cleaned_image=cleaned_image,
            wcs=wcs,
            lambda_um=lam,
            bandwidth_um=bw,
            detector=det,
            obs_id=obs_id
        )
    finally:
        if isinstance(source, (Path, str)):
            hdul.close()

def fetch_cutout(
    access_url: str,
    ra: float,
    dec: float,
    size_deg: float = 0.1,
    cache_dir: Path = Path(".cache")
) -> Path:
    """Downloads cutout from IRSA or returns cached file."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    url_hash = hashlib.sha256(access_url.encode()).hexdigest()[:10]
    filename = f"cutout_{url_hash}_{ra:.4f}_{dec:.4f}_{size_deg:.3f}.fits"
    target_path = cache_dir / filename
    if target_path.exists():
        return target_path
        
    cutout_url = f"{access_url}?center={ra:.5f},{dec:.5f}&size={size_deg:.4f}"
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(cutout_url)
        resp.raise_for_status()
        target_path.write_bytes(resp.content)
    return target_path
