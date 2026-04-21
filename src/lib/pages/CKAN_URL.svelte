<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { validateCKANUrl } from '../utils/ckan';
  import { supabase } from '../supabaseClient';
  import { CKANIngestor } from '../utils/ckanIngestion';

  let ckanUrl = '';
  let displayName = '';
  let description = '';
  let error = '';
  let message = '';
  let loading = false;

  let dataSources: any[] = [];

  // Ingestion state
  let currentIngestor: CKANIngestor | null = null;
  let ingestProgress = { msg: '', current: 0, total: 0 };
  let isIngesting = false;
  let maxHardwareCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 16 : 16;
  let maxWorkers = Math.max(1, Math.floor(maxHardwareCores * 0.75));
  let isWebGPUAvailable = false;
  let useWebGPU = false; // Temporarily default to false

  async function loadDataSources() {
      const { data, error: dbErr } = await supabase.from('data_sources').select('*');
      if (!dbErr) dataSources = data || [];
  }

  onMount(() => {
      // isWebGPUAvailable = typeof navigator !== 'undefined' && 'gpu' in navigator;
      loadDataSources();
  });

  onDestroy(() => {
      if (currentIngestor) currentIngestor.stop();
  });

  async function handleAdd() {
    error = '';
    message = '';
    loading = true;
    
    if (!await validateCKANUrl(ckanUrl)) {
      error = 'Not a valid CKAN API endpoint, or blocked by CORS!';
      loading = false;
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
        error = 'You must be logged in.';
        loading = false;
        return;
    }
    
    const { error: dbErr } = await supabase
      .from('data_sources')
      .insert({
        ckan_url: ckanUrl.replace(/\/+$/, ''),
        display_name: displayName,
        description: description,
        added_by: userData.user.id
      });
      
    if (dbErr) {
        error = dbErr.message;
    } else {
        message = 'Successfully added! Awaiting Admin approval.';
        ckanUrl = '';
        displayName = '';
        description = '';
        await loadDataSources();
    }
    loading = false;
  }

  function startIngestion(source: any, isDelta: boolean = false) {
      if (currentIngestor) currentIngestor.stop();

      error = '';
      message = '';
      isIngesting = true;
      const appliedWorkers = (isWebGPUAvailable && useWebGPU) ? 1 : maxWorkers;
      currentIngestor = new CKANIngestor(source.ckan_url, source.id, isDelta, appliedWorkers, (isWebGPUAvailable && useWebGPU));
      
      currentIngestor.onProgress = (msg, current, total) => {
          ingestProgress = { msg, current, total };
      };

      currentIngestor.onComplete = (success, msg) => {
          isIngesting = false;
          if (success) {
              message = msg;
          } else {
              error = msg;
          }
      };

      currentIngestor.start();
  }

</script>

<div class="ckan-container">
    <h2>Manage CKAN Data Sources</h2>
    
    {#if error}
        <div class="alert error">{error}</div>
    {/if}
    {#if message}
        <div class="alert success">{message}</div>
    {/if}

    <div class="card add-card">
        <h3>Add New Data Source</h3>
        <div class="form-group">
            <label for="ckan_url">CKAN URL</label>
            <input id="ckan_url" type="text" bind:value={ckanUrl} placeholder="https://open.alberta.ca" />
        </div>
        <div class="form-group">
            <label for="display_name">Display Name</label>
            <input id="display_name" type="text" bind:value={displayName} placeholder="Alberta Open Data" />
        </div>
         <div class="form-group">
            <label for="description">Description (optional)</label>
            <input id="description" type="text" bind:value={description} placeholder="Provincial government datasets" />
        </div>
        <button disabled={loading} on:click={handleAdd}>
            {loading ? 'Validating...' : 'Add Data Source'}
        </button>
    </div>

    <div class="sources-list mt-4">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Existing Sources</h3>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                {#if false}
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="webgpuToggle" bind:checked={useWebGPU} />
                        <label for="webgpuToggle" class="text-sm">Enable WebGPU Acceleration</label>
                    </div>
                {/if}
                
                <div class="worker-settings" style="display: flex; align-items: center; gap: 0.5rem;">
                    <label for="workerSlider" class="text-sm font-semibold">Concurrent WASM Threads:</label>
                    <input id="workerSlider" type="range" min="1" max={maxHardwareCores} bind:value={maxWorkers} />
                    <span class="text-sm badge approved">{maxWorkers}</span>
                </div>
            </div>
        </div>
        {#if dataSources.length === 0}
            <p>No data sources found.</p>
        {:else}
            {#each dataSources as source}
                <div class="card source-card">
                    <h4>{source.display_name}</h4>
                    <p class="text-sm">{source.ckan_url}</p>
                    
                    <div class="status-bar mt-2">
                        {#if !source.is_approved}
                            <span class="badge pending">Pending Admin Approval</span>
                        {:else}
                            <span class="badge approved">Approved</span>
                            <div class="action-buttons">
                                <button class="btn-primary ml-2" disabled={isIngesting} on:click={() => startIngestion(source, false)}>
                                    Full Ingestion
                                </button>
                                <button class="btn-secondary ml-2" disabled={isIngesting} on:click={() => startIngestion(source, true)}>
                                    Refresh (Delta sync)
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    {#if isIngesting}
        <div class="card mt-4 ingestion-panel">
            <h3>Ingesting Data...</h3>
            <p>{ingestProgress.msg}</p>
            {#if ingestProgress.total > 0}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {(ingestProgress.current / ingestProgress.total) * 100}%"></div>
                </div>
                <p class="text-sm text-center">{ingestProgress.current} / {ingestProgress.total}</p>
            {/if}
            <button class="btn-danger mt-2" on:click={() => { if(currentIngestor) currentIngestor.stop(); isIngesting = false; }}>
                Cancel Ingestion
            </button>
        </div>
    {/if}
</div>

<style>
.ckan-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #333;
}

h2, h3, h4 {
    margin-top: 0;
}

.card {
    background: #ffffff;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    border: 1px solid #f1f5f9;
}

.add-card {
    border-top: 4px solid #4f46e5;
}

.form-group {
    margin-bottom: 1.25rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
}

.form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    box-sizing: border-box;
}

.form-group input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
}

button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    transition: all 0.2s;
    background: #4f46e5;
    color: white;
}

button:hover:not([disabled]) {
    background: #4338ca;
}

button[disabled] {
    background: #e2e8f0;
    color: #94a3b8;
    cursor: not-allowed;
}

.btn-inline {
    padding: 0.5rem 1rem;
    background: #10b981;
}

.btn-inline:hover:not([disabled]) {
    background: #059669;
}

.btn-danger {
    background: #ef4444;
}

.btn-danger:hover {
    background: #dc2626;
}

.alert {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-weight: 500;
}

.error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

.success {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1.5rem; }
.ml-2 { margin-left: 0.5rem; }

.text-sm {
    font-size: 0.875rem;
    color: #64748b;
    margin-top: 0.25rem;
    margin-bottom: 0;
}

.text-center {
    text-align: center;
}

.status-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
}

.badge {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.pending {
    background: #fef3c7;
    color: #b45309;
}

.approved {
    background: #dcfce3;
    color: #166534;
}

.ingestion-panel {
    border: 2px solid #e0e7ff;
    animation: pulse-border 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-border {
    0%, 100% { border-color: #e0e7ff; }
    50% { border-color: #818cf8; }
}

.progress-bar {
    width: 100%;
    height: 10px;
    background: #f1f5f9;
    border-radius: 999px;
    overflow: hidden;
    margin: 1.5rem 0 1rem 0;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5, #818cf8);
    transition: width 0.3s ease-out;
    border-radius: 999px;
}
</style>