<script>
  import { supabase } from './lib/supabaseClient';
  import { onMount } from 'svelte';

  let session = null;
  let loading = false;
  let email = '';
  let password = '';

  onMount(async () => {
    // Check if there's an existing session
    const { data: { session: initialSession } } = await supabase.auth.getSession();
    session = initialSession;

    supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        session = _session;
      }
    });
  });

  async function signIn() {
    loading = true;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) throw error;
      alert('Signed in successfully!');
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      loading = false;
    }
  }

  async function signOut() {
    loading = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      alert(error.error_description || error.message);
    } finally {
      loading = false;
    }
  }
</script>

{#if session}
  <p>You are signed in as {session.user.email}</p>
  <button on:click={signOut} disabled={loading}>Sign Out</button>
  <h2>Admin Content</h2>
  <p>This is where admin-specific content will go.</p>
{:else}
  <div>
    <input type="email" bind:value={email} placeholder="Email" />
    <input type="password" bind:value={password} placeholder="Password" />
    <button on:click={signIn} disabled={loading}>Sign In</button>
  </div>
{/if}
