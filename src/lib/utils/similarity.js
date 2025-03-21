// Calculates similarity between two vectors using cosine similarity
import * as tf from '@tensorflow/tfjs';

// Load the WebGL backend
tf.setBackend('webgl');

/**
 * Calculate similarity matrix using TensorFlow.js GPU acceleration
 * @param {Array} results - Array of objects with embedding property 
 * @param {number} maxNodes - Maximum number of nodes to process (for performance)
 * @returns {Array} 2D similarity matrix
 */
export function calculateSimilarityMatrixGPU(results, maxNodes = 50) {
  // Limit to maxNodes
  const limitedResults = results.slice(0, maxNodes);
  
  // Extract embeddings into a 2D array, ensuring we have valid embeddings
  const embeddings = limitedResults.map(r => {
    if (r.embedding) return r.embedding;
    if (r.notes_embedding) return r.notes_embedding;
    return null;
  }).filter(Boolean);
  
  if (embeddings.length === 0) {
    console.warn("No valid embeddings found for similarity calculation");
    return [];
  }
  
  // Use try-catch for tensor operations to prevent crashes
  try {
    // Convert to tensors and calculate
    const tensors = tf.tensor2d(embeddings);
    const normalized = tf.div(tensors, tf.norm(tensors, 2, 1, true));
    const similarities = tf.matMul(normalized, normalized, false, true);
    
    // Convert back to regular array and ensure it's a 2D array
    const matrix = similarities.arraySync();
    
    // Ensure we have a 2D array (handle edge case of single embedding)
    if (!Array.isArray(matrix) || !Array.isArray(matrix[0])) {
      const safeMatrix = Array.isArray(matrix) ? 
        matrix.map(row => Array.isArray(row) ? row : [row]) : 
        [[1]]; // Fallback for extreme edge cases
      
      // Clean up tensors to prevent memory leaks
      tf.dispose([tensors, normalized, similarities]);
      
      return safeMatrix;
    }
    
    // Clean up tensors to prevent memory leaks
    tf.dispose([tensors, normalized, similarities]);
    
    return matrix;
  } catch (error) {
    console.error("Error in GPU similarity calculation:", error);
    throw error; // Propagate error to trigger CPU fallback
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} Similarity score between 0 and 1
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    console.warn("Invalid vectors for similarity calculation");
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Creates a similarity matrix from an array of items with embeddings (CPU version)
 * @param {Array} results - Array of objects with embedding property
 * @param {number} maxNodes - Maximum number of nodes to process
 * @returns {Array} 2D similarity matrix
 */
export function calculateSimilarityMatrixCPU(results, maxNodes = 50) {
  // Limit to maxNodes
  const limitedResults = results.slice(0, maxNodes);
  
  // Extract valid embeddings
  const validResults = limitedResults.map(r => {
    return {
      id: r.id,
      embedding: r.embedding || r.notes_embedding || null
    };
  }).filter(r => r.embedding !== null);
  
  if (validResults.length === 0) {
    console.warn("No valid embeddings found for similarity calculation");
    return [];
  }
  
  const matrix = [];
  for (let i = 0; i < validResults.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < validResults.length; j++) {
      if (i === j) {
        matrix[i][j] = 1.0; // Self-similarity is perfect
      } else {
        // Calculate similarity between embeddings
        matrix[i][j] = cosineSimilarity(
          validResults[i].embedding, 
          validResults[j].embedding
        );
      }
    }
  }
  return matrix;
}

/**
 * Calculate similarity matrix using either GPU or CPU implementation
 * @param {Array} results - Array of objects with embedding property
 * @param {number} maxNodes - Maximum number of nodes to process
 * @returns {Object} Object containing the matrix and node IDs mapping
 */
export function calculateSimilarityMatrix(results, maxNodes = 50) {
  if (!results || results.length === 0) {
    console.warn("Empty results provided for similarity calculation");
    return { matrix: [], nodeIds: [] };
  }
  
  // Limit to maxNodes
  const limitedResults = results.slice(0, maxNodes);
  
  // Log some debug info
  console.log(`Processing ${limitedResults.length} nodes for similarity calculation`);
  if (limitedResults.length > 0) {
    console.log("First node id:", limitedResults[0].id);
    console.log("First node embedding location:", 
      limitedResults[0].embedding ? "embedding" : 
      limitedResults[0].notes_embedding ? "notes_embedding" : 
      "unknown");
  }
  
  // Extract valid results with embeddings
  const validResults = limitedResults.map(r => {
    // Get embedding from either location
    let embedding = r.embedding || r.notes_embedding || null;
    
    // Process embedding if it's a string
    if (typeof embedding === 'string') {
      try {
        // Try to parse as JSON
        embedding = JSON.parse(embedding);
      } catch (e) {
        console.warn("Failed to parse embedding string as JSON:", e);
        try {
          // If JSON parsing fails, try splitting by commas
          embedding = embedding.split(',').map(Number);
        } catch (err) {
          console.error("Failed to process embedding string:", err);
          embedding = null;
        }
      }
    }
    
    return {
      id: r.id,
      embedding: embedding
    };
  }).filter(r => r.embedding !== null && Array.isArray(r.embedding) && r.embedding.length > 0);
  
  console.log(`Found ${validResults.length} valid nodes with embeddings`);
  
  // Create a mapping of node ids to their index in the matrix
  const nodeIds = validResults.map(r => r.id);
  
  try {
    // Try GPU-accelerated version first
    const matrix = calculateSimilarityMatrixGPU(validResults, maxNodes);
    return { matrix, nodeIds };
  } catch (error) {
    console.warn("GPU similarity calculation failed, falling back to CPU", error);
    // Fall back to CPU version
    const matrix = calculateSimilarityMatrixCPU(validResults, maxNodes);
    return { matrix, nodeIds };
  }
}

/**
 * Filter graph nodes and links based on similarity threshold
 * @param {Object} graphData - Object containing nodes and links
 * @param {number} threshold - Similarity threshold
 * @param {string} queryNodeId - ID of the query node
 * @returns {Object} Filtered graph data
 */
export function filterGraphByThreshold(graphData, threshold, queryNodeId = 'query') {
  if (!graphData || !graphData.nodes || !graphData.links) {
    return { nodes: [], links: [] };
  }
  
  // Always include the query node
  const queryNode = graphData.nodes.find(node => node.id === queryNodeId);
  if (!queryNode) {
    return { nodes: [], links: [] };
  }
  
  // Filter links by threshold
  const filteredLinks = graphData.links.filter(link => link.weight >= threshold);
  
  // Get IDs of nodes that have connections after filtering
  const connectedNodeIds = new Set([queryNodeId]);
  filteredLinks.forEach(link => {
    connectedNodeIds.add(link.source);
    connectedNodeIds.add(link.target);
  });
  
  // Filter nodes to only include those with connections
  const filteredNodes = graphData.nodes.filter(node => 
    connectedNodeIds.has(node.id) || 
    (node.similarity && node.similarity >= threshold)
  );
  
  return { 
    nodes: filteredNodes, 
    links: filteredLinks 
  };
}
