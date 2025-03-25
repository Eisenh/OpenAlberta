<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { supabase } from '../supabaseClient.js';
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
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
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
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="auth-header">
      <h1>Create Account</h1>
      <p class="subtitle">Sign up to store your search history, and to use advanced features</p>
      <p> There are no advanced features yet ;)</p>
       <p>To be clear - no account is needed to use the app, and your browser local storage will still keep you search history until you clear the cache.</p>
  
    </div>

    {#if errorMessage}
      <div class="message error">
        <p>{errorMessage}</p>
      </div>
    {/if}

    {#if successMessage}
      <div class="message success">
        <p>{successMessage}</p>
        {#if data?.user?.identities?.length === 0}
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
        {/if}
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

    <div class="auth-footer">
      <p>
        Already have an account? 
        <a href="/login" on:click|preventDefault={() => navigate('/login')}>Sign in</a>
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
</style>
