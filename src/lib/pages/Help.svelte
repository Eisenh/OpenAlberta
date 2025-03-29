
<script>
  import { onMount } from 'svelte';
  
  // State to track if sections are expanded/collapsed
  let sectionsExpanded = {
    introduction: true,
    searchFunctionality: false,
    caseStudy: false,
    vectorSearch: false,
    graphVisualization: false,
    technicalDetails: false,
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
    <p class="last-updated">Last Updated: March 25, 2025</p>
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
          Welcome to the Alberta Open Data search tool. This app uses advanced semantic search 
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
        <h3>Basic Text Search</h3>
        <p>
          To search for datasets, enter your query in the search box at the top of the page and press Enter 
          or click the search icon. Results will be displayed in both graph and list formats (below the graph).
        </p>
        
        <p>        
          Each result includes:
        </p>
        <ul>
          <li><strong>Title</strong> - The name of the dataset</li>
          <li><strong>Description</strong> - A summary of what the dataset contains</li>
          <li><strong>Resources</strong> - Links to download the data in various formats</li>
          <li><strong>Tags</strong> - Categories or keywords associated with the dataset</li>
        </ul>
        
        <h3>Tips for efficient searching</h3>
        <ul>
          <li><strong>Use natural language</strong> - Instead of just keywords, try asking a question or describing the data you need</li>
          <li><strong>Be specific</strong> - Detailed queries are likely to yield better results. A long sentence or short paragraph 
            are useful if searching subject areas with many similar datasets</li>
          <li><strong>Explore related datasets</strong> - Double-click on interesting results to pivot your search in that direction.</li>
          <li>Adjust the <strong>Similarity Threshold</strong> slider before repeating a search to limit or expand results by relevance</li>
          <li>Use the <strong>visual clues</strong> such as node sizes and cluster colors to understand the results. Adjust the Display threshold
            to focus on the most significant relationships in the network view</li>
          <li><strong>Check your search history</strong> - Review and refine your previous searches</li>
        </ul>

        <h3>Search History</h3>
        <p>
          Your recent searches are saved locally and can be accessed by clicking in the search box. 
          Click on any previous search to run it again. If you signed in, you can see your entier search history on the profile page.
        </p>
        <h3>Exploring the Graph</h3>
        
         <p>
          The application offers three different ways to visualize search results:
        </p>
        <ul>
          <li>

            <h3>Compact View</h3>
            <p>
              The compact view shows your query and the top 8 most relevant results. This is the default view 
              and is useful for quickly identifying the most relevant datasets.
            </p>
          </li>
          <li>

            <h3>Expanded View</h3>
            <p>
              The expanded view shows all results that meet the current similarity threshold, displayed in an
              expanding spiral based on similarity. The thickness of the connection, the diameter of the node, 
              and the closeness to the center are proportional to the strength of the match.
            </p>
          </li>
          <li>
            <h3>Similarity Network</h3>
            <p>
              The similarity graph shows connections not only between your query and results, but also between 
              the result datasets themselves. This helps identify clusters of related datasets and reveals the 
              underlying structure of the data ecosystem. Clusters are automatically identified and assigned unique colors.
              Similar to the Expanded View, connections thickness and node size represent semantic similarity.
            </p>
          </li>
      </ul>
        
        
        
         <h3>Navigating the Graphs</h3>
        <p>
          The interactive graph visualizations shows relationships between your query and the results:
        </p>
        <ul>
          <li><strong>The query itself </strong> appears in orange near the center</li>
          <li><strong>Hover your mouse pointer</strong> over a node to see the dataset's description in a tooltip, or over a link to see the calculated similarity</li>
          <li><strong>Click on a node</strong> to view details about that dataset in the left panel</li>
          <li><strong>Double-click on a node</strong> to use that dataset as the basis of a new search</li>
          <li>Switch between different <strong>View Modes</strong> using the dropdown control below the search bar to chose the view mode</li>
          
        </ul>

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
          <li><strong>Semantic Understanding</strong> - Finds results based on meaning, not just keywords. In fact, it can find results in multiple languages.</li>
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
      on:click={() => toggleSection('caseStudy')}
      on:keydown={(e) => handleKeyDown(e, 'caseStudy')}
      aria-expanded={sectionsExpanded.caseStudy}
      aria-controls="vectorSearch-content"
      type="button"
    >
      <h2>4. Semantic Vector Search Case Study</h2>
      <span class="toggle-icon">{sectionsExpanded.caseStudy ? '−' : '+'}</span>
    </button>
    {#if sectionsExpanded.caseStudy}
      <div class="section-content" id="caseStudy-content">
        <p>
          To demonstrate some pecuiarities of vector search, we can go through a simple example. Be sure to try it!
        </p>
        
          <h3>
            "Artificial Intelligence" versus "What is Alberta's artifical intelligence strategy?" versus "AI"
          </h3>
          <ul>
          <li> 
          <p>
            Searching for the term <strong> "artifical intelligence"</strong> brings up few results with the default settings. 
            This is because the simple two-word search phrase does not have much semantic content. It is specific, 
            but you can imagine it can be represented with number in only a couple of dimensions. As a result,
              the number of ways it can be similar to something else is limited. It is not that there are few 
              results that match 'artificial intelligence' to <i>some</i> degree, it is just that the matching 
              similarity is necessarily small, and mostly below the default Search Threshold of 0.3.  To see more results,
            lower the 'Search Threshold' slider before the search.  Note that the results include results in French
              as well as English, since eaning is language independent!
          </p>
          </li>
          <li>

          <p>
            The search phrase <strong>"What is Alberta's artifical intelligence strategy?"</strong> has 
            a lot more subtle detail. It has more 'meaning', which is what the vector search matches. The search can 
            therefor find more ways in which datasets can be similar. That is why it is able to bring up more results 
            for a given similarity threshold. 
          </p>
          </li>
          <li>
          <p>
            A search for <strong>"AI"</strong> brings up more search results than "artificial intelligence".
            However, when the results are examined, you can see it brings up the same two results related to artiicial intelligence, 
            plus others that are in some way related to the abbreviation "AI". The eaning of "AI" and "artificial intelligence"
            are the same in one context, but there are more contexts in which "AI" has some meaning.
          </p>
          </li>
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
          Caveat: this is a side project, and exists partly as a way to learn a few things that I had no experience with, 
          including Svelte, Supabase auth, github hosting, and Xenova Transformers. I also wanted to explore various ways of 
          visualizing data. Each view was developed separately, using different logic as to how the data is handled, 
          filtered and displayed, so there will be minor inconsistencies. Since the goal was to ensure I understood the 
          details, I did not use the normal dev tools such as Sveltekit or even routing, UI or css libraries. That REALLy
          isn't something I'd recommend. I may recreate this in a more production-ready framework at some point.
        </p>
        
        <h3>Front-end Technologies</h3>
        <ul>
          <li><strong>Svelte</strong> - A reactive JavaScript framework for building the user interfaces</li>
          <li><strong>Xenova Transformers</strong> - Browser-compatible version of the Hugging Face Transformers library</li>
          <li><strong>all-MiniLM-L6-v2</strong> - A compact language model for generating text embeddings</li>
          <li><strong>ONNX Runtime</strong> - The engine that runs the model for efficient model inference in the browser</li>
          <li><strong>Cytoscape.js</strong> - For interactive graph visualization</li>
          <li><strong>Tensorflow.js</strong> - A WebGPU enabled machine learing library for fast matrix calculations</li>
          <li><strong>jLouvain.js</strong> - An implementation of the Louvain custering algorithm</li>
        </ul>
        
        <h3>Back-end Technologies</h3>
        <ul>
          <li><strong>Supabase</strong> - A PostgreSQL database with vector search capabilities. Also handles Auth.</li>
          <li><strong>pgvector</strong> - An extension that enables PostgreSQL to store and query vector embeddings</li>
        </ul>
        
        <h3>Data Processing</h3>
        <p>
          All dataset metadata from open.alberta.ca was processed as follows:
        </p>
        <ol>
          <li>Important fields from the metadata were extracted and normalized</li>
          <li>Text descriptions are converted to vector embeddings using all-MiniLM-L6-v2</li>
          <li>Embeddings are stored in the Supabase database using pgvector</li>
          <li>Vector similarity search is performed using cosine similarity</li>
        </ol>
        
        <p>
          Performance is always a major concern. It takes a moment to load the embeding model, but after that, performance 
          should be top-notch. The model used is a good compromise between small size (for fast loading and execution) an precision
          of the embedding itself, with an execution time of milliseconds. I chose Svelte because it is compiled away at build
          time and therefor creates a small and fast bundle. I started the project using Qdrant vector database, which is faster than pgvector,
          but found it mattered little for the small database size used here (30,000 records). 
        </p>
        <p>
          Once the query embedding vector is computed and used to query the database, results (up to 50) are verified and formatted for 
          use by cytoscape. For the Similarity Network view, a similarity matrix representing relationships between every pair of 
          results is constructed in the browser in a fraction of a second with Tensorflow.js. That is a 50x50 matrix with cosine similarity calculations
          in 384 dimensions. Computing these beforehand would require about 
          a trillion 384 dimensional matix calculations and require a database of a trillion records. That would not fit within 
          Supabase's free tier, to say the least.
        </p>
        <p>
          Authentication and sign-in has little significance in the app. I just wanted to go through the experience 
          with Supabase auth and to see how it compares to other auth stacks I have used in the past. The only surprise was 
          an malformed password reset link that took an embarrasingly long time to troubleshoot. Admin users see an administration
          menu and dashboard that isn't fully implemented yet (and may never be, since the supabase dashboard is fine).
        </p>
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