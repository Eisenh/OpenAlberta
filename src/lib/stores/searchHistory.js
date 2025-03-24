import { writable } from 'svelte/store';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'app_search_history';

function createSearchHistoryStore() {
  const initialHistory = loadFromLocalStorage();
  const { subscribe, set, update } = writable([]);

  // Helper to load from local storage
  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading search history from local storage:', e);
      return [];
    }
  }
  
  // Helper to save to local storage
  function saveToLocalStorage(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving search history to local storage:', e);
    }
  }
  return {
    subscribe,
    
    // Load search history (from Supabase if logged in, otherwise from local storage)
    loadHistory: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // User is logged in, load from Supabase
        const { data, error } = await supabase
          .from('search_history')
          .select('query, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error loading search history:', error);
          return;
        }
        
        set(data || []);
        
        // Also update local storage as a backup
        saveToLocalStorage(data || []);
      } else {
        // User is not logged in, load from local storage
        set(loadFromLocalStorage());
      }
    },
    
    // Add search to history
    addSearch: async (query, created_at) => {
      const newItem = { query, created_at };
      //console.log("searchHistory addSearch ", newItem);
      
      // Update local store
      let updatedHistory;
      update(history => {
        // Check if query already exists in history
        const existingIndex = history.findIndex(item => item.query === query);
        
        if (existingIndex >= 0) {
          // Remove existing entry
          const newHistory = [...history];
          newHistory.splice(existingIndex, 1);
          // Add to the beginning
          updatedHistory = [newItem, ...newHistory];
          return updatedHistory;
        } else {
          // Add new entry to the beginning
          updatedHistory = [newItem, ...history];
          return updatedHistory;
        }
      });
      
      // Save to local storage for all users
      saveToLocalStorage(updatedHistory.map(item => ({ query: item.query, created_at: item.created_at })));
      
      // Additionally save to Supabase if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // First check if this query already exists for this user
        const { data } = await supabase
          .from('search_history')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('query', query)
          .limit(1);
          
        if (data && data.length > 0) {
          // Update the timestamp of the existing entry
          const { error } = await supabase
            .from('search_history')
            .update({ created_at: created_at })
            .eq('id', data[0].id);
            
          if (error) {
            console.error('Error updating search history in Supabase:', error);
          }
        } else {
          // Insert new entry
          const { error } = await supabase
            .from('search_history')
            .insert({
              user_id: session.user.id,
              query,
              created_at: created_at
            });
            
          if (error) {
            console.error('Error saving search history to Supabase:', error);
          }
        }
      }
    },
    
    // Clear history
    clearHistory: async () => {
      // Clear local store
      set([]);
      
      // Clear local storage
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Error clearing search history from local storage:', e);
      }
      
      // Additionally clear from Supabase if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from('search_history')
          .delete()
          .eq('user_id', session.user.id);
          
        if (error) {
          console.error('Error clearing search history from Supabase:', error);
        }
      }
    },
    
    // Sync local history to Supabase when user logs in
    syncToSupabase: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const localHistory = loadFromLocalStorage();
      if (!localHistory.length) return;
      
      // Insert local history items to Supabase
      for (const item of localHistory) {
        // Check if this query already exists
        const { data } = await supabase
          .from('search_history')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('query', item.query)
          .limit(1);
          
        if (data && data.length > 0) {
          // Update the timestamp if the local one is newer
          if (data[0]) {
            const existingDate = new Date(data[0].created_at);
            const localDate = new Date(item.created_at);
            
            if (localDate > existingDate) {
              await supabase
                .from('search_history')
                .update({ created_at: item.created_at })
                .eq('id', data[0].id);
            }
          }
        } else {
          // Insert new entry
          await supabase
            .from('search_history')
            .insert({
              user_id: session.user.id,
              query: item.query,
              created_at: item.created_at
            });
        }
      }
    }
  };
}

export const searchHistory = createSearchHistoryStore();
