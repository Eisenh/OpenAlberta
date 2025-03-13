<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import Graph from '../components/Graph.svelte';
  import { searchHistory } from '../stores/searchHistory';
  import { supabase } from '../supabaseClient';
  import { pipeline, env } from "@xenova/transformers";
  //import * as ort from "onnxruntime-web";
/*
  // Configure the transformers.js library to use local models
  env.allowLocalModels = true;
  env.localModelPath = "/public/models/";
  env.useBrowserCache = true;
  env.useCustomCache = true;
  // Configure path for local ONNX model
  env.localModelPath = "/models/";
  env.cacheDir = "/models/";
  env.backends.onnx.wasm.wasmPaths = "/models/";
  // Required model for compatibility with database records
    // http://localhost:5173/models/all-MiniLM-L6-v2.onnx
*/
  const REQUIRED_MODEL ="../public/models/all-MiniLM-L6-v2"  //ll-MiniLM-L6-v2";   //" "Xenova/all-MiniLM-L6-v2";
  
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
  
  // Store the model instance for reuse - use a writable store to ensure reactivity
  const modelInstance = writable(null);
  // Flag to track if we've already attempted to load the model
  let modelLoadAttempted = false;
  // Flag to track if model loading is in progress
  let modelLoadInProgress = false;

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
        console.log("Embedding generated successfully ", embedding);
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
            console.log("Embedding generated successfully");
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

  async function searchVectors(queryText) {
    try {
      // If we have a model instance, use it for vector search
      if ($modelInstance) {
        console.log("Using vector search with loaded model");
        let queryVector = [];
        try {

          queryVector = [...(await generateEmbedding(queryText))];
          //console.log('Query Vector:', queryVector);
          //console.log('Data Type:', typeof queryVector);
          //console.log('Array Length:', queryVector.length);
          //console.log('First 5 Values:', queryVector.slice(0, 5));
          //let qv = Array.from(queryVector.data);
          //console.log('Array from Query Vector:', qv);
          //console.log("Embedding generated, searching vectors...", queryVector);
          
          const { error: matchError, data: response } = await supabase.rpc(
            'match_vectors',
            {
              query_embedding: queryVector,
              match_threshold: 0.3,
              match_count: 9,
              //min_content_length: 50,
            }
          );  //match_vectors 
          if (matchError) {
            console.error('Error searching documents:', matchError);
            return [];
          }
          console.log("Embedding generated, searching vectors...", queryVector);

          // Ensure embedding is properly formatted before sending to Supabase
          /*const embeddingArray = Array.isArray(embedding.tolist()) 
            ? embedding.tolist() 
            : Object.values(embedding.tolist());
          console.log("First 5 embedding values:", embeddingArray.slice(0, 5));
          
          const response = await supabase
            .from('docs')
            .select('id, created_at, metadata, package')
            .rpc('match_notes_embeddings', { 
              query_embedding: embeddingArray,
              match_threshold: 0.5,
              match_count: 8
            });
          
          
          if (response.error) throw response.error;
          */
          //console.log("Search response received from Supabase ", response);
          
          //const data = response.data;
          
          if (!response || response.length === 0) {
            console.log("No vector search results found");
            return [];
          }
          
          return response.map((item, index) => ({
            id: item.id,
            payload: {
              title: item.metadata.title || "Untitled",
              description: item.metadata.notes || item.content || "No description available",
              //notes: item.metadata.notes,
              resources: item.metadata.resources || [],
              tags: item.metadata.tags || []
            },
            score: 1 - (index * 0.2) // Temporary scoring until we get real distances
          }));
        } catch (error) {
          console.error("Vector search failed:", error);
          throw error;
        }
      } else {
        // If we don't have a model instance, use text search
        console.log("No model available, using text search");
        
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
        
        //console.log(`Found ${data.length} results using text search`);
        
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
      }
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  };
  
  // search performs a searchVectors call and updates the searchResults store, 
  // and passes graph data for display
  const search = async () => {
    if (!query) return;
    
    debugInfo.error = null;
    console.log("Starting search with query:", query);
    
    try {
      debugInfo.apiCall = `Searching for: ${query}`;
      
      const searchResponse = await searchVectors(query);
      console.log("Search response:", searchResponse);
      debugInfo.searchResult = `✓ Results: ${searchResponse.length} items`;
      
      if (!searchResponse?.length) {
        console.log("No results found");
        searchResults.set([]);
        return;
      }

      const processedResults = searchResponse.map(item => ({
        id: item.id,
        payload: item.payload,
        score: item.score
      }));

      searchResults.set(processedResults);
      
      const nodes = processedResults.map((result, index) => ({
        id: result.id,
        label: result.payload.title,
        description: result.payload.description,
        score: result.score
      }));

      const links = nodes.map(node => ({
        source: 'query',
        target: node.id,
        label: `Similarity match`,
        weight: node.score
      }));

      const newGraphData = { 
        nodes: [{ 
          id: 'query', 
          label: query.split(' ').slice(0, 5).join(' ') + (query.split(' ').length > 5 ? '...' : ''),
          type: 'query', 
          description: query 
        }, ...nodes], 
        links 
      };
      
      graphData.set(newGraphData);
      debugInfo.graphDataUpdate = `✓ Graph data: ${nodes.length} nodes, ${links.length} links`;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        searchHistory.addSearch(query, new Date().toISOString());
      }
    } catch (error) {
      console.error("Search error:", error);
      debugInfo.error = `Error: ${error.message}`;
      searchResults.set([]);
    }
  };

  const handleNodeClick = async (node) => {
    if (node.id === 'query') return;
    setSelectedDataset(node.id);
    
    // Store the clicked node's label to use as the new query node label
    const clickedNodeLabel = node.label || '';
    
    // Set the query text to the node's description
    query = node.description;
    
    // Perform the search
    await search();
    
    //}
  };
</script>
<div class="landing-page">
  <section class="hero">
    <p class="subtitle">Discover connections in Alberta's open data through visual exploration</p>
  </section>
  
  <section class="main-content-section">
    <div class="search-container">
      <div class="search-input-wrapper">
        <input
          type="text"
          bind:value={query}
          placeholder="What data are you looking for?"
          class="search-input"
          on:keydown={(e) => {
            if (e.key === 'Enter') {
              document.querySelector('.search-button').click();
            }
          }}
        />
        <button on:click={search} class="search-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Search
        </button>
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
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="graph-container">
      <Graph
        {graphData}
        onNodeClick={handleNodeClick}
      />
    </div>
    
    <!-- Debug Panel (hidden) -->
    <div class="debug-panel" style="display: none;">
      <h3>Debug Information</h3>
      <ul>
        <li><strong>Query:</strong> {query || "None"}</li>
        <li><strong>Last API Call:</strong> {debugInfo.apiCall || "None"}</li>
        <li><strong>Vector Result:</strong> {debugInfo.vectorResult || "N/A"}</li>
        <li><strong>Qdrant Result:</strong> {debugInfo.qdrantResult || "N/A"}</li>
        <li><strong>Graph Data:</strong> {debugInfo.graphDataUpdate || "N/A"}</li>
        {#if debugInfo.error}
          <li class="error"><strong>Error:</strong> {debugInfo.error}</li>
        {/if}
      </ul>
    </div>
  </section>

  {#if $searchResults && $searchResults.length > 0}
    <section class="results-section">
      <h2>Search Results</h2>
      <div class="accordion-results">
        {#each $searchResults as result, i}
          <div class="accordion-item">
            <div 
              class="accordion-header" 
              on:click={() => toggleResultExpansion(result.id)}
              on:keydown={(e) => e.key === 'Enter' && toggleResultExpansion(result.id)}
              tabindex="0"
              role="button"
              aria-expanded={$expandedResults[result.id] ? 'true' : 'false'}
            >
              <span class="result-number">{i + 1}</span>
              <h3 class="result-title">{result.payload.title || 'Untitled Dataset'}</h3>
              <div class="accordion-actions">
                <!-- <button class="secondary explore-btn" on:click={(e) => { e.stopPropagation(); handleNodeClick(result); }}>
                  Explore
                </button> -->
                <div class="accordion-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:rotated={$expandedResults[result.id]}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            {#if $expandedResults[result.id]}
              <div class="accordion-content">
                <p class="result-description">{result.payload.description || 'No description available'}</p>
                {#if result.payload.tags && result.payload.tags.length > 0}
                  <div class="result-tags">
                    {#each result.payload.tags as tag}
                      <span class="tag">{tag.display_name}</span>
                    {/each}
                  </div>
                {/if}
                {#if result.payload.notes}
                  <div class="result-notes">
                    <h4>Notes</h4>
                    <p>{result.payload.notes}</p>
                  </div>
                {/if}
                {#if result.payload.resources && result.payload.resources.length > 0}
                  <div class="result-resources">
                    <h4>Resources</h4>
                    <ul class="resources-list">
                      {#each result.payload.resources as resource}
                        <li>
                          <a href={resource.url} target="_blank" rel="noopener noreferrer">
                            {resource.name}
                            <svg class="external-link-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {:else if query}
    <section class="no-results">
      <div class="message info">
        <p>No results found for "{query}". Try a different search term.</p>
      </div>
    </section>
  {/if}
</div>

<style>
  .landing-page {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .hero {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .subtitle {
    color: var(--color-text-light);
    font-size: 1.1rem;
    margin-bottom: var(--spacing-xl);
  }

  .main-content-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
  }

  .search-container {
    width: 100%;
  }

  .search-input-wrapper {
    display: flex;
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    background-color: var(--color-background-alt);
    border: 1px solid var(--color-border);
  }

  .search-input {
    flex: 1;
    padding: var(--spacing-lg);
    border: none;
    font-size: 1.1rem;
    margin: 0;
  }

  .search-button {
    background-color: var(--color-primary);
    color: white;
    border: none;
    padding: var(--spacing-md) var(--spacing-xl);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-weight: var(--font-weight-medium);
    border-radius: 0;
    margin: 0;
  }

  .search-button:hover {
    background-color: var(--color-primary-light);
  }

  .graph-container {
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    background-color: var(--color-background-alt);
    border: 1px solid var(--color-border);
    height: 500px;
    width: 100%;
  }

  /* Desktop layout */
  @media (min-width: 992px) {
    .main-content-section {
      flex-direction: row;
      align-items: stretch;
    }

    .search-container {
      width: 30%;
      min-width: 300px;
      padding-right: var(--spacing-md);
    }

    .graph-container {
      width: 70%;
      flex-grow: 1;
      height: calc(100vh - var(--header-height) - var(--footer-height));
    }
  }

  .results-section {
    margin: var(--spacing-xxl) 0;
  }

  .results-section h2 {
    margin-bottom: var(--spacing-lg);
    color: var(--color-primary);
  }
  
  /* Accordion styles */
  .accordion-results {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    width: 100%;
  }
  
  .accordion-item {
    border-radius: var(--border-radius-md);
    border: 1px solid var(--color-border);
    background-color: var(--color-background-alt);
    overflow: hidden;
  }
  
  .accordion-header {
    display: flex;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    position: relative;
    background-color: var(--color-background-alt);
    transition: background-color 0.2s;
  }
  
  .accordion-header:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  .accordion-content {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    background-color: var(--color-background);
  }
  
  .accordion-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }
  
  .accordion-icon {
    margin-left: var(--spacing-sm);
    transition: transform 0.3s ease;
  }
  
  .accordion-icon svg.rotated {
    transform: rotate(180deg);
  }
    
    /* .explore-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: 0.9rem;
    z-index: 2;
    } */
    
  .result-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    background-color: var(--color-primary);
    color: white;
    border-radius: 50%;
    font-size: 0.85rem;
    font-weight: var(--font-weight-bold);
    margin-right: var(--spacing-md);
  }
  
  .result-title {
    font-size: 1.1rem;
    margin: 0;
    color: var(--color-primary);
    flex: 1;
  }
  
  .result-description {
    color: var(--color-text-light);
    font-size: 0.95rem;
    margin-bottom: var(--spacing-md);
    line-height: 1.5;
  }
  
  .result-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }
  
  .tag {
    background-color: rgba(61, 108, 81, 0.1);
    color: var(--color-secondary);
    padding: 2px 8px;
    border-radius: var(--border-radius-sm);
    font-size: 0.8rem;
    font-weight: var(--font-weight-medium);
  }
  
  .result-notes,
  .result-resources {
    margin-top: var(--spacing-md);
  }
  
  .result-notes h4,
  .result-resources h4 {
    font-size: 1rem;
    margin-bottom: var(--spacing-xs);
    color: var(--color-text);
  }

  .no-results {
    margin: var(--spacing-xl) 0;
    max-width: 700px;
    margin: var(--spacing-xl) auto;
  }

  @media (max-width: 992px) {
    .main-content-section {
      flex-direction: column;
    }
    
    .search-container,
    .graph-container {
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    .search-input-wrapper {
      flex-direction: column;
    }
    
    .search-button {
      width: 100%;
      justify-content: center;
    }
  }
  
  /* Dataset details panel styles */
  .dataset-details-panel {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-lg);
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }
  
  .panel-title {
    color: var(--color-primary);
    font-size: 1.2rem;
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--spacing-sm);
  }
  
  .dataset-notes h4,
  .dataset-resources h4 {
    font-size: 1rem;
    margin-bottom: var(--spacing-sm);
    color: var(--color-text);
  }
  
  .dataset-notes p {
    color: var(--color-text-light);
    font-size: 0.95rem;
    line-height: 1.5;
    margin-bottom: var(--spacing-md);
  }
  
  .resources-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .resources-list li {
    margin-bottom: var(--spacing-xs);
  }
  
  .resources-list a {
    display: flex;
    align-items: center;
    color: var(--color-primary);
    text-decoration: none;
    font-size: 0.9rem;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  .resources-list a:hover {
    color: var(--color-primary-light);
  }
  
  .external-link-icon {
    margin-left: var(--spacing-sm);
    opacity: 0.6;
  }
  
  /* Debug panel styles */
  .debug-panel {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    background-color: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: var(--border-radius-md);
  }
  
  .debug-panel h3 {
    margin-top: 0;
    font-size: 1rem;
    color: #495057;
  }
  
  .debug-panel ul {
    margin: 0;
    padding-left: var(--spacing-lg);
  }
  
  .debug-panel li {
    margin-bottom: var(--spacing-xs);
  }
  
  .debug-panel .error {
    color: #dc3545;
  }
</style>
