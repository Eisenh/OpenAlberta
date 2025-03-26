<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { supabase } from '../supabaseClient.js';
  import { navigate } from '../stores/route.js';

  let loading = true;
  let errorMessage = '';
  let successMessage = '';
  let email = '';

  onMount(async () => {
    // Check if we have an access token in the URL (for email verification)
    // The hash format will be like #/verify-email#access_token=xxx&type=email
    const hash = window.location.hash;
    const tokenMatch = hash.match(/access_token=([^&]+)/);
    const typeMatch = hash.match(/type=([^&]+)/);

    if (tokenMatch && tokenMatch[1] && typeMatch && typeMatch[1] === 'email') {
      // Clean up the URL by removing the access token
      const newHash = '#/verify-email';
      window.history.replaceState(null, '', newHash);

      try {
        // Get the user's session (should be created by the verification link)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          errorMessage = 'Error verifying email: ' + sessionError.message;
        } else if (session) {
          // Email verification was successful
          successMessage = 'Email verified successfully!';
          email = session.user?.email || '';
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          errorMessage = 'Email verification failed. Please try again or request a new verification link.';
        }
      } catch (error) {
        errorMessage = 'An unexpected error occurred: ' + error.message;
      }
    } else {
      errorMessage = 'Invalid verification link. Please use the link sent to your email.';
    }
    
    loading = false;
  });

  async function handleResendVerification() {
    if (!email) {
      errorMessage = 'Please enter your email address to resend the verification.';
      return;
    }

    loading = true;
    errorMessage = '';
    successMessage = '';

    try {
      // Use the base path from vite.config.js
      const basePath = '/OpenAlberta';
      
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
        successMessage = 'Verification email resent! Please check your inbox.';
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
      <h1>Email Verification</h1>
      
      {#if loading}
        <p class="subtitle">Verifying your email...</p>
      {:else if successMessage}
        <p class="subtitle">Your account is now verified</p>
      {:else}
        <p class="subtitle">There was a problem verifying your email</p>
      {/if}
    </div>

    {#if loading}
      <div class="loading-container">
        <div class="loading-spinner large"></div>
        <p>Please wait while we verify your email...</p>
      </div>
    {:else}
      {#if errorMessage}
        <div class="message error">
          <p>{errorMessage}</p>
        </div>
      {/if}

      {#if successMessage}
        <div class="message success">
          <p>{successMessage}</p>
          <p>You will be redirected to login shortly...</p>
        </div>
      {/if}

      {#if errorMessage}
        <div class="resend-section">
          <h3>Didn't receive or having trouble with the verification link?</h3>
          <p>Enter your email below to resend the verification:</p>
          
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

          <button 
            on:click={handleResendVerification}
            class="auth-button" 
            disabled={loading}
          >
            {#if loading}
              <span class="loading-spinner"></span>
              Sending...
            {:else}
              Resend Verification Email
            {/if}
          </button>
        </div>
      {/if}

      <div class="auth-footer">
        <p>
          {#if successMessage}
            Want to login now? 
            <a href="#/login" on:click|preventDefault={() => navigate('/login')}>Go to Login</a>
          {:else}
            Back to 
            <a href="#/login" on:click|preventDefault={() => navigate('/login')}>Login</a>
            or
            <a href="#/signup" on:click|preventDefault={() => navigate('/signup')}>Sign Up</a>
          {/if}
        </p>
      </div>
    {/if}
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

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xl) 0;
    text-align: center;
  }

  .loading-spinner {
    display: inline-block;
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid rgba(11, 79, 113, 0.3);
    border-radius: 50%;
    border-top-color: var(--color-primary);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: var(--spacing-md);
  }

  .loading-spinner.large {
    width: 3rem;
    height: 3rem;
    border-width: 3px;
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

  .resend-section {
    background-color: rgba(0, 123, 255, 0.05);
    border-radius: var(--border-radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    border: 1px solid rgba(0, 123, 255, 0.1);
  }

  .resend-section h3 {
    margin-top: 0;
    font-size: 1.1rem;
    margin-bottom: var(--spacing-sm);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
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
    margin-top: var(--spacing-md);
  }

  .auth-footer {
    text-align: center;
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    margin-top: var(--spacing-xl);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .auth-card {
      box-shadow: none;
      border: none;
      padding: var(--spacing-md);
    }
  }
</style>
