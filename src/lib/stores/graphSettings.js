import { writable } from 'svelte/store';

// Create display threshold store for graph components
export const displaySimilarityThreshold = writable(0.3);
