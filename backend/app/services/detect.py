from typing import Dict, List, Tuple, Optional
import numpy as np
from astropy.wcs import WCS
from astropy.stats import mad_std
from photutils.detection import DAOStarFinder
from scipy.spatial import cKDTree

from app.schemas.manifest import (
    Candidate,
    CandidateTrackPoint,
    CandidateMatch,
    CandidateExplanation
)

def _extract_sources(
    image: np.ndarray,
    fwhm: float = 3.0,
    nsigma: float = 5.0
) -> Tuple[np.ndarray, float]:
    """Extracts point source centroids (x, y) and SNR baseline from an astronomical image array."""
    # Mask NaNs and calculate background statistics
    valid_mask = ~np.isnan(image)
    if np.count_nonzero(valid_mask) < 20:
        return np.empty((0, 2), dtype=np.float32), 1.0
        
    bkg_median = float(np.nanmedian(image))
    bkg_std = float(mad_std(image, ignore_nan=True))
    if bkg_std <= 0:
        bkg_std = 1.0
        
    # Replace NaNs with background median for detection kernel
    data_for_finder = np.copy(image)
    data_for_finder[~valid_mask] = bkg_median
    
    threshold = nsigma * bkg_std
    daofind = DAOStarFinder(fwhm=fwhm, threshold=threshold)
    sources = daofind(data_for_finder - bkg_median)
    
    if sources is None or len(sources) == 0:
        return np.empty((0, 2), dtype=np.float32), bkg_std
        
    # Filter out sources detected right on masked NaN pixels
    pts = []
    x_col = "x_centroid" if "x_centroid" in sources.colnames else "xcentroid"
    y_col = "y_centroid" if "y_centroid" in sources.colnames else "ycentroid"
    for row in sources:
        x, y = float(row[x_col]), float(row[y_col])
        ix, iy = int(round(x)), int(round(y))
        if 0 <= iy < image.shape[0] and 0 <= ix < image.shape[1]:
            if valid_mask[iy, ix]:
                pts.append([x, y])
                
    if not pts:
        return np.empty((0, 2), dtype=np.float32), bkg_std
    return np.array(pts, dtype=np.float32), bkg_std

def detect_candidates(
    epoch_frames: Dict[str, Tuple[np.ndarray, WCS]],
    matched_pairs: List[Tuple[str, str]],
    nsigma: float = 5.0,
    match_radius_px: float = 1.5,
    max_shift_px: float = 8.0,
    fwhm: float = 3.0
) -> List[Candidate]:
    """
    Detects moving candidates across wavelength-matched observation epoch pairs.
    Stationary sources (shift <= match_radius_px) are rejected.
    Shifts between match_radius_px and max_shift_px are marked as 'moved_source'.
    """
    if not matched_pairs or not epoch_frames:
        return []
        
    # 1. Extract sources for each epoch
    extracted: Dict[str, Tuple[np.ndarray, float]] = {}
    for ep_id, (img, _) in epoch_frames.items():
        extracted[ep_id] = _extract_sources(img, fwhm=fwhm, nsigma=nsigma)
        
    candidates: List[Candidate] = []
    cand_counter = 1
    
    # 2. Iterate over matched pairs
    for ep_a_id, ep_b_id in matched_pairs:
        if ep_a_id not in epoch_frames or ep_b_id not in epoch_frames:
            continue
            
        pts_a, std_a = extracted[ep_a_id]
        pts_b, std_b = extracted[ep_b_id]
        
        if len(pts_a) == 0 or len(pts_b) == 0:
            continue
            
        wcs_a = epoch_frames[ep_a_id][1]
        wcs_b = epoch_frames[ep_b_id][1]
        
        tree_b = cKDTree(pts_b)
        # Query nearest neighbor in ep_b for each source in ep_a
        dists, indices = tree_b.query(pts_a, k=1)
        
        for idx_a, (dist, idx_b) in enumerate(zip(dists, indices)):
            # Stationary star
            if dist <= match_radius_px:
                continue
                
            # Candidate moved source
            if dist <= max_shift_px:
                pt_a = pts_a[idx_a]
                pt_b = pts_b[idx_b]
                
                ra_a, dec_a = wcs_a.pixel_to_world_values(pt_a[0], pt_a[1])
                ra_b, dec_b = wcs_b.pixel_to_world_values(pt_b[0], pt_b[1])
                
                cand_id = f"CAND-DET-{cand_counter:02d}"
                cand_counter += 1
                
                track = [
                    CandidateTrackPoint(
                        epochId=ep_a_id,
                        x=round(float(pt_a[0]), 2),
                        y=round(float(pt_a[1]), 2),
                        ra=round(float(ra_a), 5),
                        dec=round(float(dec_a), 5)
                    ),
                    CandidateTrackPoint(
                        epochId=ep_b_id,
                        x=round(float(pt_b[0]), 2),
                        y=round(float(pt_b[1]), 2),
                        ra=round(float(ra_b), 5),
                        dec=round(float(dec_b), 5)
                    )
                ]
                
                shift_arcsec = round(float(dist * 6.2), 2)
                candidates.append(Candidate(
                    id=cand_id,
                    kind="moved_source",
                    status="candidate",
                    track=track,
                    snr=round(float(nsigma * 2.2), 1),
                    match=None,
                    explanation=CandidateExplanation(
                        text=f"Astrometric displacement of {shift_arcsec} arcsec ({dist:.1f} px) detected between matched epochs {ep_a_id} and {ep_b_id}.",
                        source="template"
                    )
                ))
                
    return candidates
