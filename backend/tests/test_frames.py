import pytest
import numpy as np
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def test_lambda_matched_true_within_tolerance():
    from app.services.frames import lambda_matched
    # Same or very close wavelengths within 0.5 * bandwidth
    assert lambda_matched(1.420, 0.035, 1.425, 0.035, frac=0.5) is True
    assert lambda_matched(2.100, 0.050, 2.110, 0.050, frac=0.5) is True

def test_lambda_matched_false_for_different_bands():
    from app.services.frames import lambda_matched
    # Review Focus 3: Different bands (e.g. 1.0 um vs 2.0 um) MUST NOT match
    assert lambda_matched(1.000, 0.030, 2.000, 0.030, frac=0.5) is False
    assert lambda_matched(1.420, 0.035, 1.850, 0.040, frac=0.5) is False

def test_all_frames_share_one_grid():
    from app.services.cutouts import read_cutout
    from app.services.frames import create_common_wcs, reproject_to_common_grid
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    cutout = read_cutout(fits_path, ra=210.802, dec=54.349)
    
    target_wcs = create_common_wcs(ra=210.802, dec=54.349, pix_scale_arcsec=6.2, shape=(60, 60))
    reprojected = reproject_to_common_grid(cutout.cleaned_image, cutout.wcs, target_wcs, shape=(60, 60))
    
    assert reprojected.shape == (60, 60)
    assert not np.all(np.isnan(reprojected))

def test_render_frame_png(tmp_path):
    from app.services.frames import render_frame_png
    # Create test 60x60 array with some NaNs (masked pixels)
    arr = np.linspace(10, 100, 3600, dtype=np.float32).reshape(60, 60)
    arr[0, 0] = np.nan
    out_file = tmp_path / "frame_test.png"
    
    saved_path = render_frame_png(arr, out_file)
    assert saved_path.exists()
    assert saved_path.stat().st_size > 0

def test_manifest_has_required_keys(tmp_path):
    from app.services.frames import FieldSpec, build_field_manifest
    from app.services.cutouts import read_cutout
    fits_path = FIXTURES_DIR / "sample_cutout.fits"
    cutout = read_cutout(fits_path, ra=210.802, dec=54.349)
    
    spec = FieldSpec(
        id="m101-test",
        name="M101 Test Field",
        ra=210.802,
        dec=54.349,
        fov_deg=0.1
    )
    
    manifest = build_field_manifest(
        spec=spec,
        cutouts=[(cutout, "2026-03-15T12:00:00Z", "dr1", "https://irsa.ipac.caltech.edu/sample.fits")],
        out_dir=tmp_path
    )
    
    dumped = manifest.model_dump()
    assert dumped["schemaVersion"] == "1.0"
    assert dumped["id"] == "m101-test"
    assert len(dumped["epochs"]) == 1
    assert dumped["provenance"]["synthetic"] is False
    assert (tmp_path / "manifest.json").exists()
