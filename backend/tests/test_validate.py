import pytest

def test_known_asteroid_matched_within_tolerance():
    from app.services.validate import match_known_sbident
    from app.schemas.manifest import Candidate, CandidateTrackPoint
    
    cand = Candidate(
        id="CAND-01",
        kind="moved_source",
        status="candidate",
        track=[
            CandidateTrackPoint(epochId="e01", x=24.0, y=26.0, ra=210.8012, dec=54.3498)
        ],
        snr=15.0
    )
    
    mock_sbident_response = {
        "signature": {"version": "1.0"},
        "count": 1,
        "fields": ["object_name", "ra", "dec", "vmag", "dist"],
        "data": [
            ["(5812) Jayleno", "14 03 12.3", "+54 20 59", "16.2", "2.4"]  # dist in arcsec
        ]
    }
    
    match = match_known_sbident(cand, epoch_utc="2026-02-19T08:45:00Z", tol_arcsec=30.0, mock_payload=mock_sbident_response)
    assert match is not None
    assert match.catalog == "JPL SBIdent"
    assert match.name == "(5812) Jayleno"
    assert match.sepArcsec == 2.4

def test_no_match_returns_none():
    from app.services.validate import match_known_sbident
    from app.schemas.manifest import Candidate, CandidateTrackPoint
    
    cand = Candidate(
        id="CAND-02",
        kind="moved_source",
        status="candidate",
        track=[
            CandidateTrackPoint(epochId="e01", x=30.0, y=30.0, ra=120.0, dec=40.0)
        ],
        snr=10.0
    )
    
    mock_sbident_empty = {
        "signature": {"version": "1.0"},
        "count": 0,
        "data": []
    }
    
    match = match_known_sbident(cand, epoch_utc="2026-02-19T08:45:00Z", tol_arcsec=30.0, mock_payload=mock_sbident_empty)
    assert match is None

def test_network_error_returns_none_and_does_not_raise():
    from app.services.validate import match_known_sbident
    from app.schemas.manifest import Candidate, CandidateTrackPoint
    
    cand = Candidate(
        id="CAND-03",
        kind="moved_source",
        status="candidate",
        track=[
            CandidateTrackPoint(epochId="e01", x=30.0, y=30.0, ra=120.0, dec=40.0)
        ],
        snr=10.0
    )
    
    # Review Focus 4: If network is unreachable or times out, return None gracefully
    match = match_known_sbident(cand, epoch_utc="2026-02-19T08:45:00Z", api_url="http://invalid.domain.that.does.not.exist:9999/api")
    assert match is None
