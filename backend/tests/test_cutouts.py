import pytest
import numpy as np
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def test_cutout_has_six_hdus():
    from app.services.cutouts import inspect_cutout_hdus
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    hdus = inspect_cutout_hdus(fits_path)
    assert len(hdus) == 6
    assert "IMAGE" in hdus
    assert "FLAGS" in hdus
    assert "VARIANCE" in hdus
    assert "ZODI" in hdus
    assert "EPSF" in hdus
    assert "WCS-WAVE" in hdus

def test_lambda_within_instrument_range():
    from app.services.cutouts import lambda_at
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    lam, bw = lambda_at(fits_path, ra=210.802, dec=54.349)
    assert 0.75 <= lam <= 5.0
    assert 0.005 <= bw <= 0.2

def test_target_near_edge_raises():
    from app.services.cutouts import read_cutout, TargetOutsideError
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    # Target near the edge (pixel 1, 1 which is <= 3px from edge)
    # The image is 60x60 centered at 210.802, 54.349 with scale -6.2"/px (0.001722 deg/px)
    # Corner pixel offset by ~0.048 deg from center
    with pytest.raises(TargetOutsideError):
        read_cutout(fits_path, ra=210.802 + 0.048, dec=54.349 + 0.048, edge_margin_px=3)

def test_masked_pixels_become_nan():
    from app.services.cutouts import read_cutout
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    # Read cutout centered at 210.802, 54.349 (center pixel is at ~30, 30)
    cutout = read_cutout(fits_path, ra=210.802, dec=54.349, edge_margin_px=3)
    
    # Boundary pixels where FLAGS > 0 should be masked to NaN in the cleaned image
    assert np.isnan(cutout.cleaned_image[0, 0])
    assert np.isnan(cutout.cleaned_image[5, 5])  # marked as bad in fixture
    # Center pixel (good) should NOT be NaN
    assert not np.isnan(cutout.cleaned_image[30, 30])
    assert cutout.detector == 3
    assert 0.75 <= cutout.lambda_um <= 5.0
