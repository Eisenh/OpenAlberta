# Sources UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/sources` page — split-panel layout with a filterable source list, a source detail card, and the "Add Source" form with CKAN URL validation and auto-population.

**Architecture:** `Sources.svelte` is a self-contained page component. The `detect-icon` Supabase edge function handles favicon/OG detection server-side to avoid CORS. `validateCKANUrl` utility (already exists in `src/lib/utils/ckan.ts`) is reused. Auth-gated controls are visible but disabled for anonymous users with tooltip.

**Tech Stack:** Svelte 5, TypeScript, Supabase JS client (publishable key), Supabase Edge Functions (Deno/TypeScript)

**Prerequisite:** Plans 1 and 2 complete — `data_sources` table exists, `supabaseClient.ts` uses publishable key.

---

## File Map

| Action | File |
|---|---|
| Create | `src/lib/pages/Sources.svelte` |
| Create | `supabase/functions/detect-icon/index.ts` |
| Modify | `routes.ts` — add `/sources` route |
| Modify | `src/lib/utils/ckan.ts` — verify/update `validateCKANUrl` |
| Delete | `src/lib/pages/CKAN_URL.svelte` — superseded |

---

## Task 1: Verify `validateCKANUrl` utility

**Files:**

- Modify: `src/lib/utils/ckan.ts`

- [ ] **Step 1: Read the current file and confirm the function signature**

  The current `src/lib/utils/ckan.ts` should export:

  ```typescript
  export async function validateCKANUrl(url: string): Promise<boolean>
  ```

  It calls `{url}/api/3/action/site_read` and returns `true` if the response has `success === true`.

- [ ] **Step 2: Extend to also return site metadata on success**

  Replace the file content with:

  ```typescript
  export interface CKANSiteInfo {
    displayName: string
    description: string
    authority: string
  }

  export async function validateCKANUrl(url: string): Promise<false | CKANSiteInfo> {
    try {
      const safeUrl = url.replace(/\/+$/, '')
      const response = await fetch(`${safeUrl}/api/3/action/site_read`, { method: 'GET' })
      if (!response.ok) return false
      const json = await response.json()
      if (json.success !== true || !json.result?.site_title) return false
      return {
        displayName: json.result.site_title ?? '',
        description: json.result.site_description ?? '',
        authority: json.result.site_about ?? '',
      }
    } catch {
      return false
    }
  }
  ```

  > **Note:** This is a breaking change to the function signature — it now returns `false | CKANSiteInfo` instead of `boolean`. `CKAN_URL.svelte` is being deleted so there are no other callers to update.

- [ ] **Step 3: Commit the utility update**

  ```bash
  git add src/lib/utils/ckan.ts
  git commit -m "feat: extend validateCKANUrl to return site metadata"
  ```

---

## Task 2: Create the `detect-icon` edge function

**Files:**

- Create: `supabase/functions/detect-icon/index.ts`

- [ ] **Step 1: Create the function directory and file**

  ```bash
  mkdir -p supabase/functions/detect-icon
  ```

  Create `supabase/functions/detect-icon/index.ts`:

  ```typescript
  import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const { url } = await req.json() as { url: string }
    const safeUrl = url.replace(/\/+$/, '')

    // 1. Try site_read for a logo field
    try {
      const r = await fetch(`${safeUrl}/api/3/action/site_read`)
      const json = await r.json()
      const logo = json?.result?.logo_url || json?.result?.site_logo
      if (logo && typeof logo === 'string' && logo.startsWith('http')) {
        return Response.json({ icon_url: logo }, { headers: corsHeaders })
      }
    } catch { /* continue */ }

    // 2. Try favicon.ico
    try {
      const r = await fetch(`${safeUrl}/favicon.ico`, { method: 'HEAD' })
      if (r.ok) {
        return Response.json({ icon_url: `${safeUrl}/favicon.ico` }, { headers: corsHeaders })
      }
    } catch { /* continue */ }

    // 3. Try OG image or link rel=icon from homepage HTML
    try {
      const r = await fetch(safeUrl)
      const html = await r.text()
      const og = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      if (og?.[1]) {
        return Response.json({ icon_url: og[1] }, { headers: corsHeaders })
      }
      const icon = html.match(/<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]+)"/i)
      if (icon?.[1]) {
        const href = icon[1].startsWith('http') ? icon[1] : `${safeUrl}${icon[1]}`
        return Response.json({ icon_url: href }, { headers: corsHeaders })
      }
    } catch { /* continue */ }

    // 4. Fallback — no icon found
    return Response.json({ icon_url: null }, { headers: corsHeaders })
  })
  ```

- [ ] **Step 2: Deploy the edge function**

  ```bash
  supabase functions deploy detect-icon --no-verify-jwt
  ```

  The `--no-verify-jwt` flag allows unauthenticated calls (this function only reads public URLs).

  Expected: `Deployed detect-icon`

- [ ] **Step 3: Smoke test the edge function**

  ```bash
  curl -X POST https://your-project.supabase.co/functions/v1/detect-icon \
    -H "Content-Type: application/json" \
    -d '{"url": "https://open.alberta.ca/opendata"}'
  ```

  Expected: `{"icon_url": "https://..."}` or `{"icon_url": null}`

---

## Task 3: Build `Sources.svelte`

**Files:**

- Create: `src/lib/pages/Sources.svelte`

- [ ] **Step 1: Create the Sources page with split-panel layout**

  Create `src/lib/pages/Sources.svelte`:

  ```svelte
  <script lang="ts">
    import { onMount } from 'svelte'
    import { supabase } from '../supabaseClient'
    import { session } from '../stores/session'
    import { validateCKANUrl, type CKANSiteInfo } from '../utils/ckan'

    // Types
    interface DataSource {
      id: string
      ckan_url: string
      display_name: string
      description: string | null
      authority: string | null
      country: string | null
      icon_url: string | null
      created_at: string
    }

    // State
    let sources: DataSource[] = []
    let selectedSource: DataSource | null = null
    let countryFilter = 'all'
    let loading = true
    let error = ''

    // Add source form state
    let showAddForm = false
    let formUrl = ''
    let formDisplayName = ''
    let formDescription = ''
    let formAuthority = ''
    let formCountry = ''
    let formIconUrl: string | null = null
    let formValidating = false
    let formSaving = false
    let formError = ''
    let formUrlValid = false

    // Derived
    $: isLoggedIn = !!$session
    $: countries = ['all', ...new Set(sources.map(s => s.country).filter(Boolean) as string[])]
    $: filteredSources = countryFilter === 'all'
      ? sources
      : sources.filter(s => s.country === countryFilter)

    const COUNTRY_FLAGS: Record<string, string> = {
      CA: '🇨🇦', GB: '🇬🇧', AU: '🇦🇺', US: '🇺🇸', NZ: '🇳🇿',
      FR: '🇫🇷', DE: '🇩🇪', ES: '🇪🇸', IT: '🇮🇹', NL: '🇳🇱',
    }

    function flagFor(code: string | null): string {
      return code ? (COUNTRY_FLAGS[code.toUpperCase()] ?? '🌐') : '🌐'
    }

    onMount(async () => {
      const { data, error: err } = await supabase
        .from('data_sources')
        .select('*')
        .order('display_name')
      if (err) { error = err.message }
      else { sources = data ?? [] }
      loading = false
    })

    async function onUrlBlur() {
      if (!formUrl) return
      formValidating = true
      formError = ''
      formUrlValid = false
      formDisplayName = ''
      formDescription = ''
      formAuthority = ''
      formIconUrl = null

      const info = await validateCKANUrl(formUrl)
      if (!info) {
        formError = 'Could not reach a CKAN API at this URL. Check the address and try again.'
        formValidating = false
        return
      }
      formUrlValid = true
      formDisplayName = info.displayName
      formDescription = info.description
      formAuthority = info.authority

      // Detect icon in background — non-blocking
      detectIcon()
      formValidating = false
    }

    async function detectIcon() {
      try {
        const res = await supabase.functions.invoke('detect-icon', {
          body: { url: formUrl }
        })
        formIconUrl = res.data?.icon_url ?? null
      } catch { /* leave null — generic icon used in UI */ }
    }

    async function handleAddSource() {
      if (!formUrlValid) return
      formSaving = true
      formError = ''
      const { error: err } = await supabase.from('data_sources').insert({
        ckan_url: formUrl.replace(/\/+$/, ''),
        display_name: formDisplayName,
        description: formDescription || null,
        authority: formAuthority || null,
        country: formCountry.toUpperCase() || null,
        icon_url: formIconUrl,
        added_by: $session?.user.id,
      })
      formSaving = false
      if (err) { formError = err.message; return }

      // Reload sources and close form
      const { data } = await supabase.from('data_sources').select('*').order('display_name')
      sources = data ?? []
      showAddForm = false
      resetForm()
    }

    function resetForm() {
      formUrl = ''
      formDisplayName = ''
      formDescription = ''
      formAuthority = ''
      formCountry = ''
      formIconUrl = null
      formError = ''
      formUrlValid = false
    }

    async function handleDeleteSource(id: string) {
      if (!confirm('Remove this data source? This will not delete indexed documents.')) return
      const { error: err } = await supabase.from('data_sources').delete().eq('id', id)
      if (err) { error = err.message; return }
      sources = sources.filter(s => s.id !== id)
      if (selectedSource?.id === id) selectedSource = null
    }
  </script>

  <div class="sources-page">
    <div class="page-header">
      <h1>Data Sources</h1>
      <button
        class="add-button"
        class:disabled={!isLoggedIn}
        disabled={!isLoggedIn}
        title={isLoggedIn ? 'Add a CKAN data source' : 'Log in to enable'}
        on:click={() => { if (isLoggedIn) showAddForm = !showAddForm }}
      >
        + Add Source
      </button>
    </div>

    {#if showAddForm && isLoggedIn}
      <div class="add-form-panel">
        <h2>Add CKAN Data Source</h2>
        {#if formError}<p class="form-error">{formError}</p>{/if}
        <div class="form-row">
          <label>CKAN URL
            <input
              type="url"
              bind:value={formUrl}
              on:blur={onUrlBlur}
              placeholder="https://open.alberta.ca/opendata"
              disabled={formValidating}
            />
          </label>
          {#if formValidating}<span class="validating">Checking…</span>{/if}
        </div>
        {#if formUrlValid}
          <div class="form-row">
            <label>Display Name
              <input type="text" bind:value={formDisplayName} />
            </label>
          </div>
          <div class="form-row">
            <label>Authority (organisation)
              <input type="text" bind:value={formAuthority} />
            </label>
          </div>
          <div class="form-row">
            <label>Country (ISO code, e.g. CA, GB)
              <input type="text" bind:value={formCountry} maxlength={2} placeholder="CA" />
            </label>
          </div>
          <div class="form-row">
            <label>Description
              <textarea bind:value={formDescription} rows={3}></textarea>
            </label>
          </div>
          {#if formIconUrl}
            <p class="icon-preview">Icon detected: <img src={formIconUrl} alt="icon" height={24} /> <button on:click={() => formIconUrl = null}>Clear</button></p>
          {:else}
            <p class="icon-preview muted">No icon detected — generic CKAN icon will be used.</p>
          {/if}
          <div class="form-actions">
            <button class="save-button" on:click={handleAddSource} disabled={formSaving}>
              {formSaving ? 'Saving…' : 'Save Source'}
            </button>
            <button class="cancel-button" on:click={() => { showAddForm = false; resetForm() }}>Cancel</button>
          </div>
        {/if}
      </div>
    {/if}

    <div class="split-panel">
      <!-- Left: source list -->
      <div class="source-list">
        <div class="filter-bar">
          <label>
            Filter by country:
            <select bind:value={countryFilter}>
              {#each countries as country}
                <option value={country}>
                  {country === 'all' ? 'All countries' : `${flagFor(country)} ${country}`}
                </option>
              {/each}
            </select>
          </label>
        </div>

        {#if loading}
          <p class="muted">Loading…</p>
        {:else if error}
          <p class="form-error">{error}</p>
        {:else if filteredSources.length === 0}
          <p class="muted">No sources found.</p>
        {:else}
          <table class="source-table">
            <tbody>
              {#each filteredSources as source (source.id)}
                <tr
                  class:selected={selectedSource?.id === source.id}
                  on:click={() => selectedSource = source}
                >
                  <td class="icon-cell">
                    {#if source.icon_url}
                      <img src={source.icon_url} alt="" height={16} width={16} />
                    {:else}
                      <span class="generic-icon">📦</span>
                    {/if}
                  </td>
                  <td class="name-cell">{source.display_name}</td>
                  <td class="country-cell">{flagFor(source.country)} {source.country ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <!-- Right: detail card -->
      <div class="source-card">
        {#if !selectedSource}
          <div class="card-placeholder">
            <p>Select a source to view details</p>
          </div>
        {:else}
          <div class="card-content">
            <div class="card-header">
              {#if selectedSource.icon_url}
                <img src={selectedSource.icon_url} alt="" height={40} />
              {:else}
                <span class="generic-icon large">📦</span>
              {/if}
              <div>
                <h2>{selectedSource.display_name}</h2>
                <p class="authority">{selectedSource.authority ?? ''}</p>
                <p class="country">{flagFor(selectedSource.country)} {selectedSource.country ?? ''}</p>
              </div>
            </div>
            {#if selectedSource.description}
              <p class="description">{selectedSource.description}</p>
            {/if}
            <div class="card-actions">
              <button
                class="ingest-button"
                class:disabled={!isLoggedIn}
                disabled={!isLoggedIn}
                title={isLoggedIn ? 'Browse and ingest datasets' : 'Log in to enable'}
              >
                Browse / Ingest
              </button>
              <!-- Admin-only actions -->
              {#if $session?.user?.app_metadata?.claims_admin}
                <button class="delete-button" on:click={() => handleDeleteSource(selectedSource!.id)}>
                  Delete Source
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <style>
    .sources-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: var(--spacing-xl) var(--spacing-md);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-xl);
    }

    .add-button {
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      cursor: pointer;
      font-size: 0.95rem;
    }

    .add-button.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .add-form-panel {
      background: var(--color-background-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-xl);
      margin-bottom: var(--spacing-xl);
    }

    .form-row {
      margin-bottom: var(--spacing-md);
    }

    .form-row label {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      font-size: 0.9rem;
      color: var(--color-text-light);
    }

    .form-row input,
    .form-row textarea,
    .form-row select {
      padding: var(--spacing-sm);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      background: var(--color-background);
      color: var(--color-text);
      font-size: 1rem;
    }

    .form-actions {
      display: flex;
      gap: var(--spacing-md);
      margin-top: var(--spacing-lg);
    }

    .save-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      cursor: pointer;
    }

    .cancel-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: transparent;
      color: var(--color-text-light);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      cursor: pointer;
    }

    .form-error { color: #dc3545; font-size: 0.9rem; margin-bottom: var(--spacing-md); }
    .validating { font-size: 0.85rem; color: var(--color-text-light); }
    .icon-preview { font-size: 0.9rem; display: flex; align-items: center; gap: var(--spacing-sm); }
    .muted { color: var(--color-text-light); }

    .split-panel {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: var(--spacing-xl);
      align-items: start;
    }

    .source-list {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-lg);
      overflow: hidden;
    }

    .filter-bar {
      padding: var(--spacing-md);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-background-alt);
    }

    .filter-bar label {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
      font-size: 0.85rem;
    }

    .filter-bar select {
      padding: var(--spacing-xs) var(--spacing-sm);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      background: var(--color-background);
      color: var(--color-text);
    }

    .source-table {
      width: 100%;
      border-collapse: collapse;
    }

    .source-table tr {
      cursor: pointer;
      border-bottom: 1px solid var(--color-border);
    }

    .source-table tr:hover { background: var(--color-background-alt); }
    .source-table tr.selected { background: rgba(var(--color-primary-rgb, 61,108,81), 0.1); }

    .source-table td {
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: 0.9rem;
    }

    .icon-cell { width: 28px; }
    .country-cell { width: 60px; text-align: right; color: var(--color-text-light); }
    .generic-icon { font-size: 1rem; }
    .generic-icon.large { font-size: 2rem; }

    .source-card {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-lg);
      min-height: 300px;
      background: var(--color-background-alt);
    }

    .card-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 300px;
      color: var(--color-text-light);
    }

    .card-content {
      padding: var(--spacing-xl);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
    }

    .card-header h2 { margin: 0 0 var(--spacing-xs); }
    .authority { color: var(--color-text-light); margin: 0; font-size: 0.9rem; }
    .country { margin: var(--spacing-xs) 0 0; font-size: 0.85rem; }
    .description { color: var(--color-text-light); line-height: 1.6; }

    .card-actions {
      display: flex;
      gap: var(--spacing-md);
      margin-top: var(--spacing-xl);
      flex-wrap: wrap;
    }

    .ingest-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--border-radius-md);
      cursor: pointer;
      font-size: 0.95rem;
    }

    .ingest-button.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .delete-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background: transparent;
      color: #dc3545;
      border: 1px solid #dc3545;
      border-radius: var(--border-radius-md);
      cursor: pointer;
      font-size: 0.95rem;
    }

    @media (max-width: 768px) {
      .split-panel {
        grid-template-columns: 1fr;
      }
    }
  </style>
  ```

- [ ] **Step 2: Add route in `routes.ts`**

  Add to the imports and routes object in `routes.ts`:

  ```typescript
  import Sources from './src/lib/pages/Sources.svelte'

  export const routes: Record<string, ComponentType> = {
    // ... existing routes ...
    '/sources': Sources,
  }
  ```

- [ ] **Step 3: Remove superseded file**

  ```bash
  git rm src/lib/pages/CKAN_URL.svelte
  ```

- [ ] **Step 4: Add admin Edit source functionality**

  In `Sources.svelte`, add edit state alongside the existing add-form state in the script block:

  ```typescript
  let editingSource: DataSource | null = null
  let editDisplayName = ''
  let editDescription = ''
  let editAuthority = ''
  let editCountry = ''
  let editIconUrl: string | null = null
  let editSaving = false
  let editError = ''

  function openEdit(source: DataSource) {
    editingSource = source
    editDisplayName = source.display_name
    editDescription = source.description ?? ''
    editAuthority = source.authority ?? ''
    editCountry = source.country ?? ''
    editIconUrl = source.icon_url
  }

  async function handleEditSource() {
    if (!editingSource) return
    editSaving = true
    editError = ''
    const { error: err } = await supabase
      .from('data_sources')
      .update({
        display_name: editDisplayName,
        description: editDescription || null,
        authority: editAuthority || null,
        country: editCountry.toUpperCase() || null,
        icon_url: editIconUrl,
      })
      .eq('id', editingSource.id)
    editSaving = false
    if (err) { editError = err.message; return }
    const { data } = await supabase.from('data_sources').select('*').order('display_name')
    sources = data ?? []
    selectedSource = sources.find(s => s.id === editingSource!.id) ?? null
    editingSource = null
  }
  ```

  Add the Edit button to the card's admin actions (alongside the existing Delete button):

  ```html
  {#if $session?.user?.app_metadata?.claims_admin}
    <button class="edit-button" on:click={() => openEdit(selectedSource!)}>Edit</button>
    <button class="delete-button" on:click={() => handleDeleteSource(selectedSource!.id)}>Delete Source</button>
  {/if}
  ```

  Add the edit form panel (below the add-form panel, inside `.sources-page`):

  ```html
  {#if editingSource}
    <div class="add-form-panel">
      <h2>Edit: {editingSource.display_name}</h2>
      {#if editError}<p class="form-error">{editError}</p>{/if}
      <div class="form-row">
        <label>Display Name<input type="text" bind:value={editDisplayName} /></label>
      </div>
      <div class="form-row">
        <label>Authority<input type="text" bind:value={editAuthority} /></label>
      </div>
      <div class="form-row">
        <label>Country (ISO)<input type="text" bind:value={editCountry} maxlength={2} /></label>
      </div>
      <div class="form-row">
        <label>Description<textarea bind:value={editDescription} rows={3}></textarea></label>
      </div>
      <div class="form-row">
        <label>Icon URL (override)<input type="url" bind:value={editIconUrl} /></label>
      </div>
      <div class="form-actions">
        <button class="save-button" on:click={handleEditSource} disabled={editSaving}>
          {editSaving ? 'Saving…' : 'Save Changes'}
        </button>
        <button class="cancel-button" on:click={() => editingSource = null}>Cancel</button>
      </div>
    </div>
  {/if}
  ```

  Add to styles:

  ```css
  .edit-button {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-size: 0.95rem;
  }
  ```

- [ ] **Step 5: Add Sources link to the navigation header**

  Open `src/lib/components/Header.svelte`. Find where nav links are defined and add a Sources link alongside the existing ones. The exact edit depends on the current Header markup — find the nav list and add:

  ```html
  <a href="#/sources" on:click|preventDefault={() => navigate('/sources')}
     class:active={$currentRoute === '/sources'}>
    Sources
  </a>
  ```

---

## Task 4: Smoke test

- [ ] **Step 1: Start dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Navigate to `/sources`**

  - Page loads without errors
  - Left panel shows source list (empty initially — that's correct)
  - Right panel shows "Select a source to view details"
  - Country filter dropdown shows "All countries"

- [ ] **Step 3: Add a source (logged in)**

  Log in, click "Add Source". Enter a valid CKAN URL (e.g. `https://open.alberta.ca/opendata`).

  Expected:
  - On blur, form auto-populates display name, description, authority
  - Icon detection runs in background
  - Save adds the source to the list
  - Selecting it shows the card on the right

- [ ] **Step 4: Test auth-gated controls when logged out**

  Log out. Navigate to `/sources`.

  Expected:
  - "Add Source" button is visible but greyed out
  - Hovering shows "Log in to enable" tooltip
  - "Browse / Ingest" on the card is also greyed out

---

## Task 5: Commit

- [ ] **Step 1: Stage and commit**

  ```bash
  git add \
    src/lib/pages/Sources.svelte \
    src/lib/utils/ckan.ts \
    src/lib/components/Header.svelte \
    routes.ts \
    supabase/functions/detect-icon/index.ts

  git rm src/lib/pages/CKAN_URL.svelte

  git commit -m "feat: Sources page — split-panel UI, CKAN URL validation, detect-icon edge function"
  ```

---

**Next:** [Plan 4 — Ingestion Workflow](2026-04-13-plan-4-ingestion.md)
