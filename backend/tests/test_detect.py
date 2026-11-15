import pytest
import numpy as np
from astropy.wcs import WCS

def _make_test_wcs():
    w = WCS(naxis=2)
    w.wcs.crpix = [30.0, 30.0]
    w.wcs.cdelt = [-6.2 / 3600.0, 6.2 / 3600.0]
    w.wcs.crval = [210.802, 54.349]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return w

def test_static_field_yields_no_candidates():
    from app.services.detect import detect_candidates
    wcs = _make_test_wcs()
    np.random.seed(42)
    
    # 2 identical epochs with 5 stationary stars
    base = np.random.normal(10.0, 1.0, (60, 60)).astype(np.float32)
    y, x = np.mgrid[0:60, 0:60]
    for sx, sy in [(15, 15), (45, 15), (30, 30), (15, 45), (45, 45)]:
        base += (50.0 * np.exp(-((x - sx)**2 + (y - sy)**2) / (2 * 1.5**2))).astype(np.float32)
        
    frames = {
        "e01": (base, wcs),
        "e02": (base.copy(), wcs)
    }
    
    cands = detect_candidates(
        epoch_frames=frames,
        matched_pairs=[("e01", "e02")],
        nsigma=5.0
    )
    # Stationary stars should NOT be flagged as moved_source
    moved = [c for c in cands if c.kind == "moved_source"]
    assert len(moved) == 0

def test_injected_mover_is_recovered():
    from app.services.detect import detect_candidates
    wcs = _make_test_wcs()
    np.random.seed(123)
    
    y, x = np.mgrid[0:60, 0:60]
    # Frame 1: Star at (20, 20), mover at (30, 30)
    f1 = np.random.normal(10.0, 1.0, (60, 60)).astype(np.float32)
    f1 += (50.0 * np.exp(-((x - 20)**2 + (y - 20)**2) / (2 * 1.5**2))).astype(np.float32)
    f1 += (60.0 * np.exp(-((x - 30)**2 + (y - 30)**2) / (2 * 1.5**2))).astype(np.float32)
    
    # Frame 2: Star at (20, 20), mover moved by +4 px in X to (34, 30)
    f2 = np.random.normal(10.0, 1.0, (60, 60)).astype(np.float32)
    f2 += (50.0 * np.exp(-((x - 20)**2 + (y - 20)**2) / (2 * 1.5**2))).astype(np.float32)
    f2 += (60.0 * np.exp(-((x - 34)**2 + (y - 30)**2) / (2 * 1.5**2))).astype(np.float32)
    
    frames = {
        "e01": (f1, wcs),
        "e02": (f2, wcs)
    }
    
    cands = detect_candidates(
        epoch_frames=frames,
        matched_pairs=[("e01", "e02")],
        nsigma=4.0,
        match_radius_px=1.5,
        max_shift_px=6.0
    )
    
    assert len(cands) >= 1
    mover = cands[0]
    assert mover.kind == "moved_source"
    assert len(mover.track) == 2
    # Check recovered track coordinates are close to injected positions (30, 30) and (34, 30)
    assert abs(mover.track[0].x - 30.0) < 0.6
    assert abs(mover.track[0].y - 30.0) < 0.6
    assert abs(mover.track[1].x - 34.0) < 0.6
    assert abs(mover.track[1].y - 30.0) < 0.6

def test_flagged_pixels_never_produce_candidates():
    from app.services.detect import detect_candidates
    wcs = _make_test_wcs()
    
    # Image where the only "hot" pixels are NaNs (masked flags)
    f1 = np.full((60, 60), 10.0, dtype=np.float32)
    f1[25:35, 25:35] = np.nan
    f2 = np.full((60, 60), 10.0, dtype=np.float32)
    f2[25:35, 25:35] = np.nan
    
    frames = {"e01": (f1, wcs), "e02": (f2, wcs)}
    cands = detect_candidates(frames, [("e01", "e02")], nsigma=3.0)
    assert len(cands) == 0

def test_mismatched_lambda_pairs_are_skipped():
    from app.services.detect import detect_candidates
    wcs = _make_test_wcs()
    f1 = np.random.normal(10.0, 1.0, (60, 60)).astype(np.float32)
    f2 = np.random.normal(10.0, 1.0, (60, 60)).astype(np.float32)
    
    frames = {"e01": (f1, wcs), "e02": (f2, wcs)}
    # If matched_pairs is empty because wavelengths didn't match, 0 candidates
    cands = detect_candidates(frames, [], nsigma=3.0)
    assert len(cands) == 0
