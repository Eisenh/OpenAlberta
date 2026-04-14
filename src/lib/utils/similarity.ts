/**
 * Defines the structural contract for a graph node containing vector embeddings.
 */
export interface GraphNode {
  id: string | number;
  embedding?: number[] | string | null;
  notes_embedding?: number[] | string | null;
  similarity?: number;
  // Allow for arbitrary application-specific properties on the node payload
  [key: string]: any; 
}

export interface GraphLink {
  source: string | number;
  target: string | number;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SimilarityResult {
  matrix: number[][];
  nodeIds: Array<string | number>;
}

/**
 * Calculate cosine similarity between two numeric vectors.
 * Guaranteed to return a score between 0 and 1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  // Single-pass loop ensures L1 cache coherency and avoids branch misprediction
  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
}

/**
 * Safely extracts, parses, and normalizes an embedding from a generic node payload.
 */
function extractEmbedding(node: GraphNode): number[] | null {
  let embedding = node.embedding || node.notes_embedding || null;
  
  if (typeof embedding === 'string') {
    try {
      embedding = JSON.parse(embedding) as number[];
    } catch (e) {
      try {
        embedding = (embedding as string).split(',').map(Number);
      } catch (err) {
        return null;
      }
    }
  }
  
  // Type predicate checks to satisfy the compiler
  if (Array.isArray(embedding) && embedding.length > 0 && embedding.every(val => typeof val === 'number')) {
    return embedding;
  }
  
  return null;
}

/**
 * Calculate similarity matrix using an optimized CPU implementation.
 * Exploits symmetry (A·B = B·A) to halve computational complexity.
 */
export function calculateSimilarityMatrix(results: GraphNode[], maxNodes: number = 50): SimilarityResult {
  if (!results || results.length === 0) {
    console.warn("Empty results provided for similarity calculation");
    return { matrix: [], nodeIds: [] };
  }
  
  // Extract and parse valid results in a single pass
  const validResults = results
    .slice(0, maxNodes)
    .map(r => ({ id: r.id, embedding: extractEmbedding(r) }))
    .filter((r): r is { id: string | number; embedding: number[] } => r.embedding !== null);
    
  const n = validResults.length;
  
  if (n === 0) {
    console.warn("No valid embeddings found for similarity calculation");
    return { matrix: [], nodeIds: [] };
  }
  
  const nodeIds = validResults.map(r => r.id);
  
  // Pre-allocate contiguous memory utilizing typed arrays for performance
  const matrix = Array.from({ length: n }, () => new Float32Array(n));
  
  // Compute upper triangle and mirror
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0; 
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(validResults[i].embedding, validResults[j].embedding);
      matrix[i][j] = similarity;
      matrix[j][i] = similarity; 
    }
  }
  
  // Downcast Float32Array to standard number[] for broader compatibility downstream
  return { 
    matrix: matrix.map(row => Array.from(row)), 
    nodeIds 
  };
}

/**
 * Filter graph components strictly by a defined minimum similarity scalar.
 */
export function filterGraphByThreshold(graphData: GraphData, threshold: number, queryNodeId: string | number = 'query'): GraphData {
  if (!graphData || !graphData.nodes || !graphData.links) {
    return { nodes: [], links: [] };
  }
  
  const queryNode = graphData.nodes.find(node => node.id === queryNodeId);
  if (!queryNode) {
    return { nodes: [], links: [] };
  }
  
  const filteredLinks = graphData.links.filter(link => link.weight >= threshold);
  
  const connectedNodeIds = new Set<string | number>([queryNodeId]);
  for (const link of filteredLinks) {
    connectedNodeIds.add(link.source);
    connectedNodeIds.add(link.target);
  }
  
  const filteredNodes = graphData.nodes.filter(node => 
    connectedNodeIds.has(node.id) || 
    (node.similarity !== undefined && node.similarity >= threshold)
  );
  
  return { nodes: filteredNodes, links: filteredLinks };
}