-- 1. Remove authenticated insert rights on docs_meta to enforce Edge Function validation
DROP POLICY IF EXISTS "docs_meta: maintainer insert" ON public.docs_meta;
-- Note: Service role (used by Edge Functions) ignores RLS. So no new policy is required for service_role inserts.

-- 2. Add Geo-Location columns to data_sources for spatial sorting
ALTER TABLE public.data_sources 
  ADD COLUMN IF NOT EXISTS latitude FLOAT, 
  ADD COLUMN IF NOT EXISTS longitude FLOAT, 
  ADD COLUMN IF NOT EXISTS region TEXT;

-- 3. Replace match_vectors_meta to include an optional filter_data_source_id for subset searching
CREATE OR REPLACE FUNCTION match_vectors_meta(
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_data_source_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  packageid text,
  metadata jsonb,
  embedding vector(384),
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    docs_meta.id,
    docs_meta.package AS packageid,
    docs_meta.metadata,
    docs_meta.embedding,
    1 - (docs_meta.embedding <=> query_embedding) AS similarity
  FROM docs_meta
  WHERE 1 - (docs_meta.embedding <=> query_embedding) > match_threshold
    AND (filter_data_source_id IS NULL OR docs_meta.data_source_id = filter_data_source_id)
  ORDER BY docs_meta.embedding <=> query_embedding
  LIMIT match_count;
$$;
