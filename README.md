# Help & Information
Last Updated: March 25, 2025

## 1. Introduction

Welcome to the Alberta Open Data search tool. This app uses advanced semantic search 
technology to help you discover and explore open datasets provided by the Government of Alberta.

Unlike traditional keyword search systems, the platform uses AI-powered vector embeddings 
to understand the meaning behind your queries, returning results based on semantic relevance 
rather than just keyword matching.

## 2. How to Search

### Basic Text Search

To search for datasets, enter your query in the search box at the top of the page and press Enter 
or click the search icon. Results will be displayed in both graph and list formats (below the graph).
      
Each result includes:

- **Title** - The name of the dataset
- **Description** - A summary of what the dataset contains
- **Resources** - Links to download the data in various formats
- **Tags** - Categories or keywords associated with the dataset

### Tips for efficient searching

- **Use natural language** - Instead of just keywords, try asking a question or describing the data you need
- **Be specific** - Detailed queries are likely to yield better results. A long sentence or short paragraph are useful if searching subject areas with many similar datasets
- **Explore related datasets** - Double-click on interesting results to pivot your search in that direction.
- Adjust the **Similarity Threshold** slider before repeating a search to limit or expand results by relevance
- Use the **visual clues** such as node sizes and cluster colors to understand the results. Adjust the Display threshold to focus on the most significant relationships in the network view
- **Check your search history** - Review and refine your previous searches

### Search History

Your recent searches are saved locally and can be accessed by clicking in the search box. 
Click on any previous search to run it again. If you signed in, you can see your entier search history on the profile page.

### Exploring the Graph

The application offers three different ways to visualize search results:

- #### Compact View
  The compact view shows your query and the top 8 most relevant results. This is the default view 
  and is useful for quickly identifying the most relevant datasets.

- #### Expanded View
  The expanded view shows all results that meet the current similarity threshold, displayed in an
  expanding spiral based on similarity. The thickness of the connection, the diameter of the node, 
  and the closeness to the center are proportional to the strength of the match.

- #### Similarity Network
  The similarity graph shows connections not only between your query and results, but also between 
  the result datasets themselves. This helps identify clusters of related datasets and reveals the 
  underlying structure of the data ecosystem. Clusters are automatically identified and assigned unique colors.
  Similar to the Expanded View, connections thickness and node size represent semantic similarity.

### Navigating the Graphs

The interactive graph visualizations shows relationships between your query and the results:

- **The query itself** appears in orange near the center
- **Hover your mouse pointer** over a node to see the dataset's description in a tooltip, or over a link to see the calculated similarity
- **Click on a node** to view details about that dataset in the left panel
- **Double-click on a node** to use that dataset as the basis of a new search
- Switch between different **View Modes** using the dropdown control below the search bar to chose the view mode

## 3. Semantic Vector Search

The application uses a technique called vector search to find semantically relevant documents.
Here's how it works:

### Vector Embeddings

When you enter a search query, the app:

1. Converts your text query into a high-dimensional vector (embedding) using a neural language model
2. Compares this vector to the pre-computed embeddings of all datasets in the database
3. Returns datasets with embeddings most similar to your query vector

### Benefits of Vector Search

- **Semantic Understanding** - Finds results based on meaning, not just keywords. In fact, it can find results in multiple languages.
- **Natural Language Queries** - Ask questions in plain language
- **Contextual Relevance** - Returns results that match the context of your query
- **Discovery** - Surfaces relevant datasets you might not find through keyword search

### Similarity Threshold

The similarity threshold controls how closely a dataset must match your query to be included in the results. 
A higher threshold will show fewer, more relevant results, while a lower threshold will show more results 
with potentially lower relevance.

## 4. Semantic Vector Search Case Study

To demonstrate some pecuiarities of vector search, we can go through a simple example. Be sure to try it!

### "Artificial Intelligence" versus "What is Alberta's artifical intelligence strategy?" versus "AI"

- Searching for the term **"artifical intelligence"** brings up few results with the default settings. 
  This is because the simple two-word search phrase does not have much semantic content. It is specific, 
  but you can imagine it can be represented with number in only a couple of dimensions. As a result,
  the number of ways it can be similar to something else is limited. It is not that there are few 
  results that match 'artificial intelligence' to *some* degree, it is just that the matching 
  similarity is necessarily small, and mostly below the default Search Threshold of 0.3. To see more results,
  lower the 'Search Threshold' slider before the search. Note that the results include results in French
  as well as English, since meaning is language independent!

- The search phrase **"What is Alberta's artifical intelligence strategy?"** has 
  a lot more subtle detail. It has more 'meaning', which is what the vector search matches. The search can 
  therefor find more ways in which datasets can be similar. That is why it is able to bring up more results 
  for a given similarity threshold.

- A search for **"AI"** brings up more search results than "artificial intelligence".
  However, when the results are examined, you can see it brings up the same two results related to artiicial intelligence, 
  plus others that are in some way related to the abbreviation "AI". The meaning of "AI" and "artificial intelligence"
  are the same in one context, but there are more contexts in which "AI" has some meaning.

## 5. Technical Implementation

Caveat: this is a side project, and exists partly as a way to learn a few things that I had no experience with, 
including Svelte, Supabase auth, github hosting, Xenova Transformers. and cytoscape. I went through a few iterations to explore various ways of visualizing data. Each view was developed separately, using different logic as to how the data is handled, filtered and displayed, so there will be minor inconsistencies. Since the goal was to ensure I understood the details, I did not use the normal dev tools such as Sveltekit or even routing, UI or css libraries. That REALLY isn't something I'd recommend. I may recreate this in a more maintainable framework at some point.

### Front-end Technologies

- **Svelte** - A reactive JavaScript framework for building the user interfaces
- **Xenova Transformers** - Browser-compatible version of the Hugging Face Transformers library
- **all-MiniLM-L6-v2** - A compact language model for generating text embeddings
- **ONNX Runtime** - The engine that runs the model for efficient model inference in the browser
- **Cytoscape.js** - For interactive graph visualization
- **Tensorflow.js** - A WebGPU enabled machine learing library for fast matrix calculations
- **jLouvain.js** - An implementation of the Louvain custering algorithm

### Back-end Technologies

- **Supabase** - A PostgreSQL database with vector search capabilities. Also handles Auth.
- **pgvector** - An extension that enables PostgreSQL to store and query vector embeddings

### Data Processing

All dataset metadata from open.alberta.ca was processed as follows:

1. Important fields from the metadata were extracted and normalized
2. Text descriptions are converted to vector embeddings using all-MiniLM-L6-v2
3. Embeddings are stored in the Supabase database using pgvector
4. Vector similarity search is performed using cosine similarity

Performance is always a major concern. It takes a moment to load the embeding model, but after that, performance 
should be top-notch. The model used is a good compromise between small size (for fast loading and execution) and maintaining
enough precision for a search. I chose Svelte because it is compiled away at build
time and therefor creates a small and fast bundle. That would matter more for more complex projects than this.
I started the project using Qdrant vector database, which is faster than pgvector,
but found it mattered little for the small database size used here (30,000 records).

Once the query embedding vector is computed and used to query the database, results (up to 50) are verified and formatted for use by cytoscape. For the Similarity Network view, a similarity matrix representing relationships between every pair of results is constructed in the browser in a fraction of a second with Tensorflow.js. That is a 50x50 matrix with cosine similarity calculations in 384 dimensions. Computing these beforehand would require about a trillion 384 dimensional matix calculations and require a database of a trillion records. That would not fit within Supabase's free tier, to say the least.

I tried both Markov clustering and the current jLouvain algorithm for clusterig. Both work. jLouvain is just something I hadn't tried before.

Authentication and sign-in has little significance in the app. I just wanted to go through the experience 
with Supabase auth and to see how it compares to other auth stacks I have used in the past. Admin users see an administration menu and dashboard that isn't fully implemented yet (and may never be, since the supabase dashboard is fine).

---

© 2025 Eisenhawer Tech. All rights reserved.

If you have any questions or need assistance, please contact me through eisenhawer.ca or raise an issue on github.
