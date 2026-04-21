-- 1. Add is_approved to data_sources
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. Create data_source_maintainers table
CREATE TABLE IF NOT EXISTS public.data_source_maintainers (
  data_source_id UUID NOT NULL REFERENCES public.data_sources(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by       UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (data_source_id, user_id)
);

ALTER TABLE public.data_source_maintainers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_source_maintainers' AND policyname = 'maintainers: public read') THEN
    CREATE POLICY "maintainers: public read" ON public.data_source_maintainers FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_source_maintainers' AND policyname = 'maintainers: insert by maintainer or admin') THEN
    CREATE POLICY "maintainers: insert by maintainer or admin" ON public.data_source_maintainers FOR INSERT WITH CHECK (
      auth.role() = 'authenticated' AND (
        EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = public.data_source_maintainers.data_source_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
      )
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_source_maintainers' AND policyname = 'maintainers: delete by maintainer or admin') THEN
    CREATE POLICY "maintainers: delete by maintainer or admin" ON public.data_source_maintainers FOR DELETE USING (
      auth.role() = 'authenticated' AND (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = public.data_source_maintainers.data_source_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
      )
    );
  END IF;
END $$;

-- 3. Trigger for creator
CREATE OR REPLACE FUNCTION public.add_creator_as_maintainer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.data_source_maintainers (data_source_id, user_id, added_by)
  VALUES (NEW.id, NEW.added_by, NEW.added_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_data_source_created ON public.data_sources;
CREATE TRIGGER on_data_source_created
  AFTER INSERT ON public.data_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_maintainer();

-- 4. Update manifest policies
DROP POLICY IF EXISTS "manifest: maintainer insert" ON public.ckan_package_manifest;
DROP POLICY IF EXISTS "manifest: maintainer update" ON public.ckan_package_manifest;

CREATE POLICY "manifest: maintainer insert"
  ON public.ckan_package_manifest FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = public.ckan_package_manifest.data_source_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "manifest: maintainer update"
  ON public.ckan_package_manifest FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND (
      EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = public.ckan_package_manifest.data_source_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

-- 5. Update docs_meta policies
DROP POLICY IF EXISTS "docs_meta: maintainer insert" ON public.docs_meta;
DROP POLICY IF EXISTS "docs_meta: maintainer update" ON public.docs_meta;
DROP POLICY IF EXISTS "docs_meta: maintainer delete" ON public.docs_meta;

CREATE POLICY "docs_meta: maintainer insert"
  ON public.docs_meta FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND 
    EXISTS (SELECT 1 FROM public.data_sources ds WHERE ds.id = docs_meta.data_source_id AND ds.is_approved = true) AND
    (
      EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = docs_meta.data_source_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "docs_meta: maintainer update"
  ON public.docs_meta FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND 
    EXISTS (SELECT 1 FROM public.data_sources ds WHERE ds.id = docs_meta.data_source_id AND ds.is_approved = true) AND
    (
      EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = docs_meta.data_source_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );

CREATE POLICY "docs_meta: maintainer delete"
  ON public.docs_meta FOR DELETE
  USING (
    auth.role() = 'authenticated' AND 
    (
      EXISTS (SELECT 1 FROM public.data_source_maintainers WHERE data_source_id = docs_meta.data_source_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND active = true)
    )
  );
