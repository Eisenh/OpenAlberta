import { writable } from 'svelte/store';

function createSearchHistoryStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    addSearch: (query, timestamp) => {
      update(history => [...history, { query, timestamp }]);
    },
    clearHistory: () => {
      set([]);
    }
  };
}

export const searchHistory = createSearchHistoryStore();
