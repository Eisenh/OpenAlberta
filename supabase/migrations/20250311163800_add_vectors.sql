-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to docs table
ALTER TABLE docs ADD COLUMN embedding vector(384);

-- Create index for efficient similarity search
CREATE INDEX ON docs USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
