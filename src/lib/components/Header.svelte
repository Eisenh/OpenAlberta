<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient';
  import { session } from '../stores/session';
  import { currentRoute, navigate } from '../stores/route';
  import { onMount, tick } from 'svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import { selectedDataSourceId } from '../stores/searchFilter';

  let showSettingsMenu = false;
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

<style>
  .geo-dropdown {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-primary);
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
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
