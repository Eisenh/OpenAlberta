<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient';
  import { currentRoute, navigate } from '../stores/route';
  import { onMount } from 'svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';

  let session = null;
  let showSettingsMenu = false;

  onMount(async () => {
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    session = initialSession;

    supabase.auth.onAuthStateChange((event, _session) => {
      session = _session;
    });
    
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
</script>

<header class="header">
    <div class="header-content">
      <div class="logo">
        <h1>Alberta Open Data</h1>
      </div>
      
        <nav class="main-nav">
          <ul>
            <li><a href="/" on:click|preventDefault={() => navigate('/')}>Home</a></li>
            {#if session?.user?.app_metadata?.claims_admin}
              <li><a href="/admin" on:click|preventDefault={() => navigate('/admin')}>Admin</a></li>
            {/if}
            {#if session}
              <li><a href="/profile" on:click|preventDefault={() => navigate('/profile')}>Profile</a></li>
            {/if}
            <li><a href="/terms" on:click|preventDefault={() => navigate('/terms')}>Terms</a></li>
          </ul>
        </nav>
        <div class="user-controls">
        
          {#if session}
            <div class="user-profile">
              <span class="user-email">{session.user.email.split('@')[0]}</span>
              <button class="outline" on:click={signOut}>Sign Out</button>
            </div>
          {:else}
            <a href="/login" class="button outline" on:click|preventDefault={() => navigate('/login')}>Login</a>
            <a href="/signup" class="button" on:click|preventDefault={() => navigate('/signup')}>Sign Up</a>
          {/if}
          <button 
            id="settings-button"
            class="settings-button" 
            on:click|stopPropagation={toggleSettingsMenu}
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          
          {#if showSettingsMenu}
            <div id="settings-menu" class="settings-menu">
              <div class="settings-menu-content">
                <ThemeSwitcher />
              </div>
            </div>
          {/if}
          
        </div>
    </div>
</header>

<style>
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
