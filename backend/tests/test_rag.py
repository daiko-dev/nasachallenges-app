import math
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.embedding import generate_embedding, generate_embeddings
from app.services.rag import (
    candidate_to_text,
    upsert_manifest_to_supabase,
    fetch_rag_context
)
from app.services.fields import get_curated_field_by_id
from app.core.config import settings
from app.core.security import verify_api_key

client = TestClient(app)

def test_generate_embedding_dimension_and_norm():
    text = "Candidate astrometric detection across 4 SPHEREx epochs"
    vec = generate_embedding(text)
    assert len(vec) == 384
    norm = math.sqrt(sum(x * x for x in vec))
    assert abs(norm - 1.0) < 1e-4

def test_generate_embeddings_batch():
    texts = ["Candidate 1", "Candidate 2"]
    vecs = generate_embeddings(texts)
    assert len(vecs) == 2
    for v in vecs:
        assert len(v) == 384
        norm = math.sqrt(sum(x * x for x in v))
        assert abs(norm - 1.0) < 1e-4

def test_candidate_to_text_grounded():
    manifest = get_curated_field_by_id("m101-pinwheel")
    assert manifest is not None
    assert len(manifest.candidates) > 0
    candidate = manifest.candidates[0]
    
    text = candidate_to_text(candidate, manifest)
    assert candidate.id in text
    assert manifest.id in text
    assert "SPHEREx" in text or "epochs" in text

def test_upsert_manifest_with_mock_supabase():
    mock_sb = MagicMock()
    # Mock tables and RPC
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.upsert.return_value.execute.return_value.data = [{"id": "mock-manifest-uuid"}]
    mock_table.insert.return_value.execute.return_value.data = [{"id": "mock-candidate-uuid"}]
    
    manifest = get_curated_field_by_id("m101-pinwheel")
    res = upsert_manifest_to_supabase(manifest, client=mock_sb)
    assert res is not None
    assert res["id"] == "mock-manifest-uuid"
    assert mock_sb.table.call_count >= 1

def test_fetch_rag_context_with_mock():
    mock_sb = MagicMock()
    mock_sb.rpc.return_value.execute.return_value.data = [
        {"id": "uuid-1", "candidate_id": "cand-uuid", "similarity": 0.88, "content_text": "sample"}
    ]
    
    results = fetch_rag_context("query", field_id="m101-pinwheel", client=mock_sb)
    assert len(results) == 1
    assert results[0]["similarity"] == 0.88

def test_report_generate_endpoint_success():
    resp = client.post(
        "/api/v1/report/generate",
        json={"field_id": "m101-pinwheel", "candidate_id": "CAND-M101-01", "lang": "en"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["candidateId"] == "CAND-M101-01"
    assert "report" in data
    assert "text" in data["report"]
    assert "CAND-M101-01" in data["facts"]["candidateId"]

def test_report_generate_endpoint_not_found():
    resp = client.post(
        "/api/v1/report/generate",
        json={"field_id": "m101-pinwheel", "candidate_id": "non-existent-cand", "lang": "en"}
    )
    assert resp.status_code == 404

def test_api_key_security_check():
    # When API_KEY is set in settings
    with patch.object(settings, "API_KEY", "secret-test-key"):
        # Without key -> 401
        resp = client.post("/api/v1/rag/sync", json={"dummy": "data"})
        assert resp.status_code == 401

        # With wrong key -> 401
        resp = client.post("/api/v1/rag/sync", headers={"X-API-Key": "wrong-key"}, json={"dummy": "data"})
        assert resp.status_code == 401
