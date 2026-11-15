from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel

from app.core.security import verify_api_key
from app.schemas.manifest import FieldManifest, Candidate
from app.services.rag import (
    upsert_manifest_to_supabase,
    fetch_rag_context
)
from app.services.report import (
    generate_candidate_report,
    facts_for
)
from app.services.fields import get_curated_field_by_id

router = APIRouter()

class CandidateReportRequest(BaseModel):
    field_id: str
    candidate_id: str
    lang: str = "en"

class RAGSearchRequest(BaseModel):
    query: str
    field_id: Optional[str] = None
    top_k: int = 5

@router.post("/rag/sync", dependencies=[Depends(verify_api_key)])
def sync_manifest_to_rag(manifest: FieldManifest):
    """
    Syncs a FieldManifest, its moving candidates, and generated vector embeddings
    into Supabase pgvector. Requires valid API Key if configured.
    """
    res = upsert_manifest_to_supabase(manifest)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is unavailable or credentials are not configured."
        )
    return {"status": "success", "field_id": manifest.fieldId, "manifest": res}

@router.get("/rag/search")
def search_rag(
    query: str = Query(..., description="Semantic query text"),
    field_id: Optional[str] = Query(None, description="Optional fieldId filter"),
    top_k: int = Query(5, ge=1, le=20)
):
    """
    Performs cosine similarity search using the self-hosted transformer
    embeddings and Supabase pgvector match RPC.
    """
    results = fetch_rag_context(query_text=query, field_id=field_id, top_k=top_k)
    return {"query": query, "count": len(results), "results": results}

@router.post("/report/generate")
def create_candidate_report(req: CandidateReportRequest):
    """
    Generates a grounded scientific report for a candidate.
    Leverages Supabase RAG vector context when available, falling back
    transparently to deterministic grounded templates.
    """
    # 1. Retrieve the manifest
    manifest = get_curated_field_by_id(req.field_id)
    if not manifest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field '{req.field_id}' not found."
        )

    # 2. Locate the candidate
    matched_cand = next((c for c in manifest.candidates if c.id == req.candidate_id), None)
    if not matched_cand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate '{req.candidate_id}' not found in field '{req.field_id}'."
        )

    # 3. Compile facts
    facts = facts_for(matched_cand, manifest)

    # 4. Attempt RAG enrichment from Supabase
    rag_snippets = fetch_rag_context(
        query_text=f"Candidate {matched_cand.id} motion asteroid snr {matched_cand.snr}",
        field_id=req.field_id,
        top_k=2
    )

    # 5. Generate report
    report = generate_candidate_report(
        facts=facts,
        lang=req.lang if req.lang in ("en", "es") else "en"
    )

    if rag_snippets:
        report["rag_context"] = rag_snippets
        report["source"] = "rag+template"

    return {
        "candidateId": req.candidate_id,
        "fieldId": req.field_id,
        "facts": facts,
        "report": report
    }
