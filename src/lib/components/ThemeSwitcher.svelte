<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  
  // Theme options
  const themes = [
    { id: 'theme-default', name: 'Alberta Landscape (Default)' },
    { id: 'theme-dark', name: 'Alberta Night' },
    { id: 'theme-high-contrast', name: 'Alberta Accessibility' }
  ];
  
  // Current theme state
  let currentTheme = 'theme-default';
  
  // Initialize theme from localStorage if available
  onMount(() => {
    const savedTheme = localStorage.getItem('alberta-opendata-theme');
    if (savedTheme && themes.some(theme => theme.id === savedTheme)) {
      setTheme(savedTheme);
    }
  });
  
  // Apply theme to body element and save to localStorage
  function setTheme(themeId) {
    // Remove all theme classes
    document.body.classList.remove(...themes.map(t => t.id));
    
    // Add selected theme class
    document.body.classList.add(themeId);
    
    // Update current theme state
    currentTheme = themeId;
    
    // Save to localStorage
    localStorage.setItem('alberta-opendata-theme', themeId);
  }
</script>

<div class="theme-switcher">
  <label for="theme-select">Color Theme</label>
  <select 
    id="theme-select" 
    bind:value={currentTheme} 
    on:change={() => setTheme(currentTheme)}
  >
    {#each themes as theme}
      <option value={theme.id}>{theme.name}</option>
    {/each}
  </select>
</div>

<style>
  .theme-switcher {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 200px;
  }
  
  label {
    font-size: 0.85rem;
    font-weight: var(--font-weight-medium);
    color: var(--color-text-light);
  }
  
  select {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-background-alt);
    color: var(--color-text);
    font-family: var(--font-family);
    font-size: 0.9rem;
    cursor: pointer;
    transition: var(--transition-fast);
    margin: 0;
  }
  
  select:hover {
    border-color: var(--color-primary);
  }
  
  select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(11, 79, 113, 0.2);
  }
</style>
