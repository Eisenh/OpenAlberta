# Multi-Source CKAN Generalization Design

**Date:** 2026-04-13  
**Status:** Approved  
**Project:** OpenDataABOnline → multi-source open data portal

---

## Overview

Transform the app from a single-source Alberta open data portal into a **multi-source open government data portal** that can ingest metadata from any CKAN repository into a single Supabase instance. Users contribute compute by running ingestion in their browser. The UI is fully multilingual with on-demand LLM translation.

---

## Implementation Order

1. **Security fix** — publishable key migration (no schema changes)
2. **Schema migration** — new tables, updated columns
3. **CKAN source management UI** — add, browse, filter sources
4. **Ingestion workflow** — enumerate, filter, process
5. **i18n system** — translation generation, caching, staleness detection

---

## Subsystem 1: Security Migration

### Problem
`supabaseClient.js` uses `createClient` with `VITE_SUPABASE_ANON_KEY`. This key is leaked. Email verification is also broken in production — no SMTP server is configured and no OAuth providers are set up.

### Fix — keys

- Replace `VITE_SUPABASE_ANON_KEY` with `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env_local`
- Replace `createClient` with `createBrowserClient` from `@supabase/supabase-js` in `src/lib/supabaseClient.js` → renamed to `supabaseClient.ts`
- All pages importing `supabaseClient.js` get the fix automatically — import paths updated to `.ts`
- The secret key (replacing `service_role`) lives **only** in Supabase edge function environment variables, set via `supabase secrets set` — never in any committed file or Vite env
- `.env_copy` (already deleted) stays gone. `.env_local` (untracked) is the canonical local dev file

### Fix — TypeScript conversion (files touched by this subsystem)

- `src/lib/supabaseClient.js` → `supabaseClient.ts`
- `routes.js` (root) → `routes.ts`
- All new files written in TypeScript throughout the project
- On pages significantly modified in later subsystems: remove `// @ts-nocheck` and fix type errors
- Untouched pages left as-is — no churn for zero gain

### Fix — auth workflows

Email/password auth is broken without SMTP. Two additions:

**1. Resend SMTP** (fixes existing email/password flow)

- Create a free Resend account, generate API key
- Configure in Supabase dashboard: Settings → Auth → SMTP → Resend credentials
- Free tier: 3,000 emails/month — sufficient for this project
- No code changes required — Supabase handles sending

**2. Google OAuth** (primary alternative, no email required)

- Configure Google OAuth app in Google Cloud Console
- Add client ID + secret to Supabase dashboard: Settings → Auth → Providers → Google
- Add "Continue with Google" button to `Login.svelte` and `SignUp.svelte` via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Three lines of code per page; no server-side changes

GitHub OAuth may be added later for developer-facing use cases but is not in scope here.

### RLS as defence-in-depth
Even with the publishable key exposed, RLS ensures:
- Anonymous users: SELECT only
- Authenticated users: INSERT only (on designated tables)
- Admins: INSERT + UPDATE + DELETE
- `docs_meta` INSERT: service role only (edge function)

---

## Subsystem 1b: Dependency Cleanup

Performed alongside the security fix before any new code is written.

| Action | Package | Reason |
|---|---|---|
| Replace | `@xenova/transformers` → `@huggingface/transformers` v3 | v2 is deprecated; v3 is the maintained successor with the same API surface |
| Remove | `@tensorflow/tfjs` | Not used — embeddings are via transformers only |
| Remove | `tfjs` | Duplicate / unused |
| Remove | `svelte-routing` | Listed in deps but app uses a custom routing store; not imported anywhere |
| No addition | *(no i18n library)* | DB-backed dynamic translations don't fit static libraries like paraglide; custom reactive store is sufficient |

After cleanup, update all import paths from `@xenova/transformers` to `@huggingface/transformers` — API is compatible but the package name changes. Verify the embedding pipeline still initialises correctly in `Landing.svelte` before proceeding.

---

## Subsystem 2: Database Schema

### `data_sources` (new table)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `ckan_url` | text UNIQUE | validated before insert |
| `display_name` | text | from `site_read` or user-supplied |
| `description` | text | from `site_read` or user-supplied |
| `authority` | text | responsible organisation |
| `country` | text | ISO 3166-1 alpha-2 (e.g. `CA`, `GB`) |
| `icon_url` | text | auto-detected or admin override; nullable |
| `added_by` | uuid FK → auth.users | |
| `created_at` | timestamptz | |

RLS:
- SELECT: public
- INSERT: authenticated users
- UPDATE/DELETE: admins only

### `ckan_package_manifest` (new table)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `data_source_id` | uuid FK → data_sources | |
| `package_id` | text | CKAN package id |
| `metadata_modified` | timestamptz | from CKAN `package_search` result |
| `status` | text | `pending` / `ingested` / `error` |
| `error_message` | text | nullable |
| `enumerated_at` | timestamptz | |
| `ingested_at` | timestamptz | nullable |

Unique constraint: `(data_source_id, package_id)`.  
Safe to re-enumerate — upsert updates `metadata_modified` and `enumerated_at` without duplicating rows.

RLS:
- SELECT: public (browser reads this to diff against CKAN list)
- INSERT/UPDATE: service role only (written by edge functions)

### `docs_meta` (updated)

Add two columns to the existing table:
- `data_source_id uuid FK → data_sources` (nullable initially for migration compatibility)
- `url text` — canonical package URL, constructed by edge function as `{ckan_url}/dataset/{package_id}`

RLS update:
- Remove `authenticated` INSERT policy
- INSERT/UPDATE: service role only (all writes go through `submit-document` edge function)
- SELECT: public (unchanged)

### `translations` (new table)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `locale` | text UNIQUE | e.g. `fr`, `es`, `de` |
| `translations` | jsonb | `{ "key": "translated text" }` |
| `strings_hash` | text | SHA-256 of `en.ts` at generation time |
| `generated_at` | timestamptz | |
| `generated_by` | text | model ID, e.g. `claude-opus-4-6` |

RLS:
- SELECT: public
- INSERT/UPDATE: service role only (edge function writes)

### User locale preference

Stored in Supabase user metadata (no new table needed). Written via `supabase.auth.updateUser({ data: { preferred_locale: 'fr' } })`. Read from `session.user.user_metadata.preferred_locale` on app load. Simpler than a separate table since it's a single scalar per user.

---

## Subsystem 3: CKAN Source Management UI

### Route
`/sources` — added to the existing `svelte-routing` setup.

### Layout — split panel

**Left panel: source list**
- Compact table rows: icon (16px), display name, country flag + ISO code
- Filter dropdown: "All countries" → populated from distinct `country` values in `data_sources`
- Filtering is client-side (source count will be small)
- Clicking a row loads the source card in the right panel

**Right panel: source card**
- Placeholder text ("Select a source to view details") until a source is selected
- Selected state: icon, display name, authority, country, description, package counts (new / updated / current — fetched lazily on selection), "Browse / Ingest" button
- Auth-gated actions (Add, Ingest): visible but `disabled` with tooltip "Log in to enable" for unauthenticated users
- Admin-only: Edit and Delete buttons on the card

**Add Source form** (authenticated users, shown as a modal or inline panel)
- CKAN base URL field
- On blur: calls `validateCKANUrl` — hits `{url}/api/3/action/site_read`
- If valid: auto-populates display name, description, authority from `site_read` response
- Country picker (ISO dropdown with flag emoji) — auto-suggests from `site_read` locale field if available
- Icon auto-detection runs via `detect-icon` edge function (background, non-blocking)
- All auto-populated fields are user-editable before save
- On save: inserts into `data_sources` via Supabase client (RLS allows authenticated insert)

### `detect-icon` edge function

Receives `{ url }`. Tries in sequence:
1. Parse `site_read` response for logo/icon field
2. HEAD `{url}/favicon.ico` — if 200, return that URL
3. Fetch `{url}` HTML, extract `<meta property="og:image">` or `<link rel="icon">`
4. Return `{ icon_url: string | null }`

Browser uses returned URL or falls back to bundled generic CKAN icon SVG.

---

## Subsystem 4: Ingestion Workflow

Triggered from the source card "Browse / Ingest" button. Renders inline below the card (or as a full-width panel).

### Phase 1 — Enumerate

Browser fetches CKAN `package_search` in batches of 1000 (using `rows` and `start` parameters), accumulating `{ id, metadata_modified }` per package. Simultaneously queries `ckan_package_manifest` for this source.

Progress indicator: `Enumerating packages... 3,000 / ~12,400 fetched`

On completion, categorises every package:
- **New** — not in manifest
- **Updated** — in manifest, but CKAN `metadata_modified` > manifest `ingested_at`
- **Current** — in manifest, `metadata_modified` ≤ `ingested_at`
- **Error** — in manifest with `status = error`

Displays: `✦ 247 new  ↑ 12 updated  ✓ 4,891 current  ✗ 3 errors`

### Phase 2 — Filter and confirm

User sees checkboxes before committing:
- `[x] New (247)`
- `[ ] Updated (12)`
- `[ ] Re-process errors (3)`
- Optional free-text filter by CKAN tag or format (applied client-side)

Estimated workload: `~247 packages to process`

"Start Processing" button — auth-gated (greyed + tooltip if not logged in).

### Phase 3 — Process

Browser iterates the filtered list sequentially:

1. Fetch full package metadata from CKAN: `{ckan_url}/api/3/action/package_show?id={package_id}` (browser → CKAN directly, public endpoint)
2. Generate embedding locally via `@xenova/transformers` (`all-MiniLM-L6-v2`)
3. POST `{ data_source_id, package_id, embedding }` to `submit-document` edge function
4. Edge function:
   - Verifies JWT (user must be authenticated)
   - Looks up `ckan_url` from `data_sources` by `data_source_id` (server-side — client cannot influence this)
   - Calls `package_show` against that URL to verify package exists and retrieve authoritative metadata
   - Constructs `url` as `{ckan_url}/dataset/{package_id}`
   - Upserts into `docs_meta` (insert new or update existing)
   - Upserts manifest row: `status = ingested`, `ingested_at = now()`
   - Returns `{ ok: true }` or `{ error: string }`

Progress bar: `Processing... [████████░░] 87 / 247  ✦ 85 ingested  ✗ 2 errors  ⏸ Pause`

**Pause / Resume:** "Pause" stops the loop. On resume, the browser re-diffs CKAN list against manifest and continues from the first non-ingested package. No server-side session needed.

**Errors:** Shown in a collapsible list below the bar (package ID + error message). Individual retry button per row.

---

## Subsystem 5: i18n System

### English source format

`src/lib/i18n/en.ts` — single file, ships with the app, never stored in DB:

```typescript
export const strings: Record<string, { text: string; context: string }> = {
  "nav.datasets": {
    text: "Datasets",
    context: "Navigation label for browsing open government datasets in a data portal"
  },
  "search.placeholder": {
    text: "Search datasets...",
    context: "Placeholder in the main search input of a government open data portal"
  },
  "ingest.file": {
    text: "File",
    context: "A computer document or dataset — not a physical file tool or a queue"
  }
  // ... all UI strings
}
```

English is the bundled fallback. No DB row for `en`.

### Strings hash

A Vite plugin computes SHA-256 of `en.ts` at build time and injects it as `import.meta.env.VITE_STRINGS_HASH`. This hash is stored alongside every generated translation in the `translations` table.

### Translation load flow

On language selection:
1. Check localStorage for `translations.{locale}` with matching `strings_hash`
2. If cache hit → apply immediately
3. If cache miss → query `translations` table for `locale`
4. If DB hit and `strings_hash` matches → cache locally and apply
5. If DB miss or hash mismatch → call `translate-ui` edge function
6. Cache result in localStorage and apply

### `translate-ui` edge function

- Verifies JWT (authenticated users only — prevents abuse)
- Sends to Claude (`claude-opus-4-6`):
  - System prompt: app-level context ("This is an open government data portal for discovering and searching datasets published by government authorities...")
  - User message: full `strings` object (text + context per key), target locale
  - Structured output: `{ [key: string]: string }` (translated text only, context hints are inputs not outputs)
- Stores result in `translations` table with current `strings_hash` and `generated_at`
- Returns translations to browser

### Runtime application

```typescript
// src/lib/i18n/store.ts
export const t = derived(localeStore, ($locale) =>
  (key: string) => loadedTranslations[$locale]?.[key] ?? strings[key].text
)
```

Usage: `{$t('nav.datasets')}` — missing keys fall back to English automatically.

### Language preference persistence

- Always saved to cookie: `locale=fr; SameSite=Lax; Max-Age=31536000`
- If logged in: also written to `preferred_locale` in user preferences
- Load priority on app start: user profile → cookie → `navigator.language` → `en`

### Admin translation management

Admin page "Translations" section:
- Lists all generated locales with: language name, generated date, current/stale status (hash match)
- "Regenerate" button per locale
- "Regenerate all" button
- Stale translations (hash mismatch after a new build) are highlighted

---

## Edge Functions Summary

| Function | Trigger | Auth required | Uses secret key |
|---|---|---|---|
| `detect-icon` | Add source form | No | No |
| `submit-document` | Per-package during processing | Yes | Yes (writes to docs_meta) |
| `translate-ui` | Language selection (cache miss) | Yes | Yes (calls Claude API) |
| `authenticate-admin` | Existing — unchanged | Yes | Yes |

---

## Files Changed / Created

### Modified
- `src/lib/supabaseClient.js` — publishable key + `createBrowserClient`
- `src/lib/pages/Admin.svelte` — add Translations management section
- `routes.js` (root level) — add `/sources` route pointing to `Sources.svelte`
- `vite.config.js` — add strings hash plugin

### Created
- `src/lib/pages/Sources.svelte` — source list + card + ingestion workflow
- `src/lib/i18n/en.ts` — all UI strings with context hints
- `src/lib/i18n/store.ts` — reactive translation store
- `src/lib/utils/ckan.ts` — `validateCKANUrl` (already exists, may need updates)
- `supabase/functions/detect-icon/index.ts`
- `supabase/functions/submit-document/index.ts`
- `supabase/functions/translate-ui/index.ts`
- `supabase/migrations/20260413_generalize.sql` — all schema changes

### Removed / superseded
- `src/lib/pages/CKAN_URL.svelte` — replaced by Sources.svelte
- `src/lib/utils/submitProcessedDataset.ts` — replaced by submit-document edge function
- `supabase/migrations/generalize_and_set_policy.sql` — incorporated into new migration
