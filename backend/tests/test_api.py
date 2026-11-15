import pytest
from fastapi.testclient import TestClient

def test_health_endpoint():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "irsa" in data
    assert data["irsa"] in ["up", "down"]
    assert "checkedUtc" in data

def test_health_v1_endpoint():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200

def test_field_curated_m101():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/v1/field?ra=210.8023&dec=54.3490&fov=0.25")
    assert response.status_code == 200
    manifest = response.json()
    assert manifest["schemaVersion"] == "1.0"
    assert "m101" in manifest["id"].lower()
    assert len(manifest["epochs"]) >= 3
    assert len(manifest["matchedPairs"]) >= 1
    assert manifest["provenance"]["credit"].startswith("SPHEREx data:")

def test_field_curated_barnard():
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/field?ra=269.4521&dec=4.6934&fov=0.25")
    assert response.status_code == 200
    manifest = response.json()
    assert "barnard" in manifest["id"].lower()
    assert len(manifest["candidates"]) >= 1
    assert manifest["candidates"][0]["match"]["catalog"] == "Gaia DR3"

def test_field_ra_out_of_range_is_normalized():
    # Review Focus 5: RA < 0 is normalized to [0, 360)
    from app.main import app
    client = TestClient(app)
    response = client.get("/api/v1/field?ra=-90.5479&dec=4.6934&fov=0.25")
    assert response.status_code == 200
    manifest = response.json()
    # Normalized RA: -90.5479 + 360 = 269.4521 (Barnard's Star)
    assert "barnard" in manifest["id"].lower()

def test_field_no_coverage_returns_200_with_message(monkeypatch):
    # Review Focus 1: Uncovered sky coordinate returns HTTP 200 with empty epochs and helpful message, never 500
    from app.main import app
    import app.services.query as query_module
    
    # Mock search_epochs to return empty list
    monkeypatch.setattr(query_module, "search_epochs", lambda *args, **kwargs: [])
    
    client = TestClient(app)
    # Coordinate far away from any curated field
    response = client.get("/api/v1/field?ra=45.1234&dec=-30.5678&fov=0.1")
    assert response.status_code == 200
    data = response.json()
    assert data["schemaVersion"] == "1.0"
    assert data["epochs"] == []
    assert data["message"] is not None
    assert "no spherex coverage" in data["message"].lower() or "no observations" in data["message"].lower()

def test_cors_headers_present():
    from app.main import app
    client = TestClient(app)
    response = client.options(
        "/api/v1/field",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") in ["*", "http://localhost:5173"]
