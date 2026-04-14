# Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `data_sources`, `ckan_package_manifest`, and `translations` tables; add `data_source_id` and `url` columns to `docs_meta`; apply RLS policies throughout.

**Architecture:** Single migration file applied via Supabase CLI. RLS locks writes to edge functions (service role) except `data_sources` INSERT which authenticated users can do directly.

**Tech Stack:** PostgreSQL, pgvector (already installed), Supabase CLI, Row Level Security

**Prerequisite:** Plan 1 complete — `supabaseClient.ts` uses publishable key.

---

## File Map

| Action | File |
|---|---|
| Create | `supabase/migrations/20260413000000_generalize.sql` |
| Delete | `supabase/migrations/generalize_and_set_policy.sql` (superseded) |

---

## Task 1: Write the migration

**Files:**

- Create: `supabase/migrations/20260413000000_generalize.sql`

- [ ] **Step 1: Create the migration file**

  ```sql
  -- ============================================================
  -- data_sources: registry of CKAN portals
  -- ============================================================
  CREATE TABLE public.data_sources (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ckan_url     TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description  TEXT,
    authority    TEXT,
    country      TEXT,          -- ISO 3166-1 alpha-2, e.g. 'CA', 'GB'
    icon_url     TEXT,          -- nullable; auto-detected or admin override
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
  -- ckan_package_manifest: progress ledger for ingestion
  -- Written only by submit-document edge function (service role)
  -- ============================================================
  CREATE TABLE public.ckan_package_manifest (
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

  -- INSERT and UPDATE only via service role (edge functions)
  -- No policy = no access for non-service-role roles

  -- ============================================================
  -- docs_meta: add data_source_id and url columns
  -- ============================================================
  ALTER TABLE public.docs_meta
    ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id),
    ADD COLUMN IF NOT EXISTS url TEXT;

  -- Remove authenticated insert policy — writes now go through edge function only
  DROP POLICY IF EXISTS "Authenticated can write docs" ON public.docs_meta;
  DROP POLICY IF EXISTS "Service role bypass for docs_meta" ON public.docs_meta;
  DROP POLICY IF EXISTS "Admins can manage docs_meta" ON public.docs_meta;

  -- Public read stays (or recreate if it was dropped)
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'docs_meta' AND policyname = 'docs_meta: public read'
    ) THEN
      EXECUTE 'CREATE POLICY "docs_meta: public read" ON public.docs_meta FOR SELECT USING (true)';
    END IF;
  END $$;

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
  ```

- [ ] **Step 2: Delete the superseded draft migration**

  ```bash
  rm supabase/migrations/generalize_and_set_policy.sql
  ```

---

## Task 2: Apply the migration

- [ ] **Step 1: Verify Supabase CLI is available**

  ```bash
  supabase --version
  ```

  Expected: version string, e.g. `1.x.x`. If not installed: `npm install -g supabase`.

- [ ] **Step 2: Push the migration to your remote Supabase project**

  ```bash
  supabase db push
  ```

  Expected: `Applying migration 20260413000000_generalize.sql... done`

  If you get a conflict on existing policies (e.g. "policy already exists"), read the error — the migration includes `DROP POLICY IF EXISTS` guards for known conflicts. Add similar guards for any others that appear.

- [ ] **Step 3: Verify tables exist in Supabase dashboard**

  In the Supabase dashboard → Table Editor, confirm:
  - `data_sources` appears with all 9 columns
  - `ckan_package_manifest` appears with 9 columns and unique constraint shown
  - `docs_meta` now has `data_source_id` and `url` columns
  - `translations` appears with 6 columns

---

## Task 3: Verify RLS policies

- [ ] **Step 1: Check policies in dashboard**

  Supabase dashboard → Authentication → Policies. Verify:

  | Table | Policy count |
  |---|---|
  | `data_sources` | 4 (read, insert, update, delete) |
  | `ckan_package_manifest` | 1 (read only) |
  | `docs_meta` | 1 (read only — service role bypasses RLS automatically) |
  | `translations` | 1 (read only) |

- [ ] **Step 2: Test anonymous read on `data_sources`**

  In Supabase dashboard → SQL Editor, run:

  ```sql
  -- Test as anon role
  SET LOCAL role = anon;
  SELECT count(*) FROM public.data_sources;
  ```

  Expected: returns `0` (table is empty) without permission error.

- [ ] **Step 3: Test that anon cannot insert into `docs_meta`**

  ```sql
  SET LOCAL role = anon;
  INSERT INTO public.docs_meta (id, packageid, metadata)
  VALUES (gen_random_uuid(), 'test', '{}');
  ```

  Expected: `ERROR: new row violates row-level security policy`

---

## Task 4: Commit

- [ ] **Step 1: Stage and commit**

  ```bash
  git add supabase/migrations/20260413000000_generalize.sql
  git rm supabase/migrations/generalize_and_set_policy.sql
  git commit -m "feat: schema — data_sources, manifest, translations tables; docs_meta updated"
  ```

---

**Next:** [Plan 3 — Sources UI](2026-04-13-plan-3-sources-ui.md)
