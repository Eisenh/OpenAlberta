<script>
  import { onMount } from 'svelte';
  
  // State to track if sections are expanded/collapsed
  let sectionsExpanded = {
    introduction: true,
    searchFunctionality: true,
    vectorSearch: true,
    graphVisualization: true,
    technicalDetails: true,
    tips: true
  };
  
  // Toggle section expansion with keyboard and click support
  function toggleSection(section) {
    sectionsExpanded[section] = !sectionsExpanded[section];
  }
  
  // Handle keyboard events for accessibility
  function handleKeyDown(event, section) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSection(section);
    }
  }
  
  // Format date for the footer
  const currentYear = new Date().getFullYear();
</script>

<div class="help-container">
  <header>
    <h1>Help & Information</h1>
    <p class="last-updated">Last Updated: March 22, 2025</p>
  </header>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('introduction')}
      on:keydown={(e) => handleKeyDown(e, 'introduction')}
      aria-expanded={sectionsExpanded.introduction}
      aria-controls="introduction-content"
      type="button"
    >
      <h2>1. Introduction</h2>
      <span class="toggle-icon">{sectionsExpanded.introduction ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.introduction}
      <div class="section-content" id="introduction-content">
        <p>
          Welcome to the Alberta Open Data search tool. This application uses advanced semantic search 
          technology to help you discover and explore open datasets provided by the Government of Alberta.
        </p>
        <p>
          Unlike traditional keyword search systems, the platform uses AI-powered vector embeddings 
          to understand the meaning behind your queries, returning results based on semantic relevance 
          rather than just keyword matching.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('searchFunctionality')}
      on:keydown={(e) => handleKeyDown(e, 'searchFunctionality')}
      aria-expanded={sectionsExpanded.searchFunctionality}
      aria-controls="searchFunctionality-content"
      type="button"
    >
      <h2>2. How to Search</h2>
      <span class="toggle-icon">{sectionsExpanded.searchFunctionality ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.searchFunctionality}
      <div class="section-content" id="searchFunctionality-content">
        <h3>Basic Search</h3>
        <p>
          To search for datasets, enter your query in the search box at the top of the page and press Enter 
          or click the search icon. Results will be displayed in both graph and list formats (below the graph).
        </p>
        
        <h3>Understanding Results</h3>
        <p>
          Results are ranked by relevance to your query, with the most semantically similar datasets appearing first. 
          Each result includes:
        </p>
        <ul>
          <li><strong>Title</strong> - The name of the dataset</li>
          <li><strong>Description</strong> - A summary of what the dataset contains</li>
          <li><strong>Resources</strong> - Links to download the data in various formats</li>
          <li><strong>Tags</strong> - Categories or keywords associated with the dataset</li>
        </ul>
        
        <h3>Exploring the Graph</h3>
        <p>
          The interactive graph visualization shows relationships between your query and the results:
        </p>
        <ul>
          <li><strong>Click on a node</strong> to view details about that dataset</li>
          <li><strong>Double-click on a node</strong> to use that dataset's description as a new search query</li>
          <li>Use the <strong>Similarity Threshold</strong> slider to filter results by relevance</li>
          <li>Switch between different <strong>View Modes</strong> to see different visualizations of the data</li>
        </ul>
        
        <h3>Search History</h3>
        <p>
          Your recent searches are saved locally and can be accessed by clicking in the search box. 
          Click on any previous search to run it again.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('vectorSearch')}
      on:keydown={(e) => handleKeyDown(e, 'vectorSearch')}
      aria-expanded={sectionsExpanded.vectorSearch}
      aria-controls="vectorSearch-content"
      type="button"
    >
      <h2>3. Semantic Vector Search</h2>
      <span class="toggle-icon">{sectionsExpanded.vectorSearch ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.vectorSearch}
      <div class="section-content" id="vectorSearch-content">
        <p>
          The application uses a technique called vector search to find semantically relevant documents.
          Here's how it works:
        </p>
        
        <h3>Vector Embeddings</h3>
        <p>
          When you enter a search query, the app:
        </p>
        <ol>
          <li>Converts your text query into a high-dimensional vector (embedding) using a neural language model</li>
          <li>Compares this vector to the pre-computed embeddings of all datasets in the database</li>
          <li>Returns datasets with embeddings most similar to your query vector</li>
        </ol>
        
        <h3>Benefits of Vector Search</h3>
        <ul>
          <li><strong>Semantic Understanding</strong> - Finds results based on meaning, not just keywords</li>
          <li><strong>Natural Language Queries</strong> - Ask questions in plain language</li>
          <li><strong>Contextual Relevance</strong> - Returns results that match the context of your query</li>
          <li><strong>Discovery</strong> - Surfaces relevant datasets you might not find through keyword search</li>
        </ul>
        
        <h3>Similarity Threshold</h3>
        <p>
          The similarity threshold controls how closely a dataset must match your query to be included in the results. 
          A higher threshold will show fewer, more relevant results, while a lower threshold will show more results 
          with potentially lower relevance.
        </p>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('graphVisualization')}
      on:keydown={(e) => handleKeyDown(e, 'graphVisualization')}
      aria-expanded={sectionsExpanded.graphVisualization}
      aria-controls="graphVisualization-content"
      type="button"
    >
      <h2>4. Graph Visualization Modes</h2>
      <span class="toggle-icon">{sectionsExpanded.graphVisualization ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.graphVisualization}
      <div class="section-content" id="graphVisualization-content">
        <p>
          The application offers three different ways to visualize search results:
        </p>
        
        <h3>Compact View</h3>
        <p>
          The compact view shows your query and the top 8 most relevant results. This is the default view 
          and is useful for quickly identifying the most relevant datasets.
        </p>
        
        <h3>Expanded View</h3>
        <p>
          The expanded view shows all results that meet the current similarity threshold. Each result 
          is connected directly to your query node, with the thickness of the connection representing 
          the strength of the match.
        </p>
        
        <h3>Similarity Graph</h3>
        <p>
          The similarity graph shows connections not only between your query and results, but also between 
          the result datasets themselves. This helps identify clusters of related datasets and reveals the 
          underlying structure of the data ecosystem.
        </p>
        <p>
          In this view:
        </p>
        <ul>
          <li>Connections between nodes represent semantic similarity</li>
          <li>Stronger connections (thicker lines) indicate higher similarity</li>
          <li>Clusters often represent groups of datasets on related topics</li>
        </ul>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('technicalDetails')}
      on:keydown={(e) => handleKeyDown(e, 'technicalDetails')}
      aria-expanded={sectionsExpanded.technicalDetails}
      aria-controls="technicalDetails-content"
      type="button"
    >
      <h2>5. Technical Implementation</h2>
      <span class="toggle-icon">{sectionsExpanded.technicalDetails ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.technicalDetails}
      <div class="section-content" id="technicalDetails-content">
        <p>
          For those interested in the technical aspects, the application is built with:
        </p>
        
        <h3>Front-end Technologies</h3>
        <ul>
          <li><strong>Svelte</strong> - A reactive JavaScript framework for building user interfaces</li>
          <li><strong>Cytoscape.js</strong> - For interactive graph visualization</li>
        </ul>
        <p>
          One word of warning: this is a side project, and exists mostly as an attempt to explore various 
          ways of visualizing data. As a result, it does not have a consistent way of handling the data between
          views, as each view was developed separately, using different logic as to how the data is handled,
          filtered and dispayed. The graph connectins are computed in-browser using tensorflow.js and are recalculated
          after every query or change in threshold. The results are curretly limited to 50 nodes to avoid performance issues.
        </p>
        <p>
          If I had to do this again, I'd likely use a graphology/sigma.js stack instead of cytoscape.
        </p>
        
        <h3>Back-end Technologies</h3>
        <ul>
          <li><strong>Supabase</strong> - A PostgreSQL database with vector search capabilities</li>
          <li><strong>pgvector</strong> - An extension that enables PostgreSQL to store and query vector embeddings</li>
        </ul>
        
        <h3>Emedding Model</h3>
        <ul>
          <li><strong>Xenova Transformers</strong> - Browser-compatible version of Hugging Face Transformers</li>
          <li><strong>all-MiniLM-L6-v2</strong> - A compact language model for generating text embeddings</li>
          <li><strong>ONNX Runtime</strong> - For efficient model inference in the browser</li>
        </ul>
        
        <h3>Data Processing</h3>
        <p>
          All datasets from open.alberta.ca are processed as follows:
        </p>
        <ol>
          <li>Dataset metadata is extracted and normalized</li>
          <li>Text descriptions are converted to vector embeddings using all-MiniLM-L6-v2</li>
          <li>Embeddings are stored in the Supabase database using pgvector</li>
          <li>Vector similarity search is performed using cosine similarity</li>
        </ol>
      </div>
    {/if}
  </section>
  
  <section>
    <button 
      class="section-header" 
      on:click={() => toggleSection('tips')}
      on:keydown={(e) => handleKeyDown(e, 'tips')}
      aria-expanded={sectionsExpanded.tips}
      aria-controls="tips-content"
      type="button"
    >
      <h2>6. Tips for Effective Searching</h2>
      <span class="toggle-icon">{sectionsExpanded.tips ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.tips}
      <div class="section-content" id="tips-content">
        <ul>
          <li><strong>Use natural language</strong> - Instead of just keywords, try asking a question or describing the data you need</li>
          <li><strong>Be specific</strong> - More detailed queries often yield better results</li>
          <li><strong>Explore related datasets</strong> - Double-click on interesting results to pivot your search</li>
          <li><strong>Adjust the similarity threshold</strong> - Lower it to see more diverse results, raise it for higher precision</li>
          <li><strong>Try different view modes</strong> - Each visualization can reveal different relationships in the data</li>
          <li><strong>Check your search history</strong> - Review and refine your previous searches</li>
        </ul>
      </div>
    {/if}
  </section>
  
  <footer>
    <p>© {currentYear} Eisenhawer Tech. All rights reserved.</p>
    <p>If you have any questions or need assistance, please contact me through eisenhawer.ca or raise an issue on github.</p>
  </footer>
</div>

<style>
  .help-container {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
    color: var(--color-text);
  }
  
  header {
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  h2 {
    font-size: 1.25rem;
    margin: 0;
  }
  
  h3 {
    font-size: 1.1rem;
    margin: 1.2rem 0 0.5rem;
    color: var(--color-primary);
  }
  
  .last-updated {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }
  
  section {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.5rem;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    text-align: left;
    padding: 0.75rem 0;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    color: var(--color-text);
  }
  
  .section-header:hover {
    background-color: var(--color-background-hover);
  }
  
  .section-header:focus {
    outline: 2px solid var(--color-primary);
    border-radius: 4px;
  }
  
  .toggle-icon {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-text-secondary);
  }
  
  .section-content {
    padding: 0.5rem 0 1rem;
  }
  
  ul, ol {
    padding-left: 1.5rem;
    margin-top: 0.5rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  footer {
    margin-top: 2rem;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    text-align: center;
  }
</style>
