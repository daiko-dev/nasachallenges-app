import pytest
from pydantic import ValidationError

def test_epoch_schema():
    from app.schemas.manifest import Epoch
    epoch = Epoch(
        id="ep-1",
        obsId="SPX_001_D3",
        utc="2026-03-15T12:00:00Z",
        release="dr1",
        detector=3,
        lambdaUm=1.42,
        bandwidthUm=0.03,
        frameUrl="/data/frames/ep-1.png",
        sourceUrl="https://irsa.ipac.caltech.edu/cutout"
    )
    assert epoch.id == "ep-1"
    assert epoch.release == "dr1"
    assert epoch.detector == 3
    assert epoch.lambdaUm == 1.42

def test_epoch_invalid_detector():
    from app.schemas.manifest import Epoch
    with pytest.raises(ValidationError):
        Epoch(
            id="ep-1",
            obsId="SPX_001",
            utc="2026-03-15T12:00:00Z",
            release="dr1",
            detector=7,  # Detectors are 1-6 only
            lambdaUm=1.42,
            bandwidthUm=0.03,
            frameUrl="/data/frames/ep-1.png",
            sourceUrl="https://irsa.ipac.caltech.edu/cutout"
        )

def test_candidate_schema():
    from app.schemas.manifest import Candidate, CandidateTrackPoint, CandidateMatch, CandidateExplanation
    cand = Candidate(
        id="cand-01",
        kind="moved_source",
        status="candidate",
        track=[
            CandidateTrackPoint(epochId="ep-1", x=30.0, y=30.0, ra=210.80, dec=54.34),
            CandidateTrackPoint(epochId="ep-2", x=34.0, y=30.0, ra=210.81, dec=54.34)
        ],
        snr=12.5,
        match=CandidateMatch(catalog="MPCORB", name="Asteroid 1999 RQ36", sepArcsec=1.2),
        explanation=CandidateExplanation(text="Candidate mover identified.", source="template")
    )
    assert cand.id == "cand-01"
    assert cand.kind == "moved_source"
    assert len(cand.track) == 2
    assert cand.match.name == "Asteroid 1999 RQ36"

def test_field_manifest_schema():
    from app.schemas.manifest import FieldManifest, Epoch, Candidate, GridInfo, ProvenanceInfo
    manifest = FieldManifest(
        schemaVersion="1.0",
        id="test-field",
        name="Test Field M101",
        ra=210.802,
        dec=54.349,
        fovDeg=0.25,
        grid=GridInfo(widthPx=60, heightPx=60, pixScaleArcsec=6.2),
        epochs=[
            Epoch(
                id="ep-1",
                obsId="SPX_001",
                utc="2026-03-15T12:00:00Z",
                release="dr1",
                detector=1,
                lambdaUm=0.98,
                bandwidthUm=0.02,
                frameUrl="/frames/1.png",
                sourceUrl="https://irsa.ipac.caltech.edu/1"
            )
        ],
        matchedPairs=[("ep-1", "ep-1")],
        candidates=[],
        message=None,
        provenance=ProvenanceInfo(
            collection="spherex_dr1",
            retrievedUtc="2026-11-15T12:00:00Z",
            synthetic=False,
            credit="SPHEREx data: NASA/JPL-Caltech/IPAC, via NASA/IPAC Infrared Science Archive"
        )
    )
    dumped = manifest.model_dump()
    assert dumped["schemaVersion"] == "1.0"
    assert dumped["id"] == "test-field"
    assert dumped["provenance"]["synthetic"] is False
