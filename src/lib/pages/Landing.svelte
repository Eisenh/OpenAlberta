<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { writable, get } from 'svelte/store';
  import Graph from '../components/Graph.svelte';
  import GraphExpanded from '../components/GraphExpanded.svelte';
  import GraphSimilarity from '../components/GraphSimilarity.svelte';
  import { searchHistory } from '../stores/searchHistory';
  import { supabase } from '../supabaseClient';
  import { pipeline, env } from "@xenova/transformers";
  import { 
    calculateSimilarityMatrix, 
    filterGraphByThreshold 
  } from '../utils/similarity';
  import { displaySimilarityThreshold } from '../stores/graphSettings';
  //import {jLouvain } from '../utils/louvain';
  
  //console.log("Local Model Path:", import.meta.env.BASE_URL + "models/");
  env.localModelPath = import.meta.env.DEV  ? "/public/model/" :"/model/"; //import.meta.env.BASE_URL + "models/"; //"../public/models/";
  
  //import UsageExample from './usage-example.svelte';
  // Define the required model path
  //const modelPath = "Xenova/all-MiniLM-L6-v2";
  
  //let session = null;
  // let graphData = writable({ nodes: [], links: [] });  // TODO delete
let query = '';
let queryVector = writable([]);
let searchResults = writable([]);  // ll search results
let selectedDataset = writable(null);
let expandedResults = writable({});  // accordion listing of results
let isModelLoading = writable(false);
let modelLoadingProgress = writable(0);
let modelLoadError = writable(null);
let displayMode = writable("compact");  // compact, expanded, similarity graph
let searchInput = '';
let showHistoryDropdown = false;
let lastAccordionClick = 0;
const doubleClickDelay = 300; // milliseconds (same as in graph components)
  
  // Search and display thresholds
  let similarityThreshold = 0.3; // Search threshold
  let minDisplayThreshold = 0.3; // Minimum display threshold (same as search threshold initially)
  let resultCount = 50; // Maximum number of results to fetch
  
  // Maximum number of nodes to calculate similarities for
  const MAX_SIMILARITY_NODES = 50;

  // New stores for different graph views
  let compactGraphData = writable({ nodes: [], links: [] });  // contains 9 nodes
  let expandedGraphData = writable({ nodes: [], links: [] }); // contains all nodes, and links to query node
  let similarityGraphData = writable({ nodes: [], links: []}); // all nodes and links between all nodes
  
  // Store for the full similarity matrix between all nodes
  let similarityMatrixData = writable({ matrix: [], nodeIds: [] });
/*
  //displayMode.set("compact");
  // Reactive statement to watch displayMode
  $: if (displayMode === "compact") {
    handleNodeClick(selectedDataset);
  }
    */
  // Store the model instance for reuse - use a writable store to ensure reactivity
  let modelInstance = writable(null);
  // Flag to track if we've already attempted to load the model
  let modelLoadAttempted = false;
  // Flag to track if model loading is in progress
  let modelLoadInProgress = false;


  // Add reactive statement to update graph when display threshold changes, but don't recalculate similarities
  $: if ($displaySimilarityThreshold !== undefined && $searchResults && $searchResults.length > 0) {
    console.log("Display similarity threshold changed to", $displaySimilarityThreshold, "updating graph data");
    if ($searchResults.length > 0) {
      // Using store value for display of edges and nodes with graph componets
      updateFilteredGraphData();  //triggers updates
      //updateSimilarityGraphData();
    }
  }
 
/*  not needed if data is all already calculated
  $: if ($displayMode !== undefined && $searchResults && $searchResults.length > 0) {
    console.log("Display mode changed to", $displayMode, "updating graph data");
    if ($searchResults.length > 0) {
      updateFilteredGraphData($searchResults, $displayMode);
    }
  }
  */

  /**
   * Calculate full similarity matrix for all result nodes
   * @param {Object} queryNode - The query node
   * @param {Array} resultNodes - Array of result nodes
   */
  function calculateFullSimilarityMatrix(resultNodes) {
    if (!resultNodes || resultNodes.length === 0) {
      similarityMatrixData.set({ matrix: [], nodeIds: [] });
      return;
    }
    
    console.log("Calculating similarity matrix for", resultNodes.length, "nodes");
    
    try {
      // Calculate matrix - limit to MAX_SIMILARITY_NODES for performance
      const limitedNodes = resultNodes.slice(0, MAX_SIMILARITY_NODES);
      
      // Extract embeddings from nodes for calculation using standardized location
      const nodesWithEmbeddings = limitedNodes.map(node => {
        // Get embedding from node.embedding (our standardized location)
        const embedding = node?.embedding || [];
        
        return {
          id: node.id,
          // Use embedding as the key expected by similarity.js
          embedding: embedding
        };
      }).filter(node => Array.isArray(node.embedding) && node.embedding.length > 0);
      
      console.log(`Found ${nodesWithEmbeddings.length} nodes with valid embeddings out of ${limitedNodes.length} nodes`);
      
      // Calculate the similarity matrix
      const matrixData = calculateSimilarityMatrix(nodesWithEmbeddings, MAX_SIMILARITY_NODES);
      
      // Store the matrix data
      similarityMatrixData.set(matrixData);
      
      console.log("Similarity matrix calculated successfully:", matrixData);
    } catch (error) {
      console.error("Error calculating similarity matrix:", error);
      similarityMatrixData.set({ matrix: [], nodeIds: [] });
    }
  }
  
  function updateFilteredGraphData() {
 
  /**
   * Update graph data for compact and expanded view modes, after search or change in display parameters. Each graph
   * componet subscribes to its data, so whichever one is active automatically refreshes.
   * Beginning with 
   * 1. the expandedGraphData, which is all data after filtering of nodes, edges
   * 2. then slicing that to create compactGraphData (first 9 nodes)
   * 3. then updating similarityGraphData with the expandedGraphData plus to show the filtered set.
   * 
   * References $searchResults, which has the query node as the first node.
   */
    const allNodes = get(searchResults);
    // The first node is the query node
    
    const queryNode = allNodes[0];
    // Get result nodes (everything after the first node)
    //const resultNodes = allNodes.slice(1);
        
    const currentThreshold = $displaySimilarityThreshold;
    
    // Filter nodes that meet the display threshold
    const filteredNodes = allNodes.filter(node => 
      node.similarity >= currentThreshold
    );
    
    if (filteredNodes.length === 0) {
      console.warn("No nodes meet the display threshold:", currentThreshold);
      compactGraphData.set({ nodes: [queryNode], links: [] });
      expandedGraphData.set({ nodes: [queryNode], links: [] });
      similarityGraphData.set({ nodes: [queryNode], links: [] });
            
      return;
    }
      updateExpandedGraphData(filteredNodes);  //puts filtered data into expandedGraphData
      updateCompactGraphData(filteredNodes);
      calculateFullSimilarityMatrix(filteredNodes);
      updateSimilarityGraphData(filteredNodes);  // this should display the nodes without all the node-node links.
  }
  
  function initializeSimilarityGraphData() {
    // already includes nodes and queryNode-node edges, and should be filtered already
    const graphData = $expandedGraphData;  
    const links = graphData.links;
    const nodes = graphData.nodes;
    // Get the current threshold
    const currentThreshold = get(displaySimilarityThreshold);
    // Add links between result nodes based on similarity matrix
    // similarityMatrixData is calculated once, after updating expandedGraphData
    const { matrix, nodeIds } = get(similarityMatrixData);  
    
    if (matrix.length > 0 && nodeIds.length > 0) {
      // Use the similarity matrix to create links between result nodes
      for (let i = 0; i < nodeIds.length; i++) {
        console.log("Si row ",i)
        for (let j = i + 1; j < nodeIds.length; j++) {
          const similarity = matrix[i][j];
          if (similarity >= currentThreshold) {
            links.push({
              source: nodeIds[i],
              target: nodeIds[j],
              weight: similarity
            });
          }
        }
      }
    }
    
    // Update the similarity graph data store
    similarityGraphData.set({
      nodes: nodes,
      links: links
    });
        
    console.log("Updated similarityGraphData with", nodes.length, "nodes and", links.length, "links");
  }

  function updateSimilarityGraphData(filtered) {
    // already includes nodes and queryNode-node edges, and should be filtered already
    
    const simGraphData = get(expandedGraphData);  
    const nodes = simGraphData.nodes;
    const links = simGraphData.links;
    // Get the current threshold
    const currentThreshold = get(displaySimilarityThreshold);
    // Add links between result nodes based on similarity matrix
    // similarityMatrixData is calculated once, after updating expandedGraphData
    const { matrix, nodeIds } = get(similarityMatrixData);  
    
    if (matrix.length > 0 && nodeIds.length > 0) {
      // Use the similarity matrix to create links between result nodes
      for (let i = 0; i < nodeIds.length; i++) {
        //console.log("Si row ",i)
        for (let j = i + 1; j < nodeIds.length; j++) {
          const similarity = matrix[i][j];
          if (similarity >= currentThreshold) {
            links.push({
              source: nodeIds[i],
              target: nodeIds[j],
              weight: similarity
            });
          }
        }
      }
    }
    
    // Update the similarity graph data store
    similarityGraphData.set({
      nodes: simGraphData.nodes,
      links: links
    });
        
    console.log("Updated similarityGraphData with", simGraphData.nodes.length, "nodes and", links.length, "links");
  }

// Initialize embedder lazily to avoid top-level await issues
  let embedder = null;
  async function getEmbedder() {
    if (!embedder) {
      try {
        console.log("Initializing embedder...");
        embedder = await pipeline("feature-extraction", 'Xenova/all-MiniLM-L6-v2'  );
        //const testresult = await embedder("test string");
        //console.log("Embedder initialized", JSON.stringify(testresult));
        
    } catch (error) {
      console.error("Error initializing embedder:", error);

    }
    }
    return embedder;
  }
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
 
  onMount(async () => {
    console.log("Landing Component mounted");
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
        let model = await getEmbedder();//tryLoadModel();
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
    
    // Load search history
    await searchHistory.loadHistory();
  });
  
  function formatDate(timestamp) {
    if (timestamp){
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } else return " "
  }
  const generateEmbedding = async (text) => {
    // If we don't have a model instance and we've already attempted to load it,
    // don't try again - just throw an error
    if (!$modelInstance && modelLoadAttempted) {
      throw new Error("Model not available");
    }
    
    try {
      // Use the existing model instance if available
      if ($modelInstance) {
        //console.log("Using cached model instance");
        const  output = await $modelInstance(text, { pooling: "mean", normalize: true });
        // Extract the embedding output
        const embedding = Array.from(output.data)
        return embedding;  //whole embedding incl .data, .shape, .dtype
      }
      
      // If we get here, we need to load the model
      if (!modelLoadInProgress && !modelLoadAttempted) {
        modelLoadAttempted = true;
        modelLoadInProgress = true;
        
        try {
          console.log("Loading model for embedding generation");
          const embedder = await getEmbedder();// tryLoadModel();
          modelLoadInProgress = false;
          
          if (embedder) {
            modelInstance.set(embedder);
            const output = await embedder(text, { pooling: "mean", normalize: true });
            // Extract the embedding output
            const embedding = Array.from(output.data)
            console.log("Embedding generated successfully line 135", embedding);
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

  /**
   * Update the compact view graph data
   * @param {Array} filteredNodes - Array of nodes with query node at index 0
   */
  function updateCompactGraphData(filteredNodes) {
    if (!filteredNodes || filteredNodes.length === 0) {
      compactGraphData.set({ nodes: [], links: [] });
      return;
    }
    
    // Extract query node (first element)
    const queryNode = filteredNodes[0];
    
    // Get result nodes (everything after first element)
    const resultNodes = filteredNodes.slice(1);
    
    if (resultNodes.length === 0) {
      compactGraphData.set({ nodes: [queryNode], links: [] });
      return;
    }
    
    // Sort by similarity and limit to 8 results  TODO should already be sorted
    const sortedResults = [...resultNodes].sort((a, b) => b.similarity - a.similarity);
    const limitedResults = sortedResults.slice(0, 8);
    
    // Create graph links from query node to results
    const graphLinks = limitedResults.map(result => ({
      source: queryNode.id,
      target: result.id,
      weight: result.similarity ? Math.max(1, result.similarity * 10) : 5
    }));
    console.log("Graphlinks in update compact: ", graphLinks)
    // Final nodes are query node plus limited results
    compactGraphData.set({
      nodes: [queryNode, ...limitedResults],
      links: graphLinks
    });
  }

  /**
   * Update the expanded view graph data
   * @param {Array} filteredNodes - Array of nodes with query node at index 0
   */
  function updateExpandedGraphData(filteredNodes) {
    if (!filteredNodes || filteredNodes.length === 0) {
      expandedGraphData.set({ nodes: [], links: [] });
      return;
    }
    
    // Extract query node (first element)
    const queryNode = filteredNodes[0];
    
    // Get result nodes (everything after first element)
    const resultNodes = filteredNodes.slice(1);
    
    if (resultNodes.length === 0) {
      expandedGraphData.set({ nodes: [queryNode], links: [] });
      return;
    }
    
    // Create graph links from query node to results
    const graphLinks = resultNodes.map(result => ({
      source: queryNode.id,
      target: result.id,
      weight: result.similarity// ? Math.max(1, result.similarity ) : 0.5
    }));
    
    // Use all filtered nodes
    expandedGraphData.set({
      nodes: filteredNodes,
      links: graphLinks
    });
    console.log("ExpandedGraphData: ", get(expandedGraphData))
  }

// First, let's modify the searchVectors function to return consistent data structure
// searchVectors needs to return the whole data set and add a new node if the search was from text rather than a node click
  async function searchVectors(queryText, rc = resultCount) {
    try {
      if ($modelInstance) {
        console.log("Using vector search with loaded model");
        //let queryVector = [];
        try {
          queryVector = await generateEmbedding(queryText);
          
          console.log("In searchVectors, Query vector type:", typeof queryVector);
          console.log("Query vector is array?", Array.isArray(queryVector));
          if (Array.isArray(queryVector) && queryVector.length > 0) {
            console.log("First few values of query vector:", queryVector.slice(0, 5));
          }
          
          const { error: matchError, data: response } = await supabase.rpc(
            'match_vectors',
            {
              query_embedding: queryVector,
              match_threshold: similarityThreshold,
              match_count: rc, 
            }
          );

          if (matchError) {
            console.error('Error searching documents:', matchError);
            return { results: [] };
          }

          if (!response || response.length === 0) {
            console.log("No vector search results found");
            return { results: [] };
          }

          // Check the type of first embedding to diagnose the issue
          if (response.length > 0) {
            console.log("First embedding type:", typeof response[0].notes_embedding);
            console.log("Is array?", Array.isArray(response[0].notes_embedding));
            console.log("First few values:", Array.isArray(response[0].notes_embedding) ? 
              response[0].notes_embedding.slice(0, 5) : 
              "Not an array");
              
            // If it's a string, try to parse it
            if (typeof response[0].notes_embedding === 'string') {
              console.log("Embedding appears to be stored as a string, attempting to parse");
            }
          }
          
          const results = response.map((item) => {
            // Process embedding - ensure it's an array
            let embedding = item.notes_embedding;
            
            // If it's a string, try to parse it as JSON
            if (typeof embedding === 'string') {
              try {
                embedding = JSON.parse(embedding);
              } catch (e) {
                console.error("Failed to parse embedding string:", e, " Splitting by ,");
                // If parsing fails, split by commas as a fallback
                embedding = embedding.split(',').map(Number);
              }
            }
            
            return {
              id: item.id,
              label: item.metadata.title || "Untitled",  //used as label for nodes
              description: item.metadata.notes || item.content || "No description available",
              resources: item.metadata.resources || [],
              tags: item.metadata.tags || [],
              embedding: embedding,  // Store embeddings as array
              similarity: item.similarity
            };
          });
          
          console.log(`Processed ${results.length} search results with embeddings`);
          console.log("First result embedding type:", typeof results[0]?.embedding);
          console.log("First embedding is array?", Array.isArray(results[0]?.embedding));
          
          return { results };

        } catch (error) {
          console.error("Error in vector search:", error);
          
          return { results };
        }
      } else {
        // Fallback to text search with same return structure
        const { data, error } = await supabase
          .from('docs')
          .select('id, metadata')
          .or(`metadata->>title.ilike.%${queryText}%,metadata->>description.ilike.%${queryText}%,metadata->>notes.ilike.%${queryText}%`)
          .limit(resultCount);

        if (error) throw error;

        const results = (data || []).map((item, index) => ({
          id: item.id,
          label: item.metadata.title || "Untitled",
          description: item.metadata.notes || "No description available",
          resources: item.metadata.resources || [],
          tags: item.metadata.tags || [],
            // Use empty array as embedding since no actual embeddings available in text search
          embedding: [],
          similarity: 1 - (index * 0.1)
        }));
        
        return { results, queryText };
      }
    } catch (error) {
      console.error("Search error:", error);
      return { results, queryText };
    }
  }

// Handle node click - update to use standardized data structure
async function handleNodeClick(node) {
  if (node.id === 'query') return;  // don't do anything if the clicked node is the query node.

  // Store the clicked node in a separate store for single-click details display
  selectedDataset.set({
    id: node.id,
    label: node.label || 'Untitled',
    description: node.description || 'No description available',
    resources: node.resources || [],
    tags: node.tags || [],
    // Use standardized embedding location
    embedding: node.embedding || []
  });
}

// Double-click handler to perform a new search
const handleDoubleClick = async (node) => {
  if (node.id === 'query') return;  // don't do anything if the clicked node is the query node.

  if (!node?.description) {
    console.error("Cannot search without node description");
    return;
  }
  
  console.log("Double-click search with:", node.description);
  
  // Clear all graph data if no results
  compactGraphData.set({ nodes: [], links: [] });
  expandedGraphData.set({ nodes: [], links: [] });
  similarityGraphData.set({ nodes: [], links: [] });
  
  try {
    // Perform the search
    const { results } = await searchVectors(node.description, resultCount);
    
    console.log(`Found ${results?.length || 0} results for node double-click`, results);
    
    results.sort((a, b) => b.similarity - a.similarity);
    console.log("Sorted results:", results);
    
    // Reset threshold to match current search
    minDisplayThreshold = similarityThreshold;
    displaySimilarityThreshold.set(similarityThreshold);
    
    if (!results || results.length === 0) {
      // Clear all graph data if no results
      compactGraphData.set({ nodes: [queryNode], links: [] });
      expandedGraphData.set({ nodes: [queryNode], links: [] });
      similarityGraphData.set({ nodes: [queryNode], links: [] });
      return;
    }
    results[0].id = 'query';
    searchResults.set(results);  
    // Update graph data based on current view mode
    
    updateFilteredGraphData();
    // Calculate the similarity matrix for all nodes. This will update $similarityGraphData, 
    // adding links to the graph display
    calculateFullSimilarityMatrix(results);
    
    updateSimilarityGraphData()
    
    console.log("Double-click search completed and updateFilteredGraphData called", results, get(searchResults));
  } catch (error) {
    console.error("Error in handle double click:", error);
  }
}
async function clearGraphData() {
  // Clear all graph data if no results
  compactGraphData.set({ nodes: [], links: [] });
  expandedGraphData.set({ nodes: [], links: [] });
  similarityGraphData.set({ nodes: [], links: [] });
  
}
// Function to search using result's embedding vector
async function resultSearch(result) {
  if (!result?.embedding || result.embedding.length === 0) {
    console.error("Cannot search without result embedding");
    return;
  }
  
  console.log("Result search with embedding vector");
  clearGraphData();

  try {
    // Use the embedding directly for search
    const { error: matchError, data: response } = await supabase.rpc(
      'match_vectors',
      {
        query_embedding: result.embedding,
        match_threshold: similarityThreshold,
        match_count: resultCount, 
      }
    );

    if (matchError) {
      console.error('Error searching documents:', matchError);
      return;
    }

    if (!response || response.length === 0) {
      console.log("No vector search results found");
      return;
    }
    
    // Process results similar to searchVectors function
    const results = response.map((item) => {
      // Process embedding - ensure it's an array
      let embedding = item.notes_embedding;
      
      // If it's a string, try to parse it as JSON
      if (typeof embedding === 'string') {
        try {
          embedding = JSON.parse(embedding);
        } catch (e) {
          console.error("Failed to parse embedding string:", e, " Splitting by ,");
          // If parsing fails, split by commas as a fallback
          embedding = embedding.split(',').map(Number);
        }
      }
      
      return {
        id: item.id,
        label: item.metadata.title || "Untitled",
        description: item.metadata.notes || item.content || "No description available",
        resources: item.metadata.resources || [],
        tags: item.metadata.tags || [],
        embedding: embedding,
        similarity: item.similarity
      };
    });
    
    console.log(`Processed ${results.length} search results with embeddings`);
    
    // Sort results by similarity
    results.sort((a, b) => b.similarity - a.similarity);
    
    // Reset threshold to match current search
    minDisplayThreshold = similarityThreshold;
    displaySimilarityThreshold.set(similarityThreshold);
    
    if (!results || results.length === 0) {
      return;
    }
    
    results[0].id = 'query';
    searchResults.set(results);  
    // Update graph data based on current view mode
    
    updateFilteredGraphData();
    // Calculate the similarity matrix for all nodes. This will update $similarityGraphData, 
    // adding links to the graph display
    calculateFullSimilarityMatrix(results);
    
    updateSimilarityGraphData()
    
    console.log("Result search completed and updateFilteredGraphData called", results, get(searchResults));
  } catch (error) {
    console.error("Error in result search:", error);
  }
}

// Handle text search
async function handleTextSearch(searchText) {  // only for search from search bar
  // tries to search vectors, or fallback to text search
  console.log("handleTextSearch called");
  if (!searchInput?.trim()) {
    console.log("Empty search input, returning");
    if (searchText) {
      searchInput = searchText;
    } else return;
  }
  const displayTitle = ' Search text : "' + searchInput + '"';
  // Store the clicked node in a separate store for single-click details display
  selectedDataset.set({
    id: 'query',
    label: displayTitle,
    description: 'Click on a node to display more information, including links to resources.',
    resources:  [],
    tags:  [],
  });
  // Clear all graph data if no results
  compactGraphData.set({ nodes: [], links: [] });
  expandedGraphData.set({ nodes: [], links: [] });
  similarityGraphData.set({ nodes: [], links: [] });

  try {
    console.log("Calling searchVectors with:", searchInput);
  
    const { results } = await searchVectors(searchInput, resultCount);  //reults must be the array of nodes

    console.log("Search raw results:", results);
    // results.sort((a, b) => b.similarity - a.similarity);
    // console.log("Sorted results:", results);

    if (!results || results.length === 0) {
      console.log("No results found");
      searchResults.set([]);
      
      // Clear graph data
      compactGraphData.set({ nodes: [], links: [] });
      expandedGraphData.set({ nodes: [], links: [] });
      similarityGraphData.set({ nodes: [], links: [] });      
      return;
    }
    
    // Record search in history (works for both logged-in and non-logged-in users)
    searchHistory.addSearch(searchInput, new Date().toISOString());
    
    // Ensure queryVector is an array
    if (queryVector && typeof queryVector === 'string') {
      try {
        queryVector = JSON.parse(queryVector);
      } catch (e) {
        console.error("Failed to parse query vector string:", e);
        queryVector = queryVector.split(',').map(Number);
      }
    }
    
    //console.log("Query vector type:", typeof queryVector);
    //console.log("Query vector is array?", Array.isArray(queryVector));
    
    // Construct query node with embedding in the standardized location
    const queryNode = {
      id: 'query',
      label: searchInput.length > 50 ? `${searchInput.slice(0, 47)}...` : searchInput,
      description: searchInput,
      embedding: Array.isArray(queryVector) ? queryVector : [], // Ensure vector is an array
      similarity: 1.0, // Query node has perfect similarity to itself
    };
    
    // Store the results with query node at index 0
    const resultsWithQuery = [queryNode, ...results];
    searchResults.set(resultsWithQuery);
    
    // Update min display threshold to match search threshold
    minDisplayThreshold = similarityThreshold;
    displaySimilarityThreshold.set(similarityThreshold);
    
    // Update graph data based on current view mode
    updateFilteredGraphData(resultsWithQuery);  // updates copact and expanded graph data sets
    
    // Calculate the similarity matrix for all nodes. This will update $similarityGraphData, 
    // adding links to the graph display
    calculateFullSimilarityMatrix(results);
    updateSimilarityGraphData();

  } catch (error) {
    console.error("Error in handleTextSearch:", error);
  }
}

</script>
<div class="landing-page">
  <section class="main-content-section">

      <div class="left-panel">
        <div class="search-container">
          <div class="search-input-wrapper">
            <div class="search-with-history">
              <input
                type="text"
                bind:value={searchInput}
                placeholder="What data are you looking for?"
                class="search-input"
                on:focus={() => showHistoryDropdown = $searchHistory.length > 0}
                on:blur={() => setTimeout(() => showHistoryDropdown = false, 200)}
                on:input={(e) => console.log("Input changed:", e.target.value, "searchInput:", searchInput)}
                on:keydown={(e) => {
                  if (e.key === 'Enter') {
                    console.log("Enter pressed, searchInput:", searchInput);
                    document.querySelector('.search-button').click();
                  }
                }}
              />
              
              {#if showHistoryDropdown && $searchHistory.length > 0}
                <div class="history-dropdown">
                  <div class="dropdown-header">
                    <span>Recent Searches</span>
                    <button class="clear-history-btn" on:click|stopPropagation={(e) => {
                      e.preventDefault();
                      searchHistory.clearHistory();
                    }}>
                      Clear All
                    </button>
                  </div>
                  <ul>
                    {#each $searchHistory.slice(0, 5) as item}
                      <li>
                        <button on:click|stopPropagation={() => {
                          searchInput = item.query;
                          handleTextSearch();
                          showHistoryDropdown = false;
                        }}>
                          <span class="history-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <circle cx="11" cy="11" r="8"></circle>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                          </span>
                          <span class="history-query">{item.query}</span>
                          <span class="history-date">{formatDate(item.created_at)}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
            
            <button on:click={handleTextSearch} aria-label="search" class="search-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
          <div class="graph-controls">
            <label class="control-group">
              <span class="control-label">View Mode:</span>
              <select bind:value={$displayMode} class="mode-select">
                <option value="compact">Compact</option>
                <option value="expanded">Expanded</option>
                <option value="similarity">Similarity Graph</option>
              </select>
            </label>

            <label class="control-group">
              <span class="control-label">Search Threshold:</span>
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
            
            <label class="control-group">
              <span class="control-label">Display Threshold:</span>
              <input
                type="range"
                bind:value={$displaySimilarityThreshold}
                min={minDisplayThreshold}
                max="1.0"
                step="0.05"
                class="threshold-slider"
              />
              <span class="threshold-value">{$displaySimilarityThreshold}</span>
            </label>
          </div>

          <!-- Dataset details panel -->
          {#if $selectedDataset}
            <div class="dataset-details-panel">
              <h3 class="panel-title">{$selectedDataset.label}</h3>

              <!-- Description field -->
              {#if $selectedDataset.description}
                <div class="dataset-notes">
                  <h4>Description</h4>
                  <p>{$selectedDataset.description}</p>
                </div>
              {/if}

              <!-- Resources list -->
              {#if $selectedDataset.resources && $selectedDataset.resources.length > 0}
                <div class="dataset-resources">
                  <h4>Resources</h4>
                  <ul class="resources-list">
                    {#each $selectedDataset.resources as resource}
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
              {#if $selectedDataset.tags && $selectedDataset.tags.length > 0}
                <div class="dataset-tags">
                  <h4>Tags</h4>
                  <ul class="tags-list">
                    {#each $selectedDataset.tags as tag}
                      <li>{tag.name}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      <div class="right-panel">
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
              {#if $displayMode === 'compact'}
                <Graph data={$compactGraphData} onNodeClick={handleNodeClick} onNodeDblClick={handleDoubleClick}/>
              {:else if $displayMode === 'expanded'}
                <GraphExpanded data={$expandedGraphData} onNodeClick={handleNodeClick} onNodeDblClick={handleDoubleClick} />
              {:else if $displayMode === 'similarity'}
                <GraphSimilarity data={$similarityGraphData} onNodeClick={handleNodeClick} onNodeDblClick={handleDoubleClick} />
              {/if}
            {/if}
          {/if}
        </div>


        {#if $searchResults && $searchResults.length > 0}
          <section class="results-section">
            <h2>Search Results</h2>
            <div class="accordion-results">
              {#each $searchResults as result, i}
              {#if result.id !== 'query'}
                <div class="accordion-item">
                  <div
                    class="accordion-header"
                    on:click={(e) => {
                      const currentTime = Date.now();
                      if (currentTime - lastAccordionClick < doubleClickDelay) {
                        // Double-click detected
                        e.stopPropagation(); // Prevent toggling expansion
                        resultSearch(result);
                      } else {
                        // Single click - toggle expansion
                        toggleResultExpansion(result.id);
                      }
                      lastAccordionClick = currentTime;
                    }}
                    on:keydown={(e) => e.key === 'Enter' && toggleResultExpansion(result.id)}
                    tabindex="0"
                    role="button"
                    aria-expanded={$expandedResults[result.id] ? 'true' : 'false'}
                  >
                    <h3 class="result-title">{result?.label || 'Untitled Dataset'}</h3>
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
                    {#if result.description}
                      <div class="result-notes">
                        <h4>Description</h4>
                        <p>{result.description}</p>
                      </div>
                    {/if}
                    {#if result.resources && result.resources.length > 0}
                          <div class="result-resources">
                            <h4>Resources</h4>
                            <ul class="resources-list">
                              {#each result.resources as resource}
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
                    {#if result.tags && result.tags.length > 0}
                      <div class="result-tags">
                        {#each result.tags as tag}
                          <span class="tag">{tag.display_name}</span>
                        {/each}
                      </div>
                    {/if}
                    </div>
                  {/if}
                </div>
                
              {/if}
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
  </section>
</div>

<style>
  /* Replace the global transition disable with specific layout elements */

  .landing-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--color-background);
    color: var(--color-text);
  }

  .main-content-section {
    display: flex;
    flex: 1;
    width: 100%;
    min-height: 100vh;
    height: auto;
    padding: var(--spacing-lg);
    gap: var(--spacing-lg);
  }

  .left-panel {
    width: 30dvw;
    flex-shrink: 0;
    height: auto;
  }

  .right-panel {
     /*flex: 1;
    min-width: 0; */
    width: 65vw; 
    display: flex;
    flex-direction: column;  /* Change to row layout */
    gap: var(--spacing-md);
    height: auto;
  }

  
  .graph-container {
    flex: 0 0 70vh;  /* Don't grow, don't shrink, start at 60vh */
    min-height: 400px;  /* Minimum height fallback */
    position: relative;
    background-color: var(--color-background-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
  }

  /* Add this to prevent any layout transitions */


  /* Remove or modify conflicting media queries */
  @media (min-width: 992px) {
    .main-content-section {
      flex-direction: row;
      transition: none;  /* Remove animation */
    }
  }

  @media (max-width: 992px) {
    .main-content-section {
      flex-direction: column;
      transition: none;  /* Remove animation */
    }
    
    .search-container,
    .graph-container {
      width: 100%;
      transition: none;  /* Remove animation */
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
  
 .results-section {
  flex: 1;  /* Take up remaining space */
  display: flex;
  flex-direction: column;
  height: auto;  /* Remove fixed height */
  min-height: 0;  /* Allow container to shrink if needed */
}

  .result-title {
    font-size: 1.1rem;
    margin: 0;
    color: var(--color-primary);
    flex: 1;
  }
  
  .accordion-results {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .accordion-item {
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
  }

  .accordion-header {
    display: flex;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    position: relative;
    background-color: var(--color-background-alt);
    transition: background-color 0.2s ease;
  }
  .accordion-header:hover {
    background: var(--color-background-hover);
  }

  .accordion-content {
    padding: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    transition: all 0.2s ease;
  }

  .accordion-icon svg {
    transition: transform 0.2s ease;
  }

  .accordion-icon svg.rotated {
    transform: rotate(180deg);
  }

  .search-container {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--spacing-lg);
  }
  
  .search-input-wrapper {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin-bottom: var(--spacing-md);
    height: 42px; /* Set a specific height for the wrapper */
  }
  
  .search-input {
    flex-grow: 1;
    padding: 0 var(--spacing-md);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md) 0 0 var(--border-radius-md);
    font-size: var(--font-size-md);
    color: var(--color-text);
    background-color: var(--color-background-alt);
    height: 100%;
    border-right: none;
  }
  
  .search-button {
    width: 42px; /* Match height for perfect square */
    height: 100%;
    padding: 0;
    background-color: var(--color-primary);
    border: 1px solid var(--color-primary);
    border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
    cursor: pointer;
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-light);
  }
  
  .search-button:hover {
    background-color: var(--color-primary-dark);
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
    margin-bottom: var (--spacing-sm);
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
    margin-bottom: var (--spacing-sm);
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
    border-radius: var (--border-radius-sm);
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

  .search-with-history {
  position: relative;
  flex: 1;
}

.history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--color-background-alt);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--border-radius-md) var(--border-radius-md);
  box-shadow: var(--shadow-md);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9rem;
  color: var(--color-text-light);
}

.clear-history-btn {
  background: none;
  border: none;
  color: var(--color-error);
  font-size: 0.8rem;
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-sm);
}

.clear-history-btn:hover {
  text-decoration: underline;
}

.history-dropdown ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-dropdown li {
  border-bottom: 1px solid var(--color-border);
}

.history-dropdown li:last-child {
  border-bottom: none;
}

.history-dropdown button {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-dropdown button:hover {
  background-color: var(--color-background-hover);
}

.history-icon {
  margin-right: var(--spacing-sm);
  color: var(--color-text-light);
}

.history-query {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: var(--spacing-md);
  font-size: 0.8rem;
  color: var(--color-text-light);
}

.history-date {
  margin-left: var(--spacing-md);
  font-size: 0.8rem;
  color: var(--color-text-light);
}
</style>
