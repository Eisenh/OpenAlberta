import { writable } from 'svelte/store';

// Holds null for 'Worldwide', or a UUID for a specific data source
export const selectedDataSourceId = writable<string | null>(null);

// On initialization, load from localStorage if available
if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('preferred_search_scope');
    if (saved) {
        selectedDataSourceId.set(saved);
    }

    // Subscribe to changes to keep localStorage automatically in sync
    selectedDataSourceId.subscribe(value => {
        if (value === null) {
            localStorage.setItem('preferred_search_scope', 'all');
        } else {
            localStorage.setItem('preferred_search_scope', value);
        }
    });
}
