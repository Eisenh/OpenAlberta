<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient.js';
  import { navigate } from '../stores/route.js';
  import { onMount } from 'svelte';
  //import { processPackages } from '../populate_supabase_docs.js';

  let session = null;
  let loading = true;
  let isAdmin = false;

  let adminRole = null;
  let adminPermissions = null;

  onMount(async () => {
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    session = initialSession;
    
    if (session) {
      // First check app_metadata (client-side)
      isAdmin = session?.user?.app_metadata?.claims_admin || false;
      
      try {
        // Skip the direct database query since the table might not exist yet
        // Just use the edge function which has a fallback to app_metadata
        const { data: edgeAdminData, error } = await supabase.functions.invoke('authenticate-admin', {
          body: { user_id: session.user.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (!error && edgeAdminData?.is_admin) {
          isAdmin = true;
          adminRole = edgeAdminData.role;
          adminPermissions = edgeAdminData.permissions;
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
      
      if (!isAdmin) {
        navigate('/'); // Redirect non-admin users
      }
    } else {
      navigate('/login');
    }
    
    loading = false;
  });
 /* onMount(async () => {
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    session = initialSession;
    
    if (session) {
      // Check if user has admin claims or role
      isAdmin = session?.user?.app_metadata?.claims_admin || false;
      // Call edge function to verify admin status
      const { data: adminVerified, error } = await supabase.functions.invoke('verify-admin', {
        body: { user_id: session.user.id }
      });
      if (error || !adminVerified?.is_admin) {
        isAdmin = false;
      } else {
        isAdmin = true;
      }
      if (!isAdmin) {
        navigate('/'); // Redirect non-admin users
      }
    } else {
      navigate('/login');
    }
    
    loading = false;

    supabase.auth.onAuthStateChange((event, _session) => {
      session = _session;
    });
  });
  */
  // Admin action functions
  function handleDatabaseManagement() {
    alert('Database management feature coming soon!');
  }
  
  // State for processing status
  let isProcessing = false;
  let processingStatus = null;

  // Function to process packages and populate the database
  async function handleProcessPackages() {
    if (confirm('This will fetch data from the Alberta Open Data API and populate the database. Continue?')) {
      try {
        isProcessing = true;
        processingStatus = "Starting package processing...";
        
        // Process a small number of packages for testing
        const result = await processPackages(5);
        
        if (result.success) {
          processingStatus = result.message;
          alert(`Success! ${result.stats.success} packages processed, ${result.stats.failure} failures.`);
        } else {
          processingStatus = `Error: ${result.message}`;
          alert(`Error: ${result.message}`);
        }
      } catch (error) {
        console.error('Error processing packages:', error);
        processingStatus = `Error: ${error.message}`;
        alert('Error processing packages. Check the console for details.');
      } finally {
        isProcessing = false;
      }
    }
  }
  
  function handleUserManagement() {
    alert('User management feature coming soon!');
  }
  
  function handleAnalytics() {
    alert('Analytics feature coming soon!');
  }
</script>

<div class="admin-page">
  {#if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading admin dashboard...</p>
    </div>
  {:else if session && isAdmin}
    <div class="admin-header">
      <h1>Admin Dashboard</h1>
      <p class="subtitle">Manage Alberta Open Data system settings and users</p>
    </div>
    
    <div class="admin-welcome">
      <div class="admin-badge">Admin</div>
      <p>Logged in as <strong>{session.user.email}</strong></p>
    </div>
    
    <div class="admin-content">
      <div class="admin-tools">
        <div class="admin-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
          </div>
          <div class="card-content">
            <h3>Database Management</h3>
            <p>Manage collections and documents in pgvector vector database</p>
            <div class="button-group">
              <button class="secondary" on:click={handleDatabaseManagement}>
                Manage Database
              </button>
              <button class="secondary" on:click={handleProcessPackages} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Populate Database'}
              </button>
              
              {#if processingStatus}
                <div class="processing-status">
                  <div class={isProcessing ? 'status-indicator active' : 'status-indicator'}>
                    {#if isProcessing}
                      <div class="status-spinner"></div>
                    {/if}
                    <span>{processingStatus}</span>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
        
        <div class="admin-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="card-content">
            <h3>User Management</h3>
            <p>View and manage user accounts, roles, and permissions</p>
            <button class="secondary" on:click={handleUserManagement}>
              Manage Users
            </button>
          </div>
        </div>
        
        <div class="admin-card">
          <div class="card-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
              <line x1="2" y1="20" x2="22" y2="20"></line>
            </svg>
          </div>
          <div class="card-content">
            <h3>Analytics</h3>
            <p>View search patterns, usage statistics, and system performance</p>
            <button class="secondary" on:click={handleAnalytics}>
              View Analytics
            </button>
          </div>
        </div>
      </div>
      
      <div class="admin-quick-stats">
        <h2>System Overview</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">137</div>
            <div class="stat-label">Active Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">5,842</div>
            <div class="stat-label">Total Searches</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">284</div>
            <div class="stat-label">Datasets</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">99.8%</div>
            <div class="stat-label">System Uptime</div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="auth-redirect">
      <div class="message warning">
        <p>This page requires administrator privileges</p>
      </div>
      <a href="#/" class="button" on:click|preventDefault={() => navigate('/')}>Return to Home</a>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    max-width: 1000px;
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

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .admin-header {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .admin-header h1 {
    margin-bottom: var(--spacing-xs);
  }

  .subtitle {
    color: var(--color-text-light);
    font-size: 1.1rem;
  }

  .admin-welcome {
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  }

  .admin-badge {
    background-color: var(--color-secondary);
    color: white;
    font-weight: var(--font-weight-bold);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    font-size: 0.9rem;
  }

  .admin-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .admin-tools {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-lg);
  }

  .admin-card {
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    transition: var(--transition-fast);
  }

  .admin-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
  }

  .card-icon {
    background-color: rgba(61, 108, 81, 0.1);
    color: var(--color-secondary);
    padding: var(--spacing-lg);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .card-content {
    padding: var(--spacing-lg);
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .card-content h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-sm);
    color: var(--color-primary);
  }

  .card-content p {
    color: var(--color-text-light);
    margin-bottom: var(--spacing-lg);
    flex: 1;
  }
  
  .button-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .processing-status {
    margin-top: var(--spacing-sm);
    font-size: 0.9rem;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius-sm);
    background-color: var(--color-background);
    border: 1px solid var(--color-border);
  }
  
  .status-indicator.active {
    background-color: rgba(61, 108, 81, 0.1);
    border-color: var(--color-secondary);
  }
  
  .status-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(61, 108, 81, 0.2);
    border-radius: 50%;
    border-top-color: var(--color-secondary);
    animation: spin 1s ease-in-out infinite;
  }

  .admin-quick-stats h2 {
    margin-bottom: var(--spacing-lg);
    color: var(--color-primary);
    text-align: center;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .stat-card {
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    text-align: center;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
    margin-bottom: var(--spacing-xs);
  }

  .stat-label {
    color: var(--color-text-light);
    font-size: 0.9rem;
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

  @media (max-width: 768px) {
    .admin-tools {
      grid-template-columns: 1fr;
    }
    
    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
