-- ============================================================
-- Clean up pre-existing policies that may conflict
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own search history" ON public.search_history;

-- ============================================================
-- data_sources: registry of CKAN portals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ckan_url     TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  authority    TEXT,
  country      TEXT,          -- ISO 3166-1 alpha-2, e.g. 'CA', 'GB'
  icon_url     TEXT,          -- nullable; auto-detected or admin override
  is_approved  BOOLEAN DEFAULT FALSE,
  added_by     UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_sources: public read"
  ON public.data_sources FOR SELECT USING (true);

CREATE POLICY "data_sources: authenticated insert"
  ON public.data_sources FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "data_sources: admin update"
  ON public.data_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "data_sources: admin delete"
  ON public.data_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- ============================================================
-- data_source_maintainers: many-to-many relationship
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_source_maintainers (
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by       UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (data_source_id, user_id)
);

ALTER TABLE public.data_source_maintainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintainers: public read"
  ON public.data_source_maintainers FOR SELECT USING (true);

CREATE POLICY "maintainers: insert by maintainer or admin"
  ON public.data_source_maintainers FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = public.data_source_maintainers.data_source_id
          AND user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

CREATE POLICY "maintainers: delete by maintainer or admin"
  ON public.data_source_maintainers FOR DELETE
  USING (
    auth.role() = 'authenticated' AND (
      user_id = auth.uid() -- can delete self
      OR
      EXISTS ( -- or other maintainers
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = public.data_source_maintainers.data_source_id
          AND user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- Trigger to automatically add creator as first maintainer
CREATE OR REPLACE FUNCTION public.add_creator_as_maintainer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.added_by IS NOT NULL THEN
    INSERT INTO public.data_source_maintainers (data_source_id, user_id, added_by)
    VALUES (NEW.id, NEW.added_by, NEW.added_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_data_source_created ON public.data_sources;
CREATE TRIGGER on_data_source_created
  AFTER INSERT ON public.data_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_maintainer();

-- ============================================================
-- ckan_package_manifest: progress ledger for ingestion
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ckan_package_manifest (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id    UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  package_id        TEXT NOT NULL,
  metadata_modified TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'ingested', 'error')),
  error_message     TEXT,
  enumerated_at     TIMESTAMPTZ DEFAULT now(),
  ingested_at       TIMESTAMPTZ,
  UNIQUE (data_source_id, package_id)
);

ALTER TABLE public.ckan_package_manifest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manifest: public read"
  ON public.ckan_package_manifest FOR SELECT USING (true);

CREATE POLICY "manifest: maintainer insert"
  ON public.ckan_package_manifest FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = public.ckan_package_manifest.data_source_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "manifest: maintainer update"
  ON public.ckan_package_manifest FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = public.ckan_package_manifest.data_source_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );


-- ============================================================
-- docs_meta: add data_source_id and url columns
-- ============================================================
ALTER TABLE public.docs_meta
  ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id),
  ADD COLUMN IF NOT EXISTS url TEXT;

-- Remove old policies
DROP POLICY IF EXISTS "Authenticated can write docs" ON public.docs_meta;
DROP POLICY IF EXISTS "Service role bypass for docs_meta" ON public.docs_meta;
DROP POLICY IF EXISTS "Admins can manage docs_meta" ON public.docs_meta;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'docs_meta' AND policyname = 'docs_meta: public read'
  ) THEN
    EXECUTE 'CREATE POLICY "docs_meta: public read" ON public.docs_meta FOR SELECT USING (true)';
  END IF;
END $$;

CREATE POLICY "docs_meta: maintainer insert"
  ON public.docs_meta FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.data_sources ds
      WHERE ds.id = data_source_id AND ds.is_approved = true
    ) AND
    (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = data_source_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "docs_meta: maintainer update"
  ON public.docs_meta FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM public.data_sources ds
      WHERE ds.id = data_source_id AND ds.is_approved = true
    ) AND
    (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = data_source_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "docs_meta: maintainer delete"
  ON public.docs_meta FOR DELETE
  USING (
    auth.role() = 'authenticated' AND 
    (
      EXISTS (
        SELECT 1 FROM public.data_source_maintainers
        WHERE data_source_id = docs_meta.data_source_id
          AND user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

-- ============================================================
-- translations: LLM-generated UI translations
-- Written only by translate-ui edge function (service role)
-- ============================================================
CREATE TABLE public.translations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale       TEXT NOT NULL UNIQUE,
  translations JSONB NOT NULL,
  strings_hash TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT          -- e.g. 'claude-opus-4-6'
);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations: public read"
  ON public.translations FOR SELECT USING (true);

-- INSERT and UPDATE only via service role (edge functions)
