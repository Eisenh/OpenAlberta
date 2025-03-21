-- Drop the existing function
drop function if exists match_vectors(vector, double precision, integer);

-- Create the function again with the desired return type
create or replace function match_vectors(
  query_embedding vector(384),
  match_threshold float8,
  match_count int
) returns table (
  id uuid,
  package text,
  metadata jsonb,
  notes_embedding vector(384),
  similarity float8
) as $$
  select id, package, metadata, notes_embedding,
         1 - (notes_embedding <=> query_embedding::vector(384)) as similarity
  from docs
  where 1 - (notes_embedding <=> query_embedding::vector(384)) > match_threshold
  order by similarity desc
  limit match_count;
$$ language sql stable;