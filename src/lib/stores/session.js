import { writable } from 'svelte/store';

// Create session store with initial null value
export const session = writable(null);
