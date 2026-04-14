# Ingestion Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two-phase ingestion workflow (enumerate → process) that appears in `Sources.svelte` when a user clicks "Browse / Ingest". The `submit-document` edge function verifies each package against CKAN server-side before writing to `docs_meta`.

**Architecture:** Browser drives all enumeration and progress via CKAN's public `package_search` API. Processing loop generates embeddings locally via `@huggingface/transformers`, then calls `submit-document` edge function per package. Edge function is the sole writer to `docs_meta` and `ckan_package_manifest`. Pause/resume is stateless — on resume the browser re-diffs the CKAN list against the manifest.

**Tech Stack:** Svelte 5, TypeScript, `@huggingface/transformers` (all-MiniLM-L6-v2), Supabase Edge Functions (Deno)

**Prerequisite:** Plans 1–3 complete — schema exists, `Sources.svelte` exists, `supabaseClient.ts` uses publishable key.

---

## File Map

| Action | File |
|---|---|
| Create | `supabase/functions/submit-document/index.ts` |
| Create | `src/lib/utils/ingestion.ts` — CKAN enumeration helpers |
| Modify | `src/lib/pages/Sources.svelte` — add ingestion panel below card |
| Delete | `src/lib/utils/submitProcessedDataset.ts` — superseded |

---

## Task 1: Create the `submit-document` edge function

**Files:**

- Create: `supabase/functions/submit-document/index.ts`

- [ ] **Step 1: Create function directory**

  ```bash
  mkdir -p supabase/functions/submit-document
  ```

- [ ] **Step 2: Create `supabase/functions/submit-document/index.ts`**

  ```typescript
  import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Verify JWT — user must be authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate the JWT to get the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const { data_source_id, package_id, embedding } = await req.json() as {
      data_source_id: string
      package_id: string
      embedding: number[]
    }

    // Look up the CKAN URL from data_sources — never trust client-provided URL
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('data_sources')
      .select('ckan_url')
      .eq('id', data_source_id)
      .single()

    if (sourceError || !source) {
      return Response.json({ error: 'Unknown data source' }, { status: 400, headers: corsHeaders })
    }

    const ckanUrl = source.ckan_url.replace(/\/+$/, '')

    // Verify package exists in CKAN and retrieve authoritative metadata
    let ckanMetadata: Record<string, unknown>
    try {
      const r = await fetch(`${ckanUrl}/api/3/action/package_show?id=${encodeURIComponent(package_id)}`)
      const json = await r.json()
      if (!json.success || !json.result) {
        return Response.json({ error: 'Package not found in CKAN' }, { status: 400, headers: corsHeaders })
      }
      ckanMetadata = json.result
    } catch (e) {
      return Response.json({ error: `CKAN fetch failed: ${e}` }, { status: 502, headers: corsHeaders })
    }

    const packageUrl = `${ckanUrl}/dataset/${package_id}`

    // Upsert into docs_meta — deterministic UUID from (data_source_id, package_id)
    const docId = await deterministicUUID(`${data_source_id}:${package_id}`)

    const { error: upsertError } = await supabaseAdmin
      .from('docs_meta')
      .upsert({
        id: docId,
        packageid: package_id,
        data_source_id,
        url: packageUrl,
        metadata: ckanMetadata,
        embedding,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (upsertError) {
      return Response.json({ error: upsertError.message }, { status: 500, headers: corsHeaders })
    }

    // Upsert manifest row — status: ingested
    await supabaseAdmin
      .from('ckan_package_manifest')
      .upsert({
        data_source_id,
        package_id,
        status: 'ingested',
        ingested_at: new Date().toISOString(),
      }, { onConflict: 'data_source_id,package_id' })

    return Response.json({ ok: true }, { headers: corsHeaders })
  })

  // Generate a deterministic UUID v5-like ID from a string using SubtleCrypto
  async function deterministicUUID(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const bytes = new Uint8Array(hash).slice(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  }
  ```

- [ ] **Step 3: Deploy the edge function**

  ```bash
  supabase functions deploy submit-document
  ```

  This function requires a valid JWT — do NOT use `--no-verify-jwt`.

  Expected: `Deployed submit-document`

---

## Task 2: Create ingestion helpers

**Files:**

- Create: `src/lib/utils/ingestion.ts`
- Delete: `src/lib/utils/submitProcessedDataset.ts`

- [ ] **Step 1: Create `src/lib/utils/ingestion.ts`**

  ```typescript
  export interface ManifestEntry {
    package_id: string
    metadata_modified: string | null
    status: 'pending' | 'ingested' | 'error'
    ingested_at: string | null
  }

  export interface CKANPackageSummary {
    id: string
    metadata_modified: string | null
  }

  export type PackageCategory = 'new' | 'updated' | 'current' | 'error'

  export interface CategorisedPackage extends CKANPackageSummary {
    category: PackageCategory
  }

  /**
   * Fetch all package summaries from a CKAN source via package_search.
   * Calls onProgress with running total and estimated total after each batch.
   */
  export async function enumerateCKANPackages(
    ckanUrl: string,
    onProgress: (fetched: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<CKANPackageSummary[]> {
    const safeUrl = ckanUrl.replace(/\/+$/, '')
    const batchSize = 1000
    const results: CKANPackageSummary[] = []
    let start = 0
    let total = 1 // will be updated after first response

    while (start < total) {
      if (signal?.aborted) break
      const r = await fetch(
        `${safeUrl}/api/3/action/package_search?rows=${batchSize}&start=${start}&fl=id,metadata_modified`
      )
      const json = await r.json()
      if (!json.success) break
      total = json.result.count
      const batch: CKANPackageSummary[] = json.result.results.map((p: Record<string, string>) => ({
        id: p.id,
        metadata_modified: p.metadata_modified ?? null,
      }))
      results.push(...batch)
      start += batchSize
      onProgress(results.length, total)
    }

    return results
  }

  /**
   * Categorise CKAN packages against the existing manifest.
   */
  export function categorisePackages(
    ckanPackages: CKANPackageSummary[],
    manifest: ManifestEntry[],
  ): CategorisedPackage[] {
    const manifestMap = new Map(manifest.map(m => [m.package_id, m]))

    return ckanPackages.map(pkg => {
      const entry = manifestMap.get(pkg.id)
      if (!entry) return { ...pkg, category: 'new' as PackageCategory }
      if (entry.status === 'error') return { ...pkg, category: 'error' as PackageCategory }
      if (entry.status === 'ingested' && entry.ingested_at && pkg.metadata_modified) {
        const updated = new Date(pkg.metadata_modified) > new Date(entry.ingested_at)
        return { ...pkg, category: updated ? 'updated' : 'current' }
      }
      return { ...pkg, category: 'current' as PackageCategory }
    })
  }
  ```

- [ ] **Step 2: Delete the superseded file**

  ```bash
  git rm src/lib/utils/submitProcessedDataset.ts
  ```

---

## Task 3: Add ingestion panel to `Sources.svelte`

**Files:**

- Modify: `src/lib/pages/Sources.svelte`

- [ ] **Step 1: Add ingestion imports and state to the `<script>` block**

  Add at the top of the script block (after existing imports):

  ```typescript
  import { pipeline, env } from '@huggingface/transformers'
  import { enumerateCKANPackages, categorisePackages, type CategorisedPackage, type ManifestEntry } from '../utils/ingestion'

  env.cacheDir = 'transformers-cache'
  env.allowRemoteModels = true

  // Ingestion state
  let ingestionActive = false
  let enumerating = false
  let enumFetched = 0
  let enumTotal = 0
  let categorised: CategorisedPackage[] = []
  let includeNew = true
  let includeUpdated = false
  let includeErrors = false
  let tagFilter = ''
  let processing = false
  let processedCount = 0
  let processTotal = 0
  let processIngested = 0
  let processErrors: Array<{ package_id: string; message: string }> = []
  let paused = false
  let abortController: AbortController | null = null
  let embedder: ((texts: string[]) => Promise<{ data: Float32Array }>) | null = null

  $: toProcess = categorised.filter(p => {
    if (p.category === 'current') return false
    if (p.category === 'new' && !includeNew) return false
    if (p.category === 'updated' && !includeUpdated) return false
    if (p.category === 'error' && !includeErrors) return false
    if (tagFilter && !JSON.stringify(p).toLowerCase().includes(tagFilter.toLowerCase())) return false
    return true
  })

  $: counts = {
    new: categorised.filter(p => p.category === 'new').length,
    updated: categorised.filter(p => p.category === 'updated').length,
    current: categorised.filter(p => p.category === 'current').length,
    error: categorised.filter(p => p.category === 'error').length,
  }

  async function startEnumeration() {
    if (!selectedSource) return
    ingestionActive = true
    enumerating = true
    enumFetched = 0
    enumTotal = 0
    categorised = []
    processErrors = []

    // Fetch manifest for this source
    const { data: manifest } = await supabase
      .from('ckan_package_manifest')
      .select('package_id, metadata_modified, status, ingested_at')
      .eq('data_source_id', selectedSource.id)

    abortController = new AbortController()
    const ckanPackages = await enumerateCKANPackages(
      selectedSource.ckan_url,
      (fetched, total) => { enumFetched = fetched; enumTotal = total },
      abortController.signal,
    )
    categorised = categorisePackages(ckanPackages, (manifest as ManifestEntry[]) ?? [])
    enumerating = false
  }

  async function startProcessing() {
    if (!selectedSource || toProcess.length === 0) return
    processing = true
    paused = false
    processedCount = 0
    processTotal = toProcess.length
    processIngested = 0

    // Load embedder once
    if (!embedder) {
      const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
      embedder = async (texts: string[]) => {
        const output = await pipe(texts, { pooling: 'mean', normalize: true })
        return { data: output.data as Float32Array }
      }
    }

    abortController = new AbortController()

    for (const pkg of toProcess) {
      if (paused || abortController.signal.aborted) break

      try {
        // Fetch package metadata from CKAN (browser → CKAN directly)
        const r = await fetch(
          `${selectedSource!.ckan_url.replace(/\/+$/, '')}/api/3/action/package_show?id=${encodeURIComponent(pkg.id)}`
        )
        const json = await r.json()
        const metadata = json.result

        // Generate embedding from title + description
        const text = [metadata.title, metadata.notes].filter(Boolean).join(' ')
        const { data } = await embedder([text])
        const embedding = Array.from(data)

        // Submit to edge function
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-document`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              data_source_id: selectedSource!.id,
              package_id: pkg.id,
              embedding,
            }),
          }
        )

        const result = await res.json()
        if (result.ok) {
          processIngested++
        } else {
          processErrors.push({ package_id: pkg.id, message: result.error ?? 'Unknown error' })
        }
      } catch (e) {
        processErrors.push({ package_id: pkg.id, message: String(e) })
      }

      processedCount++
    }

    processing = false
  }

  function pauseProcessing() {
    paused = true
    abortController?.abort()
  }
  ```

- [ ] **Step 2: Add the ingestion panel to the template**

  Inside the `.card-content` div, replace the placeholder "Browse / Ingest" button with:

  ```html
  <div class="card-actions">
    <button
      class="ingest-button"
      class:disabled={!isLoggedIn}
      disabled={!isLoggedIn || ingestionActive}
      title={isLoggedIn ? 'Browse and ingest datasets' : 'Log in to enable'}
      on:click={startEnumeration}
    >
      {ingestionActive ? 'Ingestion Active' : 'Browse / Ingest'}
    </button>
    {#if $session?.user?.app_metadata?.claims_admin}
      <button class="delete-button" on:click={() => handleDeleteSource(selectedSource!.id)}>
        Delete Source
      </button>
    {/if}
  </div>

  {#if ingestionActive}
    <div class="ingestion-panel">
      {#if enumerating}
        <p class="enum-progress">
          Enumerating packages… {enumFetched.toLocaleString()} / ~{enumTotal.toLocaleString()} fetched
        </p>
      {:else if categorised.length > 0}
        <div class="category-summary">
          <span class="cat new">✦ {counts.new} new</span>
          <span class="cat updated">↑ {counts.updated} updated</span>
          <span class="cat current">✓ {counts.current} current</span>
          <span class="cat error">✗ {counts.error} errors</span>
        </div>

        {#if !processing}
          <div class="filter-section">
            <label><input type="checkbox" bind:checked={includeNew} /> New ({counts.new})</label>
            <label><input type="checkbox" bind:checked={includeUpdated} /> Updated ({counts.updated})</label>
            <label><input type="checkbox" bind:checked={includeErrors} /> Retry errors ({counts.error})</label>
            <input
              type="text"
              bind:value={tagFilter}
              placeholder="Filter by tag or format (optional)"
              class="tag-filter"
            />
            <p class="workload">~{toProcess.length.toLocaleString()} packages to process</p>
            <button
              class="start-button"
              disabled={!isLoggedIn || toProcess.length === 0}
              title={isLoggedIn ? '' : 'Log in to enable'}
              on:click={startProcessing}
            >
              Start Processing
            </button>
          </div>
        {:else}
          <div class="progress-section">
            <div class="progress-bar-wrap">
              <div
                class="progress-bar-fill"
                style="width: {processTotal > 0 ? (processedCount / processTotal * 100) : 0}%"
              ></div>
            </div>
            <p class="progress-text">
              Processing… {processedCount.toLocaleString()} / {processTotal.toLocaleString()}
              &nbsp; ✦ {processIngested} ingested
              &nbsp; ✗ {processErrors.length} errors
              &nbsp;
              <button class="pause-button" on:click={pauseProcessing}>⏸ Pause</button>
            </p>
          </div>
        {/if}

        {#if processErrors.length > 0}
          <details class="error-list">
            <summary>{processErrors.length} error{processErrors.length !== 1 ? 's' : ''}</summary>
            <ul>
              {#each processErrors as err}
                <li><code>{err.package_id}</code>: {err.message}</li>
              {/each}
            </ul>
          </details>
        {/if}
      {/if}
    </div>
  {/if}
  ```

- [ ] **Step 3: Add ingestion panel styles to `Sources.svelte` `<style>` block**

  ```css
  .ingestion-panel {
    margin-top: var(--spacing-xl);
    padding-top: var(--spacing-xl);
    border-top: 1px solid var(--color-border);
  }

  .enum-progress {
    color: var(--color-text-light);
    font-size: 0.9rem;
  }

  .category-summary {
    display: flex;
    gap: var(--spacing-lg);
    flex-wrap: wrap;
    margin-bottom: var(--spacing-lg);
    font-size: 0.9rem;
    font-weight: var(--font-weight-medium);
  }

  .cat.new { color: var(--color-primary); }
  .cat.updated { color: #f59e0b; }
  .cat.current { color: #6b7280; }
  .cat.error { color: #dc3545; }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .filter-section label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .tag-filter {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background: var(--color-background);
    color: var(--color-text);
    font-size: 0.9rem;
    margin-top: var(--spacing-sm);
  }

  .workload {
    font-size: 0.85rem;
    color: var(--color-text-light);
    margin: var(--spacing-sm) 0;
  }

  .start-button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-size: 0.95rem;
    align-self: flex-start;
    margin-top: var(--spacing-sm);
  }

  .start-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-bar-wrap {
    width: 100%;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: var(--spacing-sm);
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.85rem;
    color: var(--color-text-light);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .pause-button {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    padding: 2px var(--spacing-sm);
    cursor: pointer;
    font-size: 0.8rem;
    color: var(--color-text);
  }

  .error-list {
    margin-top: var(--spacing-md);
    font-size: 0.85rem;
  }

  .error-list summary {
    cursor: pointer;
    color: #dc3545;
    margin-bottom: var(--spacing-sm);
  }

  .error-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .error-list li {
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-light);
  }

  .error-list code {
    font-family: monospace;
    font-size: 0.8rem;
    background: var(--color-background);
    padding: 1px 4px;
    border-radius: 3px;
  }
  ```

---

## Task 4: Smoke test

- [ ] **Step 1: Start dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Add a test CKAN source if not already present**

  Log in, go to `/sources`, add `https://open.alberta.ca/opendata` as a source.

- [ ] **Step 3: Test enumeration**

  Select the source, click "Browse / Ingest". Expected:
  - Progress counter appears: "Enumerating packages… X / ~Y fetched"
  - On completion: category summary shows ✦ new / ↑ updated / ✓ current / ✗ errors
  - Filter checkboxes appear with workload estimate

- [ ] **Step 4: Test processing (small batch)**

  Uncheck "New", check only "Retry errors" (to test with a near-zero set first), or use tag filter to reduce scope. Click "Start Processing". Expected:
  - Progress bar advances
  - ✦ ingested count increments
  - Check Supabase dashboard → Table Editor → `docs_meta` — new rows should appear

- [ ] **Step 5: Test pause and resume**

  Start a larger batch, click "⏸ Pause". Navigate away and back. Click "Browse / Ingest" again. Expected: enumeration re-runs (fast, most are now `current`), "Start Processing" shows remaining count.

---

## Task 5: Commit

- [ ] **Step 1: Stage and commit**

  ```bash
  git add \
    supabase/functions/submit-document/index.ts \
    src/lib/utils/ingestion.ts \
    src/lib/pages/Sources.svelte

  git rm src/lib/utils/submitProcessedDataset.ts

  git commit -m "feat: ingestion workflow — enumerate, categorise, process, pause/resume"
  ```

---

**Next:** [Plan 5 — i18n System](2026-04-13-plan-5-i18n.md)
