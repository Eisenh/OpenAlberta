<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient';
  import { session } from '../stores/session';
  import { currentRoute, navigate } from '../stores/route';
  import { onMount, tick } from 'svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import { selectedDataSourceId } from '../stores/searchFilter';

  let showSettingsMenu = false;
  let showInfoPopup = false;
  let dataSources = [];
  let userRegion = null;
  let userLat = null;
  let userLon = null;

  function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  onMount(async () => {
    // 1. Fetch user location
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        userLat = ipData.latitude;
        userLon = ipData.longitude;
        userRegion = ipData.region || ipData.country_name;
      }
    } catch (err) {
      console.error("Could not fetch user location", err);
    }

    // 2. Fetch approved data sources
    const { data } = await supabase.from('data_sources').select('*').eq('is_approved', true);
    if (data) {
       if (userLat !== null && userLon !== null) {
          dataSources = data.map(ds => {
             const dist = calculateDistance(userLat, userLon, ds.latitude, ds.longitude);
             return { ...ds, dist, distanceStr: dist < 999999 ? ` (${Math.round(dist)} km)` : '' };
          }).sort((a, b) => a.dist - b.dist);
       } else {
          dataSources = data;
       }
       
       const saved = localStorage.getItem('preferred_search_scope');
       if (!saved) {
           const alberta = data.find(ds => ds.display_name.toLowerCase().includes('alberta'));
           if (alberta) {
               selectedDataSourceId.set(alberta.id);
               localSelectValue = alberta.id;
           }
       }
    }

    // Close settings menu when clicking outside
    const handleClickOutside = (event) => {
      const settingsMenu = document.getElementById('settings-menu');
      const settingsButton = document.getElementById('settings-button');
      
      if (settingsMenu && 
          !settingsMenu.contains(event.target) && 
          settingsButton && 
          !settingsButton.contains(event.target)) {
        showSettingsMenu = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/');
      showSettingsMenu = false;
    } catch (error) {
      alert(error.error_description || error.message);
    }
  }
  
  function toggleSettingsMenu() {
    showSettingsMenu = !showSettingsMenu;
  }

  // Handle localstorage 'all' sync
  let localSelectValue = $selectedDataSourceId === 'all' ? null : $selectedDataSourceId;
  function handleSelectChange(e) {
      const val = e.target.value;
      if (val === "Worldwide") {
          selectedDataSourceId.set(null);
      } else {
          selectedDataSourceId.set(val);
      }
      localSelectValue = val === "Worldwide" ? null : val;
  }
</script>

<header class="header">
    <div class="header-content">
      <div class="logo">
        <div class="source-selector">
          <div class="select-wrapper">
            <select class="geo-dropdown" value={localSelectValue === null ? "Worldwide" : localSelectValue} on:change={handleSelectChange}>
              <option value="Worldwide">Worldwide Open Data</option>
              {#if dataSources.length > 0}
                <optgroup label="Data Sources (Nearest)">
                  {#each dataSources as ds}
                    <option value={ds.id}>{ds.display_name}{ds.distanceStr}</option>
                  {/each}
                </optgroup>
              {/if}
            </select>
            <span class="dropdown-icon">▼</span>
          </div>
          <button class="info-btn" on:click={() => showInfoPopup = true} title="How to add data sources" aria-label="Information about adding data sources">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>
        </div>
      </div>
      
        <nav class="main-nav">
          <ul>
            <li><a href="#/" on:click|preventDefault={() => navigate('/')}>Home</a></li>
            {#if $session?.user?.app_metadata?.claims_admin}
              <li><a href="#/admin" on:click|preventDefault={() => navigate('/admin')}>Admin</a></li>
            {/if}
          {#if $session}
              <li><a href="#/profile" on:click|preventDefault={() => navigate('/profile')}>Profile</a></li>
            {/if}
            <li><a href="#/help" on:click|preventDefault={() => navigate('/help')}>Help</a></li>
            <li><a href="#/terms" on:click|preventDefault={() => navigate('/terms')}>Terms</a></li>
          </ul>
        </nav>
        <div class="user-controls">
          {#if showSettingsMenu}
            <div id="settings-menu" class="settings-menu">
              <div class="settings-menu-content">
                <ThemeSwitcher />
              </div>
            </div>
          {/if}
          {#if $session}
            <div class="user-profile">
              <span class="user-email">{$session.user.email.split('@')[0]}</span>
              <button class="outline" on:click={signOut}>Sign Out</button>
            </div>
          {:else}
            <a href="#/login" class="button outline" on:click|preventDefault={() => navigate('/login')}>Login</a>
            <a href="#/signup" class="button" on:click|preventDefault={() => navigate('/signup')}>Sign Up</a>
          {/if}
        </div>
    </div>
</header>

{#if showInfoPopup}
<div class="modal-overlay" role="button" tabindex="0" on:click={() => showInfoPopup = false} on:keydown={(e) => e.key === 'Escape' && (showInfoPopup = false)}>
  <div class="modal-content" role="document" on:click|stopPropagation>
    <h3>Adding Data Sources</h3>
    <p>To add a new data source to the system, please follow these steps:</p>
    <ol>
      <li>Sign in to your account (or sign up if you don't have one).</li>
      <li>Navigate to your Profile page.</li>
      <li>Click the "Add Data Source" button.</li>
      <li>Fill out the form with the CKAN portal URL, name, and location.</li>
      <li>Submit for approval. Once approved, it will be available to all users!</li>
    </ol>
    <button class="close-btn" on:click={() => showInfoPopup = false}>Close</button>
  </div>
</div>
{/if}

<style>
  .geo-dropdown {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-primary);
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 1.5rem 0.25rem 0.5rem;
    cursor: pointer;
    appearance: none;
    outline: none;
    font-family: inherit;
    transition: background 0.2s;
  }
  .geo-dropdown:hover {
    background: var(--color-background-hover, rgba(0,0,0,0.05));
  }
  .geo-dropdown:focus {
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }
  .geo-dropdown option, .geo-dropdown optgroup {
    font-size: 1rem;
    color: var(--color-text);
    background: var(--color-background);
  }
  .source-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .select-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .dropdown-icon {
    position: absolute;
    right: 0.5rem;
    pointer-events: none;
    font-size: 0.8rem;
    color: var(--color-primary);
  }
  .info-btn {
    background: none;
    border: none;
    color: var(--color-text-light, #666);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: 50%;
    transition: background 0.2s, color 0.2s;
  }
  .info-btn:hover {
    background: var(--color-background-hover, rgba(0,0,0,0.05));
    color: var(--color-primary);
  }
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: var(--color-background);
    padding: 2rem;
    border-radius: 8px;
    max-width: 400px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  .modal-content h3 {
    margin-top: 0;
    color: var(--color-primary);
  }
  .modal-content ol {
    margin-bottom: 1.5rem;
    padding-left: 1.5rem;
    color: var(--color-text);
  }
  .modal-content p, .modal-content li {
    margin-bottom: 0.5rem;
    color: var(--color-text);
  }
  .close-btn {
    background: var(--color-primary);
    color: var(--color-background);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    width: 100%;
  }
  .close-btn:hover {
    opacity: 0.9;
  }
  .header {
    background-color: var(--color-background-alt);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--color-border);
    width: 100%;
  }
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-lg);
    gap: var(--spacing-lg);
  }

  .logo {
    flex: 1;
  }
  
  .main-nav {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .main-nav ul {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: var(--spacing-lg);
  }

  .main-nav a {
    font-weight: var(--font-weight-medium);
    text-decoration: none;
    transition: var(--transition-fast);
    position: relative;
  }

  .main-nav a::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 2px;
    background-color: var(--color-primary);
    transition: var(--transition-fast);
  }

  .main-nav a:hover::after {
    width: 100%;
  }

  .user-controls {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spacing-md);
    flex-shrink: 0;
    padding-right: var(--spacing-lg);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .user-email {
    font-weight: var(--font-weight-medium);
    color: var(--color-primary);
  }
  /*
  .settings-button {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-light);
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
  }
  
  .settings-button:hover {
    color: var(--color-primary);
    background-color: rgba(0, 0, 0, 0.05);
    transform: none;
  }
  
  .settings-menu {
    position: absolute;
    top: 100%;
    right: var(--spacing-lg);
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
    z-index: var(--z-index-above);
    width: 250px;
    overflow: hidden;
  }
  
  .settings-menu-content {
    padding: var(--spacing-md);
  }
*/
  /* Responsive styles */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: stretch;
      padding: var(--spacing-md) 0;
    }

    .main-nav ul {
      justify-content: center;
      flex-wrap: wrap;
    }

    .user-controls {
      justify-content: center;
    }

    .user-profile {
      justify-content: center;
      width: 100%;
    }
  }

  @media (max-width: 480px) {

    .user-controls {
      flex-direction: column;
      width: 100%;
    }

    .user-controls .button,
    .user-controls button,
    .user-profile {
      width: 100%;
    }

    .user-profile {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
