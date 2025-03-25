-- Create docs_meta table with deterministic UUIDs
CREATE TABLE public.docs_meta (
    id UUID PRIMARY KEY,
    packageId TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    embedding VECTOR(384)
);

-- Enable vector extension if not already present
CREATE EXTENSION IF NOT EXISTS vector;

-- Create similarity search index
CREATE INDEX ON docs_meta USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.docs_meta ENABLE ROW LEVEL SECURITY;

-- Create access policies matching docs table structure
CREATE POLICY "Admins can manage docs_meta" ON public.docs_meta
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.admin_users WHERE active = true
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.admin_users WHERE active = true
        )
    );

CREATE POLICY "Service role bypass for docs_meta" ON public.docs_meta
    USING (auth.jwt() ->> 'role' = 'service_role');
