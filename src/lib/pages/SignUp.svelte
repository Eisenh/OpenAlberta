<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient';
  import { navigate } from '../stores/route.js';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';

  async function handleResendConfirmation() {
    loading = true;
    try {
      // Get the base path from environment variable
      const basePath = import.meta.env.VITE_GITHUB_PAGES || '';
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          redirectTo: `${window.location.origin}${basePath}/#/verify-email`,
        }
      });

      if (error) {
        errorMessage = error.message;
      } else {
        successMessage = 'Confirmation email resent! Please check your inbox.';
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  async function handleSignUp() {
    loading = true;
    errorMessage = '';
    successMessage = '';

    // Validate password match
    if (password !== confirmPassword) {
      errorMessage = 'Passwords do not match';
      loading = false;
      return;
    }

    try {
      // Sign up with email and password
      // Get the base path from environment variable
      const basePath = import.meta.env.VITE_GITHUB_PAGES || '';
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${basePath}/#/verify-email`
        }
      });

      if (error) {
        errorMessage = error.message;
      } else {
        // Check if email confirmation is required
        if (data?.user?.identities?.length === 0) {
          successMessage = 'This email is already registered.';
        } else {
          successMessage = 'Sign up successful! Please check your email for the confirmation link.';
        }
        // Clear form
        email = '';
        password = '';
        confirmPassword = '';
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  async function handleGoogleSignUp() {
    loading = true;
    errorMessage = '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/#/`
      }
    });
    if (error) {
      errorMessage = error.message;
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <h1>Create Account</h1>
      <p class="subtitle">Sign up to store your search history, and to use advanced features</p>
      <p> There are no advanced features yet ;)</p>
      <p>To be clear - no account is needed to use the app, and your browser local storage will still keep your recent search history until you clear the cache.</p>
      
    </div>

    {#if errorMessage}
      <div class="message error">
        <p>{errorMessage}</p>
      </div>
    {/if}

        {#if successMessage}
          <div class="message success">
            <p>{successMessage}</p>
            <div class="resend-container">
              <p>Didn't receive the confirmation email?</p>
              <button 
                on:click|preventDefault={handleResendConfirmation}
                class="auth-button secondary"
                disabled={loading}
              >
                {#if loading}
                  <span class="loading-spinner"></span>
                  Sending...
                {:else}
                  Resend Confirmation Email
                {/if}
              </button>
            </div>
          </div>
        {/if}

    <form on:submit|preventDefault={handleSignUp} class="auth-form">
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
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          bind:value={password} 
          required 
          minlength="6" 
          autocomplete="new-password"
          placeholder="Create a password (min. 6 characters)"
        >
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input 
          type="password" 
          id="confirmPassword" 
          bind:value={confirmPassword} 
          required 
          minlength="6" 
          autocomplete="new-password"
          placeholder="Repeat your password"
        >
      </div>

      <div class="password-requirements">
        <p>Password requirements:</p>
        <ul>
          <li>Minimum 6 characters</li>
          <li>Both passwords must match</li>
        </ul>
      </div>

      <button type="submit" class="auth-button secondary" disabled={loading}>
        {#if loading}
          <span class="loading-spinner"></span>
          Creating account...
        {:else}
          Create Account
        {/if}
      </button>
    </form>

    <div class="oauth-divider">
      <span>or</span>
    </div>

    <button
      type="button"
      class="oauth-button"
      on:click={handleGoogleSignUp}
      disabled={loading}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </button>

    <div class="auth-footer">
      <p>
        Already have an account? 
        <a href="#/login" on:click|preventDefault={() => navigate('/login')}>Sign in</a>
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

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .password-requirements {
    padding: var(--spacing-md);
    background-color: rgba(61, 108, 81, 0.1);
    border-radius: var(--border-radius-md);
    margin-bottom: var(--spacing-lg);
  }

  .password-requirements p {
    margin-bottom: var(--spacing-xs);
    font-weight: var(--font-weight-medium);
    color: var(--color-secondary);
  }

  .password-requirements ul {
    margin: 0;
    padding-left: var(--spacing-lg);
    color: var(--color-text-light);
    font-size: 0.9rem;
  }

  .password-requirements li {
    margin-bottom: var(--spacing-xs);
  }

  .auth-button {
    width: 100%;
    padding: var(--spacing-md);
    background-color: var(--color-secondary);
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

  .oauth-divider {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
    color: var(--color-text-light);
    font-size: 0.9rem;
  }

  .oauth-divider::before,
  .oauth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--color-border);
  }

  .oauth-button {
    width: 100%;
    padding: var(--spacing-md);
    background-color: var(--color-background-alt);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-weight: var(--font-weight-medium);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-sm);
    cursor: pointer;
    margin-bottom: var(--spacing-md);
  }

  .oauth-button:hover:not(:disabled) {
    background-color: var(--color-border);
  }

  .oauth-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
