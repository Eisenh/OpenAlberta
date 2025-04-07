<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { searchHistory } from '$stores/searchHistory.js';
  import { supabase } from '../supabaseClient.js';
  import { navigate } from '../stores/route.js';
  import { onMount } from 'svelte';

  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  let showPassword = false;

  onMount(() => {
    // Check URL parameters for password reset success message
    const hash = window.location.hash;
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      successMessage = 'Your password has been reset successfully. Please sign in with your new password.';
    }
  });

  async function handleLogin() {
    loading = true;
    errorMessage = '';
    successMessage = '';

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        errorMessage = error.message;
      } else {
              
        // Sync local search history to Supabase
        await searchHistory.syncToSupabase();
        navigate('/');
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <h1>Welcome Back</h1>
      <p class="subtitle">Sign in to retrieve your search history</p>
    </div>

    {#if errorMessage}
      <div class="message error">
        <p>{errorMessage}</p>
      </div>
    {/if}

    {#if successMessage}
      <div class="message success">
        <p>{successMessage}</p>
      </div>
    {/if}

    <form on:submit|preventDefault={handleLogin} class="auth-form">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input 
          type="email" 
          id="email" 
          bind:value={email} 
          required 
          autocomplete="email"
          placeholder="Enter your email address"
        >
      </div>

      <div class="form-group">
        <div class="password-header">
          <label for="password">Password</label>
          <a href="#/reset-password" class="forgot-password" on:click|preventDefault={() => navigate('/reset-password')}>
            Forgot password?
          </a>
        </div>
        <div class="password-input-container">
          <input 
            type={showPassword ? 'text' : 'password'} 
            id="password" 
            bind:value={password} 
            required 
            autocomplete="current-password"
            placeholder="Enter your password"
          >
          <button
            type="button"
            class="password-toggle"
            on:click={() => showPassword = !showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {#if showPassword}
              <span aria-hidden="true">Hide</span>
            {:else}
              <span aria-hidden="true">Show</span>
            {/if}
          </button>
        </div>
      </div>

      <button type="submit" class="auth-button" disabled={loading}>
        {#if loading}
          <span class="loading-spinner"></span>
          Signing in...
        {:else}
          Sign In
        {/if}
      </button>
    </form>

    <div class="auth-footer">
      <p>
        New to Alberta Open Data? 
        <a href="#/signup" on:click|preventDefault={() => navigate('/signup')}>Create an account</a>
      </p>
    </div>
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--spacing-xl) var(--spacing-md);
  }

  .auth-card {
    width: 100%;
    max-width: 450px;
    background-color: var(--color-background-alt);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    padding: var(--spacing-xl);
    border: 1px solid var(--color-border);
  }

  .auth-header {
    text-align: center;
    margin-bottom: var(--spacing-xl);
  }

  .auth-header h1 {
    margin-bottom: var(--spacing-sm);
  }

  .subtitle {
    color: var(--color-text-light);
    margin-bottom: 0;
  }

  .auth-form {
    margin-bottom: var(--spacing-xl);
  }

  .message {
    padding: var(--spacing-md);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
  }

  .error {
    background-color: rgba(220, 53, 69, 0.1);
    border: 1px solid rgba(220, 53, 69, 0.2);
    color: #dc3545;
  }

  .success {
    background-color: rgba(40, 167, 69, 0.1);
    border: 1px solid rgba(40, 167, 69, 0.2);
    color: #28a745;
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .password-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }

  .forgot-password {
    font-size: 0.9rem;
  }

  .auth-button {
    width: 100%;
    padding: var(--spacing-md);
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-weight: var(--font-weight-medium);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-lg);
  }

  .loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-footer {
    text-align: center;
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    margin-top: var(--spacing-xl);
  }

  @media (max-width: 768px) {
    .auth-card {
      box-shadow: none;
      border: none;
      padding: var(--spacing-md);
    }
  }
</style>
