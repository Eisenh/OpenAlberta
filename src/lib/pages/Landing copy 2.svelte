<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import Graph from '../components/Graph.svelte';
  import GraphExpanded from '../components/GraphExpanded.svelte';
  import { searchHistory } from '../stores/searchHistory';
  import { supabase } from '../supabaseClient';
  import { pipeline, env } from "@xenova/transformers";
 // import modelPath from '../../assets/models/all-MiniLM-L6-v2?url';

  // Define the required model path
  const REQUIRED_MODEL =  "../public/models/all-MiniLM-L6-v2"  //ll-MiniLM-L6-v2";   //" "Xenova/all-MiniLM-L6-v2";
  
// Initialize embedder lazily to avoid top-level await issues
  let embedder = null;
  //let session = null;
  async function getEmbedder() {
    if (!embedder) {
      console.log("Initializing embedder...");
      embedder = await pipeline("feature-extraction", REQUIRED_MODEL);
      console.log("Embedder initialized");
    }
    return embedder;
  }
  let graphData = writable({ nodes: [], links: [] });
  let query = '';
  let queryVector = [];
  let searchResults = writable([]);
  let selectedDataset = writable(null);
  let expandedResults = writable({});
  let isModelLoading = writable(false);
  let modelLoadingProgress = writable(0);
  let modelLoadError = writable(null);
  let searchInput = '';

  // Store the model instance for reuse - use a writable store to ensure reactivity
  const modelInstance = writable(null);
  // Flag to track if we've already attempted to load the model
  let modelLoadAttempted = false;
  // Flag to track if model loading is in progress
  let modelLoadInProgress = false;
  let displayMode = 'compact';
  let similarityThreshold = 0.3;

  function toggleResultExpansion(id) {
    expandedResults.update(current => ({
      ...current,
      [id]: !current[id]
    }));
  }
  
  let debugInfo = {
    apiCall: null,
    searchResult: null,
    graphDataUpdate: null,
    error: null
  };

  function setSelectedDataset(id) {
    const result = $searchResults.find(result => result.id === id);
    if (result) {
      selectedDataset.set(result);
    }
  }
  
  
  // Function to try loading the required model
  async function tryLoadModel() {
    isModelLoading.set(true);
    modelLoadError.set(null);
    
    try {
      console.log(`Attempting to load model: ${REQUIRED_MODEL}`);
      const embedder = await getEmbedder();  //pipeline("feature-extraction", REQUIRED_MODEL, {
        /*cache: true,
        progress_callback: (progress) => {
          const percent = Math.round(progress.progress);
          console.log(`Model loading progress: ${percent}%`);
          modelLoadingProgress.set(percent);
        }
      });  */
      console.log(`Successfully loaded model: ${REQUIRED_MODEL}`);
      isModelLoading.set(false);
      return embedder;
    } catch (error) {
      console.log(error);
      // Check if the error is related to network/HTML response
      if (error.message && error.message.includes("Unexpected token '<'")) {
        console.error(`Network error loading model ${REQUIRED_MODEL}: Received HTML instead of JSON. This might be due to network issues or CORS problems.`);
        console.error("This is likely a CORS issue. The model needs to be accessed from a server with proper CORS headers.");
      } else {
        console.error(`Error loading model ${REQUIRED_MODEL}:`, error);
      }
      
      // Model failed to load
      const errorMsg = "Failed to load embedding model. Using text search fallback.";
      console.warn(errorMsg);
      modelLoadError.set(errorMsg);
      isModelLoading.set(false);
      return null; // Return null instead of throwing an error to allow fallback
    }
  }

  onMount(async () => {
    console.log("Component mounted");
    debugInfo = {
      apiCall: "Component initialized",
      searchResult: "Not started",
      graphDataUpdate: "Not started",
      error: null
    };
    
    // Only attempt to preload the model once and only if not already in progress
    if (!modelLoadAttempted && !modelLoadInProgress) {
      modelLoadAttempted = true;
      modelLoadInProgress = true;
      try {
        const model = await tryLoadModel();
        if (model) {
          modelInstance.set(model);
          console.log("Model preloaded successfully and stored for reuse");
        } else {
          console.log("Model preload failed");
        }
      } catch (error) {
        console.error("Failed to preload model:", error);
      } finally {
        modelLoadInProgress = false;
      }
    }
  });
  
  const generateEmbedding = async (text) => {
    // If we don't have a model instance and we've already attempted to load it,
    // don't try again - just throw an error
    if (!$modelInstance && modelLoadAttempted) {
      throw new Error("Model not available");
    }
    
    try {
      // Use the existing model instance if available
      if ($modelInstance) {
        console.log("Using cached model instance");
        const  output = await $modelInstance(text, { pooling: "mean", normalize: true });
        // Extract the embedding output
        const embedding = Array.from(output.data)
        console.log("Embedding generated successfully line 155", embedding);
        console.log('Data Type:', typeof embedding);
        console.log('result.data Length:', embedding.length);
        
        return embedding;  //whole embedding incl .data, .shape, .dtype
      }
      
      // If we get here, we need to load the model
      if (!modelLoadInProgress && !modelLoadAttempted) {
        modelLoadAttempted = true;
        modelLoadInProgress = true;
        
        try {
          console.log("Loading model for embedding generation");
          const embedder = await tryLoadModel();
          modelLoadInProgress = false;
          
          if (embedder) {
            modelInstance.set(embedder);
            const output = await embedder(text, { pooling: "mean", normalize: true });
            // Extract the embedding output
            const embedding = Array.from(output.data)
            console.log("Embedding generated successfully line 177", embedding);
            return embedding; //Array.from(result.data);  //embeddding vector
          } else {
            throw new Error("Failed to load model");
          }
        } catch (error) {
          modelLoadInProgress = false;
          throw error;
        }
      }
      
      // If we're currently loading the model, wait a bit and try again
      if (modelLoadInProgress) {
        throw new Error("Model loading in progress");
      }
      
      throw new Error("Unable to generate embedding");
    } catch (error) {
      console.error("Error generating embedding:", error);
      // Check if the error is related to network/HTML response
      if (error.message && error.message.includes("Unexpected token '<'")) {
      console.error("Received HTML instead of JSON. This might be due to network issues or CORS problems.");
      }
      throw error;
    }
  };

  // Fallback search function that doesn't use embeddings
  async function fallbackSearch(queryText) {
    console.log("Using fallback search method with text search");
    
      try {
        // Use a simple ILIKE query instead of textSearch since metadata is JSONB
        const { data, error } = await supabase
          .from('docs')
          .select('id, created_at, metadata, package')
          .or(`metadata->>title.ilike.%${queryText}%,metadata->>description.ilike.%${queryText}%,metadata->>notes.ilike.%${queryText}%`)
          .limit(8);
      
      if (error) {
        console.error("Text search error:", error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log("No results found in text search");
        return [];
      }
      
      console.log(`Found ${data.length} results using text search`);
      
      return data.map((item, index) => ({
        id: item.id,
        payload: {
          title: item.metadata.title || "Untitled",
          description: item.metadata.description || item.content || "No description available",
          notes: item.metadata.notes,
          resources: item.metadata.resources || [],
          tags: item.metadata.tags || []
        },
        score: 1 - (index * 0.1)
      }));
    } catch (error) {
      console.error("Fallback search error:", error);
      throw error;
    }
  }

// First, let's modify the searchVectors function to return consistent data structure
async function searchVectors(queryText) {
  try {
    if ($modelInstance) {
      console.log("Using vector search with loaded model");
      let queryVector = [];
      try {
        queryVector = [...(await generateEmbedding(queryText))];
        
        const { error: matchError, data: response } = await supabase.rpc(
          'match_vectors',
          {
            query_embedding: queryVector,
            match_threshold: similarityThreshold,
            match_count: 9, // Get 9 to account for potential self-match
          }
        );

        if (matchError) {
          console.error('Error searching documents:', matchError);
          return { results: [], queryText };
        }

        if (!response || response.length === 0) {
          console.log("No vector search results found");
          return { results: [], queryText };
        }

        const results = response.map((item) => ({
          id: item.id,
          payload: {  // Wrap in payload to match fallback structure
            title: item.metadata.title || "Untitled",
            description: item.metadata.notes || item.content || "No description available",
            resources: item.metadata.resources || [],
            tags: item.metadata.tags || [],
            notes: item.metadata.notes
          },
          similarity: item.similarity
        }));

        return { results, queryText };
      } catch (error) {
        console.error("Error in vector search:", error);
        return { results: [], queryText };
      }
    } else {
      // Fallback to text search with same return structure
      const { data, error } = await supabase
        .from('docs')
        .select('id, metadata')
        .or(`metadata->>title.ilike.%${queryText}%,metadata->>description.ilike.%${queryText}%,metadata->>notes.ilike.%${queryText}%`)
        .limit(8);

      if (error) throw error;

      const results = (data || []).map((item, index) => ({
        id: item.id,
        payload: {
          title: item.metadata.title || "Untitled",
          description: item.metadata.notes || "No description available",
          resources: item.metadata.resources || [],
          tags: item.metadata.tags || [],
          notes: item.metadata.notes
        },
        similarity: 1 - (index * 0.1)
      }));

      return { results, queryText };
    }
  } catch (error) {
    console.error("Search error:", error);
    return { results: [], queryText };
  }
}

// Fix the handleNodeClick function
async function handleNodeClick(node) {
  if (node.id === 'query') return;
  
  const { results } = await searchVectors(node.description);
  
  if (!results || results.length === 0) {
    console.log("No results found for node click");
    // Clear graph when no results
    graphData.set({ nodes: [], links: [] });
    return;
  }
  
  // Set the clicked node as the selected dataset
  const clickedDataset = results.find(result => result.id === node.id) || {
    id: node.id,
    payload: {
      title: node.label || 'Untitled',
      description: node.description || 'No description available',
      notes: node.notes,
      resources: node.resources || [],
      tags: node.tags || []
    }
  };
  selectedDataset.set(clickedDataset);

  // Transform results into graph data
  const graphNodes = [
    {
      id: 'query',
      label: node.label || 'Untitled', // Use the clicked node's title/label
      description: node.description,    // Keep description for hover tooltip
      originalId: node.id,
      type: 'query'
    },
    ...results
      .filter(result => result.id !== node.id)
      .slice(0, 8)
      .map(result => ({
        id: result.id,
        label: result.payload.title || 'Untitled',
        description: result.payload.description || 'No description available',
        type: 'result',
        similarity: result.similarity
      }))
  ];

  const graphLinks = graphNodes
    .filter(n => n.id !== 'query')
    .map(node => ({
      source: 'query',
      target: node.id,
      weight: node.similarity ? Math.max(1, node.similarity * 5) : 3
    }));

  console.log("Node click - Updating graph with:", { nodes: graphNodes, links: graphLinks });
  
  // Force a new object reference when updating graph data
  graphData.set({ 
    nodes: [...graphNodes], 
    links: [...graphLinks] 
  });
  searchResults.set(results); // Set the raw results for the results list
}

// Fix the handleTextSearch function
async function handleTextSearch() {
  console.log("handleTextSearch called");
  if (!searchInput?.trim()) {
    console.log("Empty search input, returning");
    return;
  }
  
  try {
    console.log("Calling searchVectors with:", searchInput);
    const { results } = await searchVectors(searchInput);
    
    console.log("Search results:", results);
    
    if (!results || results.length === 0) {
      console.log("No results found");
      searchResults.set([]);
      graphData.set({ nodes: [], links: [] });
      return;
    }

    const graphNodes = [
      {
        id: 'query',
        label: searchInput.length > 50 ? `${searchInput.slice(0, 47)}...` : searchInput,
        description: searchInput,
        type: 'query'
      },
      ...results.slice(0, 8).map(result => ({
        id: result.id,
        label: result.payload.title || 'Untitled',
        description: result.payload.description || 'No description available',
        type: 'result',
        similarity: result.similarity
      }))
    ];

    const graphLinks = results.slice(0, 8).map(result => ({
      source: 'query',
      target: result.id,
      weight: result.similarity ? Math.max(1, result.similarity * 5) : 3
    }));

    console.log("Text search - Updating graph with:", { nodes: graphNodes, links: graphLinks });
    
    // Force a new object reference to trigger reactivity
    graphData.set({ 
      nodes: [...graphNodes], 
      links: [...graphLinks] 
    });
    searchResults.set(results);
  } catch (error) {
    console.error("Error in handleTextSearch:", error);
  }
}
</script>
<div class="landing-page">
   
  <section class="main-content-section">
    <div class="search-container"> 
      <div class="search-input-wrapper">
        <input
          type="text"
          bind:value={searchInput}
          placeholder="What data are you looking for?"
          class="search-input"
          on:input={(e) => console.log("Input changed:", e.target.value, "searchInput:", searchInput)}
          on:keydown={(e) => {
            if (e.key === 'Enter') {
              console.log("Enter pressed, searchInput:", searchInput);
              document.querySelector('.search-button').click();
            }
          }}
        />
        <button on:click={handleTextSearch} class="search-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Search
        </button>
      </div>
      
      <div class="graph-controls">
        <label class="control-group">
          <span class="control-label">View Mode:</span>
          <select bind:value={displayMode} class="mode-select">
            <option value="compact">Compact</option>
            <option value="expanded">Expanded</option>
          </select>
        </label>
        
        <label class="control-group">
          <span class="control-label">Similarity Threshold:</span>
          <input
            type="range"
            bind:value={similarityThreshold}
            min="0.1"
            max="0.9"
            step="0.05"
            class="threshold-slider"
          />
          <span class="threshold-value">{similarityThreshold}</span>
        </label>
      </div>

      <!-- Dataset details panel -->
      {#if $selectedDataset}
        <div class="dataset-details-panel">
          <h3 class="panel-title">{$selectedDataset.payload.title}</h3>
          
          <!-- Notes field -->
          {#if $selectedDataset.payload.notes}
            <div class="dataset-notes">
              <h4>Notes</h4>
              <p>{$selectedDataset.payload.notes}</p>
            </div>
          {/if}
          
          <!-- Resources list -->
          {#if $selectedDataset.payload.resources && $selectedDataset.payload.resources.length > 0}
            <div class="dataset-resources">
              <h4>Resources</h4>
              <ul class="resources-list">
                {#each $selectedDataset.payload.resources as resource}
                  <li>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      {resource.name}
                      <svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 1L21 3"/></svg>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          
          <!-- Tags list -->
          {#if $selectedDataset.payload.tags && $selectedDataset.payload.tags.length > 0}
            <div class="dataset-tags">
              <h4>Tags</h4>
              <ul class="tags-list">
                {#each $selectedDataset.payload.tags as tag}
                  <li>{tag}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    
    <div class="graph-container">
      {#if $modelLoadError}
        <div class="model-load-error">
          <p>{$modelLoadError}</p>
        </div>
      {:else}
        {#if $isModelLoading}
          <div class="model-loading-indicator">
            <p>Loading model... {$modelLoadingProgress}%</p>
          </div>
        {:else}
          {#if displayMode === 'compact'}
            <Graph data={$graphData} onNodeClick={handleNodeClick} displayMode={displayMode} />
          {:else}
            <GraphExpanded data={$graphData} onNodeClick={handleNodeClick} />
          {/if}
        {/if}
      {/if}
    </div>
  </section>
</div>

<style>
  .landing-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--color-background);
    color: var(--color-text);
  }
  /*
  .hero {
    padding: var(--spacing-xl) 0;
    text-align: center;
  }
  
  .subtitle {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
  }
  */
  .main-content-section {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-lg);
  }
  
  .search-container {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--spacing-lg);
  }
  
  .search-input-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }
  
  .search-input {
    flex-grow: 1;
    padding: var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-md);
    color: var(--color-text);
    background-color: var(--color-background-alt);
    margin-right: var(--spacing-md);
  }
  
  .search-button {
    padding: var(--spacing-md) var(--spacing-lg);
    background-color: var(--color-primary);
    color: var(--color-text-light);
    border: none;
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
  }
  
  .search-button svg {
    margin-right: var(--spacing-sm);
  }
  
  .search-button:hover {
    background-color: var(--color-primary-dark);
  }
  
  .graph-container {
    flex-grow: 1;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background-color: var(--color-background-alt);
    padding: var(--spacing-md);
  }
  
  .dataset-details-panel {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    background-color: var(--color-background-alt);
  }
  
  .panel-title {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-md);
  }
  
  .dataset-notes {
    margin-bottom: var(--spacing-md);
  }
  
  .dataset-notes h4 {
    font-size: var(--font-size-md);
    margin-bottom: var(--spacing-sm);
  }
  
  .dataset-resources {
    margin-bottom: var(--spacing-md);
  }
  
  .dataset-resources h4 {
    font-size: var(--font-size-md);
    margin-bottom: var(--spacing-sm);
  }
  
  .resources-list {
    list-style: none;
    padding: 0;
  }
  
  .resources-list li {
    margin-bottom: var(--spacing-sm);
  }
  
  .resources-list li a {
    color: var(--color-primary);
    text-decoration: none;
    display: flex;
    align-items: center;
  }
  
  .resources-list li a:hover {
    text-decoration: underline;
  }
  
  .external-link-icon {
    margin-left: var(--spacing-sm);
  }
  
  .dataset-tags {
    margin-bottom: var(--spacing-md);
  }
  
  .dataset-tags h4 {
    font-size: var(--font-size-md);
    margin-bottom: var(--spacing-sm);
  }
  
  .tags-list {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
  }
  
  .tags-list li {
    margin-right: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    font-size: var(--font-size-sm);
    background-color: var(--color-background);
  }
  
  .model-load-error {
    color: var(--color-error);
    padding: var(--spacing-md);
    text-align: center;
  }
  
  .model-loading-indicator {
    padding: var(--spacing-md);
    text-align: center;
  }

  .graph-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .control-group {
    display: flex;
    flex-direction: column;
  }

  .control-label {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .mode-select,
  .threshold-slider {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-background-alt);
    color: var(--color-text);
  }

  .threshold-slider {
    width: 150px;
  }

  .threshold-value {
    margin-left: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }
</style>
