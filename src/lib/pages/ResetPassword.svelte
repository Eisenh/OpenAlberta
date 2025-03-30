<script>
  // @ts-nocheck - Svelte 5 TypeScript definition issues
  import { onMount } from 'svelte';
  import { supabase } from '../supabaseClient.js';
  import { navigate, getParameterByName, handleUrl } from '../stores/route.js';

  // State variables
  let email = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let errorMessage = '';
  let successMessage = '';
  let view = 'request'; // 'request' or 'reset'
  let accessToken = null;
  let tokenType = null;
  let authType = null;
  let refresh_token = null;

  onMount(async () => {
    // Check if we have an access token in the URL (for password reset)// Check for Supabase auth tokens
    //const initialHash = window.location.hash;
    let initialHash = window.location.hash.substring(1); // remove leading #
        let hashQuery = initialHash.replace('#','?');
    console.log("ResetPW initialHash: ", initialHash);
    
        // 1. Find the position of the '?' within the hash
    const questionMarkIndex = initialHash.indexOf('?');

    if (questionMarkIndex !== -1) {
      // 2. Extract the query parameter string
      const queryString = initialHash.substring(questionMarkIndex + 1);

      // 3. Parse the query parameters using URLSearchParams
      const params = new URLSearchParams(queryString);

      // 4. Access the parameter values
      tokenType = params.get('token_type');
      authType = params.get('type');
      accessToken = params.get('access_token');
      refresh_token = params.get('refresh_token');
      let error = null;
      console.log("token: ", accessToken);
      console.log('token_type:', tokenType);
      console.log('authType:', authType);
      console.log("reresh_token: ",refresh_token);

      // Do something with the parameters...
      
      if (accessToken && authType === 'recovery') {
        console.log("Found password reset token in URL");
        view = 'reset';
        
        //const { error } = await supabase.auth.exchangeCodeForSession({ accessToken, refresh_token });
          
        if (error) {
          console.error('Error setting session:', error.message);
        } else {
          console.log('Session set, user authenticated.');
        }
      } else if (accessToken) {
        console.error("Invalid token auth type:", authType);
        errorMessage = 'Invalid password reset link';
        view = 'request';
      } else {
        console.log("No access token found in URL");
      }

        
    } else {
        console.log('No query parameters found in the hash.');
    }
 
  });

  async function handleRequestReset() {
    loading = true;
    errorMessage = '';
    successMessage = '';

    try {
      // Get the base path from environment variable
      const basePath = import.meta.env.VITE_GITHUB_PAGES || '';
      
      // Make sure the redirectTo URL includes the base path
      // This needs to be the FULL URL including domain for Supabase auth
      const fullRedirectUrl = `${window.location.origin}${basePath}/#/reset-password`;
      console.log("Reset password ", basePath, " redirect URL:", fullRedirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: fullRedirectUrl,
      });

      if (error) {
        errorMessage = error.message;
      } else {
        successMessage = 'Password reset instructions sent! Please check your email.';
        email = '';
      }
    } catch (error) {
      errorMessage = error.message;
    } finally {
      loading = false;
    }
  }

  const handleSubmit = async (e) => { 
    e.preventDefault();
    let error
    //let signInError = null;
    if (!accessToken) {
      error = 'Access token is missing.';
      return;
    }
            
    // Sign in the user with the access token

            
    const { user, error: signInError } = await supabase.auth.signIn({access_token: accessToken});
            
    if (signInError) {
      error = signInError.message;            
      return;
    }
            
    // Now update the password

            
    const { error: resetError } = await supabase.auth.update({password: newPassword});
            
    if (resetError) {
      error = resetError.message;
    } else {
      success = true;
    }
  };

  async function handleResetPassword() {
    let loading = true;
    let errorMessage = '';
    let successMessage = '';
    let error = null;
    

    if (password !== confirmPassword) {
      errorMessage = 'Passwords do not match';
      loading = false;
      return;
    }

    try {


      if (!accessToken) {
        errorMessage = 'Access token is missing.';
        console.log("reset 153 ", errorMessage);
        //return;  // don't need acess token here if already signed in.
      }
      
      const { user, error: signInError } = await supabase.auth.signIn({ access_token: accessToken });
      console.log("Signed in w token". user, " signin errror: ", error);
      if (signInError) {
        console.log("Reset - Error with sign-in")
        error = signInError.message;
        return  ;
      }
      
      console.log("Resetting with: ",password," pwd ",supabase.auth)
      const { error: resetError } = await supabase.auth.updateUser({ password: password });
      if (resetError) {
        console.log("Reset - Error with update: ", resetError.message);
        errorMessage = resetError.message;
      } 
      else {  
        success = true;  
        successMessage = 'Password updated successfully!';
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    
    } catch (error) {
      errorMessage = error.message || 'Password reset failed. Please request a new link.';
      console.error('Password reset error:', error);
    } finally {
      loading = false;
    }
  }

  function toggleView() {
    view = view === 'request' ? 'reset' : 'request';
    errorMessage = '';
    successMessage = '';
  }

  async function signInWithToken(accessToken) {
    // Sign in the user with the access token

    const { user, error: signInError } = await supabase.auth.signIn({ access_token: accessToken });
    console.log("Signed in w token". user, " signin errror: ", error);

    if (signInError) {
      console.log("Reset - Error with sign-in")
      error = signInError.message;
      return  ;
    }
    return user;
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    {#if view === 'request'}
      <div class="auth-header">
        <h1>Reset Password</h1>
        <p class="subtitle">Enter your email to receive password reset instructions</p>
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

      <form on:submit|preventDefault={handleRequestReset} class="auth-form">
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

        <button type="submit" class="auth-button" disabled={loading}>
          {#if loading}
            <span class="loading-spinner"></span>
            Sending...
          {:else}
            Send Reset Instructions
          {/if}
        </button>
      </form>

      <div class="auth-footer">
        <p>
          Remembered your password? 
          <a href="#/login" on:click|preventDefault={() => navigate('/login')}>Back to Login</a>
        </p>
      </div>
    {:else}
      <div class="auth-header">
        <h1>Set New Password</h1>
        <p class="subtitle">Please enter and confirm your new password</p>
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

      <form on:submit|preventDefault={handleResetPassword} class="auth-form">
        <div class="form-group">
          <label for="password">New Password</label>
          <input 
            type="password" 
            id="password" 
            bind:value={password} 
            required 
            minlength="6" 
            autocomplete="new-password"
            placeholder="Enter your new password"
          >
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input 
            type="password" 
            id="confirmPassword" 
            bind:value={confirmPassword} 
            required 
            minlength="6" 
            autocomplete="new-password"
            placeholder="Confirm your new password"
          >
        </div>

        <div class="password-requirements">
          <p>Password requirements:</p>
          <ul>
            <li>Minimum 6 characters</li>
            <li>Both passwords must match</li>
          </ul>
        </div>

        <button type="submit" class="auth-button" disabled={loading}>
          {#if loading}
            <span class="loading-spinner"></span>
            Updating...
          {:else}
            Update Password
          {/if}
        </button>
      </form>

      <div class="auth-footer">
        <p>
          Need to start over? 
          <a href="#/reset-password" on:click|preventDefault={() => navigate('/reset-password')}>Request New Link</a>
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

  .auth-form {
    margin-bottom: var(--spacing-xl);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
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
