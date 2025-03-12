<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import Graph from '../components/Graph.svelte';
  import { searchHistory } from '../stores/searchHistory';
  import { supabase } from '../supabaseClient';

  let graphData = writable({ nodes: [], links: [] });
  let query = '';
  let searchResults = writable([]);
  let selectedDataset = writable(null);
  let expandedResults = writable({});
  
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
  
  onMount(async () => {
    console.log("Component mounted");
    debugInfo = {
      apiCall: "Component initialized",
      searchResult: "Not started",
      graphDataUpdate: "Not started",
      error: null
    };
    query = "agriculture";
    await search();
    graphData.set({ nodes: [], links: [] });
  });

  async function searchVectors(queryText) {
    try {
      // PGVector similarity search using cosine distance
      const embedding = await generateEmbedding(queryText);
      
      const { data, error } = await supabase
        .from('docs')
        .select('id, created_at, metadata, package_name')
        .order('notes_embedding <=> cube(array[' + embedding.join(',') + '])')
        .limit(5);

      if (error) throw error;
      return data.map((item, index) => ({
        id: item.id,
        payload: {
          title: item.metadata.title,
          description: item.content,
          notes: item.metadata.notes,
          resources: item.metadata.resources || [],
          tags: item.metadata.tags || []
        },
        score: 1 - (index * 0.2) // Temporary scoring until we get real distances
      }));
    } catch (error) {
      console.error("Vector search error:", error);
      throw error;
    }
  };
  
  onMount(async () => {
    console.log("Component mounted");
    debugInfo = {
      apiCall: "Component initialized",
      searchResult: "Not started",
      graphDataUpdate: "Not started",
      error: null
    };
    query = "agriculture";
    await search();
    graphData.set({ nodes: [], links: [] });
  });

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
      }));

      const links = nodes.map(node => ({
        source: 'query',
        target: node.id,
        label: `Similarity match`
      }));

      const newGraphData = { 
        nodes: [{ id: 'query', label: 'Query', type: 'query', description: query }, ...nodes], 
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
    query = node.description;
    await search();
  };
</script>

<!-- Rest of the template remains the same -->
<div class="landing-page">
  <!-- Existing template content unchanged -->
</div>

<style>
  /* Existing styles unchanged */
</style>
