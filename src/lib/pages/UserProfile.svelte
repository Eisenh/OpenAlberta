<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { searchHistory } from '../stores/searchHistory.js';
  import { supabase } from '../supabaseClient.js';
  import { navigate } from '../stores/route.js';
  import { onMount } from 'svelte';

  let session = null;
  let loading = true;
  let userEmail = '';
  let isAdmin = false; // New state variable

  onMount(async () => {
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    session = initialSession;
    
    if (session) {
      userEmail = session.user.email;
      
      // Check if user is an admin
      // First check app_metadata (client-side)
      isAdmin = session?.user?.app_metadata?.claims_admin || false;
      
      // Verify with edge function
      try {
        // Skip the direct database query since the table might not exist yet
        // Just use the edge function which has a fallback to app_metadata
        const { data: adminData, error } = await supabase.functions.invoke('authenticate-admin', {
          body: { user_id: session.user.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        console.log('Admin check response:', { adminData, error });
        if (!error && adminData?.is_admin) {
          isAdmin = true;
          console.log('Admin status verified via edge function');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        // If edge function fails, fall back to app_metadata only
        isAdmin = session?.user?.app_metadata?.claims_admin || false;
        if (isAdmin) {
          console.log('Admin status verified via app_metadata only');
        }
      }

      // Sync local search history to Supabase
      await searchHistory.syncToSupabase();
  

    } else {
      navigate('/login');
    }
    
    loading = false;

    supabase.auth.onAuthStateChange((event, _session) => {
      session = _session;
    });
  });

  function clearSearchHistory() {
    searchHistory.clearHistory();
  }
  
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
  
  function getUserInitials(email) {
    if (!email) return 'U';
    const username = email.split('@')[0];
    if (username.length <= 2) return username.toUpperCase();
    
    return username.charAt(0).toUpperCase();
  }
  
  function goToAdminDashboard() {
    navigate('/admin');
  }
</script>

<div class="profile-page">
  {#if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading your profile...</p>
    </div>
  {:else if session}
    <div class="profile-header">
      <div class="user-avatar">
        <span class="avatar-initials">{getUserInitials(userEmail)}</span>
      </div>
      <div class="user-info">
        <h1>User Profile</h1>
        <p class="user-email">{userEmail}</p>
      </div>
      
      <!-- Admin button - only shown to admin users -->
      {#if isAdmin}
        <button class="admin-button" on:click={goToAdminDashboard} title="Admin Dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          Admin
        </button>
      {/if}
    </div>

    <div class="profile-content">
      <div class="card">
        <div class="card-header">
          <h2>Search History</h2>
          {#if $searchHistory.length > 0}
            <button class="clear-button" on:click={clearSearchHistory}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear History
            </button>
          {/if}
        </div>
        
        {#if $searchHistory.length > 0}
          <ul class="search-history-list">
            {#each $searchHistory as item}
              <li class="search-history-item">
                <div class="search-query">
                  <span class="search-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <span class="query-text">{item.query}</span>
                </div>
                <div class="search-timestamp">
                  {formatDate(item.timestamp)}
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <p>You haven't performed any searches yet</p>
            <a href="/" class="button outline" on:click|preventDefault={() => navigate('/')}>Start Searching</a>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="auth-redirect">
      <div class="message warning">
        <p>Please log in to view your profile</p>
      </div>
      <a href="/login" class="button" on:click|preventDefault={() => navigate('/login')}>Go to Login</a>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--spacing-md);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xxl);
    text-align: center;
  }

  .loading-spinner {
    display: inline-block;
    width: 48px;
    height: 48px;
    border: 4px solid rgba(11, 79, 113, 0.2);
    border-radius: 50%;
    border-top-color: var(--color-primary);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: var(--spacing-lg);
  }

  .profile-header {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-xl);
    padding-bottom: var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  .user-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background-color: var(--color-primary);
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: var(--spacing-lg);
    flex-shrink: 0;
  }

  .avatar-initials {
    color: white;
    font-size: 2rem;
    font-weight: var(--font-weight-bold);
  }

  .user-info h1 {
    margin-bottom: var(--spacing-xs);
  }

  .user-email {
    color: var(--color-text-light);
    font-size: 1.1rem;
  }

  .card {
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    margin-bottom: var(--spacing-xl);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
    background-color: rgba(11, 79, 113, 0.03);
  }

  .card-header h2 {
    margin: 0;
    font-size: 1.3rem;
  }

  .clear-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-md);
    background-color: transparent;
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: var(--border-radius-md);
    font-size: 0.9rem;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .clear-button:hover {
    background-color: rgba(198, 40, 40, 0.05);
  }

  .search-history-list {
    list-style: none;
    padding: var(--spacing-lg) var(--spacing-xl);
    margin: 0;
  }

  .search-history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .search-history-item:last-child {
    border-bottom: none;
  }

  .search-query {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .search-icon {
    color: var(--color-text-light);
  }

  .query-text {
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
  }

  .search-timestamp {
    color: var(--color-text-light);
    font-size: 0.9rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xxl);
    text-align: center;
    color: var(--color-text-light);
  }

  .empty-state svg {
    margin-bottom: var(--spacing-lg);
    opacity: 0.5;
  }

  .empty-state p {
    margin-bottom: var(--spacing-lg);
  }

  .auth-redirect {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xxl);
    text-align: center;
  }

  .auth-redirect .message {
    margin-bottom: var(--spacing-lg);
    max-width: 400px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Add these new styles */
  .admin-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--color-secondary);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 0.9rem;
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: var(--transition-fast);
    margin-left: auto; /* Push to the right side */
  }

  .admin-button:hover {
    background-color: var(--color-secondary-dark, #2c5f43);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }
  
  /* Update this media query to handle the admin button on mobile */
  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      text-align: center;
    }

    .user-avatar {
      margin-right: 0;
      margin-bottom: var(--spacing-md);
    }
    
    .admin-button {
      margin-left: 0;
      margin-top: var(--spacing-md);
    }

    .card-header {
      flex-direction: column;
      gap: var(--spacing-md);
    }

    .search-history-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-sm);
    }
  }
</style>
