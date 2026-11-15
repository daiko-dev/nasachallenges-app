-- Migration: 20261115_01_init_svdv_rag.sql
-- Description: Schema setup for SVDV RAG backend (SphereX Viewer & Data Visualizer)
-- Target: Supabase Postgres with pgvector

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Manifests table
CREATE TABLE IF NOT EXISTS public.manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id TEXT NOT NULL UNIQUE,
    ra DOUBLE PRECISION NOT NULL,
    dec DOUBLE PRECISION NOT NULL,
    fov_deg DOUBLE PRECISION NOT NULL,
    manifest_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick field lookup
CREATE INDEX IF NOT EXISTS idx_manifests_field_id ON public.manifests (field_id);

-- 3. Candidates table
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifest_id UUID NOT NULL REFERENCES public.manifests (id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    snr DOUBLE PRECISION,
    status TEXT,
    track JSONB,
    match_catalog TEXT,
    match_name TEXT,
    match_sep_arcsec DOUBLE PRECISION,
    candidate_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for foreign key and candidate queries
CREATE INDEX IF NOT EXISTS idx_candidates_manifest_id ON public.candidates (manifest_id);
CREATE INDEX IF NOT EXISTS idx_candidates_candidate_id ON public.candidates (candidate_id);

-- 4. Candidate Embeddings table (Vector size: 384 for transformer embeddings like all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS public.candidate_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates (id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    content_text TEXT NOT NULL,
    embedding extensions.vector(384) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_candidate_id ON public.candidate_embeddings (candidate_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_field_id ON public.candidate_embeddings (field_id);

-- HNSW Vector Index for efficient cosine similarity search
CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_vector 
ON public.candidate_embeddings 
USING hnsw (embedding extensions.vector_cosine_ops);

-- 5. RPC function for semantic RAG search
CREATE OR REPLACE FUNCTION match_candidate_embeddings (
    query_embedding extensions.vector(384),
    match_threshold DOUBLE PRECISION DEFAULT 0.5,
    match_count INT DEFAULT 5,
    filter_field_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    candidate_id UUID,
    field_id TEXT,
    content_text TEXT,
    similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.candidate_id,
        ce.field_id,
        ce.content_text,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM public.candidate_embeddings ce
    WHERE 
        (filter_field_id IS NULL OR ce.field_id = filter_field_id)
        AND (1 - (ce.embedding <=> query_embedding)) >= match_threshold
    ORDER BY ce.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Row Level Security (RLS) policies
ALTER TABLE public.manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to scientific visualization data
CREATE POLICY "Allow public read access to manifests"
ON public.manifests FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public read access to candidates"
ON public.candidates FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow public read access to candidate embeddings"
ON public.candidate_embeddings FOR SELECT
TO anon, authenticated
USING (true);

-- Allow service role and API writes
CREATE POLICY "Allow service role full access to manifests"
ON public.manifests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role full access to candidates"
ON public.candidates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service role full access to candidate embeddings"
ON public.candidate_embeddings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
