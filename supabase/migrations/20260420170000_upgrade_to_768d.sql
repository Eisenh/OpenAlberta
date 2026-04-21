-- Upgrade docs_meta to 768 Dimensions for EmbeddingGemma-300M Native MRL

-- 0. Clean house and delete the completely obsolete original docs table
DROP TABLE IF EXISTS public.docs;

-- 1. Drop existing indexes that depend on the 384D vector
DROP INDEX IF EXISTS docs_meta_embedding_idx;

-- 2. Clear old mathematically obsolete 384-D vectors so PostgreSQL allows the column to resize
TRUNCATE TABLE public.docs_meta;

-- 3. Harmonize the package column naming convention across the database
ALTER TABLE public.docs_meta RENAME COLUMN package TO package_id;

-- 4. Alter the column type to 768 dimensions
ALTER TABLE public.docs_meta 
ALTER COLUMN embedding TYPE vector(768);

-- 5. Recreate the match function to accept and return 768D vectors
DROP FUNCTION IF EXISTS match_vectors_meta(vector(384), float, int, uuid);

CREATE OR REPLACE FUNCTION match_vectors_meta(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_data_source_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  package_id text,
  metadata jsonb,
  embedding vector(768),
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    docs_meta.id,
    docs_meta.package_id,
    docs_meta.metadata,
    docs_meta.embedding,
    1 - (docs_meta.embedding <=> query_embedding) AS similarity
  FROM docs_meta
  WHERE 1 - (docs_meta.embedding <=> query_embedding) > match_threshold
    AND (filter_data_source_id IS NULL OR docs_meta.data_source_id = filter_data_source_id)
  ORDER BY docs_meta.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. Re-apply the IVFFlat index onto the new 768D array
CREATE INDEX docs_meta_embedding_idx ON docs_meta USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
