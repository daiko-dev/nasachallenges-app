import logging
from typing import Dict, Any, List, Optional
import json

from app.core.config import settings
from app.schemas.manifest import FieldManifest, Candidate
from app.services.supabase_client import get_supabase_client
from app.services.embedding import generate_embedding
from app.services.report import facts_for, explain_template

logger = logging.getLogger(__name__)

def candidate_to_text(candidate: Candidate, manifest: FieldManifest) -> str:
    """Produces a dense, grounded textual summary of the candidate for embedding."""
    facts = facts_for(candidate, manifest)
    summary = explain_template(facts, lang="en")
    
    details = [
        f"Candidate ID: {candidate.id}",
        f"Field ID: {manifest.id}",
        f"Position: RA {round(manifest.ra, 4)} deg, Dec {round(manifest.dec, 4)} deg",
        f"Signal-to-Noise Ratio: {candidate.snr}",
        f"Status: {candidate.status}",
        f"Kind: {candidate.kind}",
        f"Observation epochs count: {len(candidate.track)}",
        f"Scientific context: {summary}"
    ]
    if candidate.match:
        details.append(f"Catalog match: {candidate.match.catalog} {candidate.match.name} (sep {candidate.match.sepArcsec} arcsec)")
        
    return " | ".join(details)

def upsert_manifest_to_supabase(
    manifest: FieldManifest,
    client: Optional[Any] = None
) -> Optional[Dict[str, Any]]:
    """
    Persists a FieldManifest and its candidates + embeddings into Supabase.
    Returns the manifest record info or None on failure.
    """
    sb = client or get_supabase_client()
    if not sb:
        logger.warning("Supabase client not available. Skipping RAG manifest persistence.")
        return None

    try:
        manifest_dict = manifest.model_dump(mode="json")
        manifest_payload = {
            "field_id": manifest.id,
            "ra": manifest.ra,
            "dec": manifest.dec,
            "fov_deg": manifest.fovDeg,
            "manifest_data": manifest_dict,
        }
        
        # Upsert manifest
        m_res = sb.table("manifests").upsert(
            manifest_payload, on_conflict="field_id"
        ).execute()
        
        manifest_record = m_res.data[0] if m_res.data else None
        if not manifest_record:
            logger.error("Failed to upsert manifest into Supabase.")
            return None
            
        manifest_db_id = manifest_record.get("id")

        # Persist candidates and their embeddings
        for candidate in manifest.candidates:
            c_dict = candidate.model_dump(mode="json")
            candidate_payload = {
                "manifest_id": manifest_db_id,
                "candidate_id": candidate.id,
                "kind": candidate.kind,
                "snr": candidate.snr,
                "status": candidate.status,
                "track": c_dict.get("track"),
                "match_catalog": candidate.match.catalog if candidate.match else None,
                "match_name": candidate.match.name if candidate.match else None,
                "match_sep_arcsec": candidate.match.sepArcsec if candidate.match else None,
                "candidate_data": c_dict
            }
            
            c_res = sb.table("candidates").insert(candidate_payload).execute()
            candidate_db_id = c_res.data[0].get("id") if c_res.data else None

            if candidate_db_id:
                text_content = candidate_to_text(candidate, manifest)
                embedding = generate_embedding(text_content)
                
                emb_payload = {
                    "candidate_id": candidate_db_id,
                    "field_id": manifest.id,
                    "content_text": text_content,
                    "embedding": embedding
                }
                sb.table("candidate_embeddings").insert(emb_payload).execute()

        logger.info(f"Successfully stored manifest '{manifest.id}' with {len(manifest.candidates)} candidates in Supabase.")
        return manifest_record

    except Exception as e:
        logger.error(f"Error persisting manifest to Supabase: {e}")
        return None

def fetch_rag_context(
    query_text: str,
    field_id: Optional[str] = None,
    top_k: int = 5,
    match_threshold: float = 0.1,
    client: Optional[Any] = None
) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search over candidate embeddings in Supabase
    using the generated query embedding and pgvector cosine similarity.
    """
    sb = client or get_supabase_client()
    if not sb:
        logger.warning("Supabase client not available for RAG search.")
        return []

    try:
        query_vector = generate_embedding(query_text)
        params = {
            "query_embedding": query_vector,
            "match_threshold": match_threshold,
            "match_count": top_k,
            "filter_field_id": field_id
        }
        
        # Invoke Postgres RPC
        rpc_res = sb.rpc("match_candidate_embeddings", params).execute()
        return rpc_res.data or []
    except Exception as e:
        logger.error(f"Error executing match_candidate_embeddings RPC: {e}")
        return []

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    logger.info("Running SVDV RAG sync CLI...")
    if "--sync" in sys.argv:
        from app.services.fields import get_all_curated_fields
        curated = get_all_curated_fields()
        logger.info(f"Syncing {len(curated)} curated fields to Supabase...")
        client = get_supabase_client()
        if client:
            for manifest in curated:
                upsert_manifest_to_supabase(manifest, client=client)
            logger.info("Sync completed.")
        else:
            logger.warning("Supabase client unavailable for sync.")
