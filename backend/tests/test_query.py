import pytest
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def test_detector_parsed_from_filename():
    from app.services.query import parse_detector
    assert parse_detector("ivo://irsa.ipac/spherex/level2_SPX001D3_spx_l2b-60400") == 3
    assert parse_detector("level2_005421D1_spx_l2b.fits") == 1
    assert parse_detector("level2_005421D6_spx_l2b.fits") == 6
    assert parse_detector("unknown_filename.fits") == 1  # Default fallback

def test_ra_wraps_to_0_360():
    from app.services.query import normalize_ra
    assert normalize_ra(-0.01) == pytest.approx(359.99, abs=1e-4)
    assert normalize_ra(360.5) == pytest.approx(0.5, abs=1e-4)
    assert normalize_ra(120.0) == pytest.approx(120.0, abs=1e-4)
    assert normalize_ra(0.0) == pytest.approx(0.0, abs=1e-4)

def test_search_epochs_sorted_by_time():
    from app.services.query import search_epochs_from_votable
    votable_path = FIXTURES_DIR / "sample_sia_votable.xml"
    content = votable_path.read_text(encoding="utf-8")
    epochs = search_epochs_from_votable(content)
    
    assert len(epochs) == 3
    # Check sorted by t_mjd ascending
    assert epochs[0].t_mjd < epochs[1].t_mjd < epochs[2].t_mjd
    assert epochs[0].detector == 3
    assert epochs[0].collection == "spherex_dr1"
    assert epochs[2].detector == 1
    assert epochs[2].collection == "spherex_qr3"

def test_no_coverage_returns_empty_list():
    from app.services.query import search_epochs_from_votable
    empty_votable = """<?xml version="1.0" encoding="utf-8"?>
    <VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.4">
      <RESOURCE type="results">
        <TABLE ID="sia_results">
          <DATA><TABLEDATA></TABLEDATA></DATA>
        </TABLE>
      </RESOURCE>
    </VOTABLE>"""
    epochs = search_epochs_from_votable(empty_votable)
    assert epochs == []
