import pytest
from pathlib import Path

def test_get_curated_fields():
    from app.services.fields import get_curated_field, get_all_curated_fields
    fields = get_all_curated_fields()
    assert len(fields) >= 3
    ids = [f.id for f in fields]
    assert "m101" in ids or "curated-m101-control" in ids
    
    # Test lookup near Barnard's Star (269.4521, 4.6934)
    found = get_curated_field(ra=269.452, dec=4.693, fov_deg=0.25)
    assert found is not None
    assert "barnard" in found.id.lower()
    assert len(found.epochs) >= 3
    assert len(found.matchedPairs) >= 1
    assert found.provenance.credit.startswith("SPHEREx data:")

def test_bake_curated_fields(tmp_path):
    from app.services.fields import bake_fields_to_disk
    manifests = bake_fields_to_disk(tmp_path)
    assert len(manifests) >= 3
    for m in manifests:
        field_dir = tmp_path / m.id
        assert field_dir.exists()
        assert (field_dir / "manifest.json").exists()
        assert (field_dir / "frames").exists()
