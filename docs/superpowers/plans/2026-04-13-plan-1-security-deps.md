# Security Migration + Dependency Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace leaked Supabase anon key with publishable key, convert touched files to TypeScript, add Google OAuth, and clean up unused dependencies.

**Architecture:** Single-file Supabase client swap — all pages get the fix automatically. OAuth adds two buttons (Login + SignUp). Dependency migration swaps `@xenova/transformers` for `@huggingface/transformers` (same API, new package name).

**Tech Stack:** Svelte 5, Vite, `@supabase/supabase-js` v2, `@huggingface/transformers` v3

**Note on testing:** No test framework exists in this project. Each task includes a manual smoke-test step instead of automated tests. Do not add a test framework — it is out of scope.

---

## File Map

| Action | File | Change |
|---|---|---|
| Rename + rewrite | `src/lib/supabaseClient.js` → `supabaseClient.ts` | publishable key, `createBrowserClient` |
| Rename | `routes.js` → `routes.ts` | TypeScript types only |
| Update import | `src/lib/pages/Admin.svelte` | remove `.js` extension |
| Update import | `src/lib/pages/Login.svelte` | remove `.js` extension + OAuth button |
| Update import | `src/lib/pages/ResetPassword.svelte` | remove `.js` extension |
| Update import | `src/lib/pages/SignUp.svelte` | remove `.js` extension + OAuth button |
| Update import | `src/lib/pages/UserProfile.svelte` | remove `.js` extension |
| Update import | `src/lib/pages/VerifyEmail.svelte` | remove `.js` extension |
| Update import | `src/lib/pages/Landing.svelte` | `@huggingface/transformers` |
| Update | `package.json` | remove dead deps, add `@huggingface/transformers` |
| Update | `.env_local` | new key names |

---

## Task 1: Update environment variables

**Files:**

- Modify: `.env_local`

- [ ] **Step 1: Update `.env_local`**

  Open `.env_local` and rename the Supabase key variable. The file should contain:

  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
  ```

  Remove the line `VITE_SUPABASE_ANON_KEY=...` entirely. The publishable key is found in your Supabase dashboard under **Settings → API → Project API keys → publishable**.

  Do not commit `.env_local` — it is already in `.gitignore` (listed as untracked in git status).

- [ ] **Step 2: Verify `.env_local` is not tracked**

  ```bash
  git status
  ```

  Expected: `.env_local` appears under "Untracked files", not under "Changes to be committed".

---

## Task 2: Replace Supabase client file

**Files:**

- Create: `src/lib/supabaseClient.ts`
- Delete: `src/lib/supabaseClient.js`

- [ ] **Step 1: Create `src/lib/supabaseClient.ts`**

  ```typescript
  import { createBrowserClient } from '@supabase/supabase-js'
  import { session } from './stores/session'

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables. Check .env_local.')
  }

  export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.set(newSession)
  })

  supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
    session.set(initialSession)
  })
  ```

  > **If `createBrowserClient` is not exported from `@supabase/supabase-js`:** Use `createClient` instead — same arguments, same result. The publishable key is what matters for security, not the function name.

- [ ] **Step 2: Delete the old file**

  ```bash
  rm src/lib/supabaseClient.js
  ```

- [ ] **Step 3: Start dev server and verify no import errors**

  ```bash
  npm run dev
  ```

  Expected: Dev server starts. Browser console should not show "Missing Supabase environment variables."

---

## Task 3: Fix explicit `.js` import extensions

Six files import `supabaseClient.js` with an explicit `.js` extension. TypeScript won't resolve these to `.ts` with explicit extensions.

**Files:**

- Modify: `src/lib/pages/Admin.svelte:3`
- Modify: `src/lib/pages/Login.svelte:4`
- Modify: `src/lib/pages/ResetPassword.svelte:4`
- Modify: `src/lib/pages/SignUp.svelte:3`
- Modify: `src/lib/pages/UserProfile.svelte:4`
- Modify: `src/lib/pages/VerifyEmail.svelte:4`

- [ ] **Step 1: Update each file's import**

  In each of the six files above, change:

  ```javascript
  import { supabase } from '../supabaseClient.js';
  ```

  To:

  ```javascript
  import { supabase } from '../supabaseClient';
  ```

  Note: `src/lib/pages/Landing.svelte`, `src/lib/components/Header.svelte`, and `src/lib/stores/searchHistory.js` already use extensionless imports — leave them unchanged.

- [ ] **Step 2: Verify dev server still runs cleanly**

  The dev server from Task 2 should still be running. Check browser console for import errors — there should be none.

---

## Task 4: Rename `routes.js` to `routes.ts`

**Files:**

- Create: `routes.ts`
- Delete: `routes.js`

- [ ] **Step 1: Create `routes.ts`**

  ```typescript
  import type { ComponentType } from 'svelte'
  import Landing from './src/lib/pages/Landing.svelte'
  import Admin from './src/lib/pages/Admin.svelte'
  import UserProfile from './src/lib/pages/UserProfile.svelte'
  import Login from './src/lib/pages/Login.svelte'
  import SignUp from './src/lib/pages/SignUp.svelte'
  import ResetPassword from './src/lib/pages/ResetPassword.svelte'
  import VerifyEmail from './src/lib/pages/VerifyEmail.svelte'
  import Help from './src/lib/pages/Help.svelte'
  import Terms from './src/lib/pages/Terms_of_service.svelte'

  export const routes: Record<string, ComponentType> = {
    '/': Landing,
    '/admin': Admin,
    '/profile': UserProfile,
    '/login': Login,
    '/signup': SignUp,
    '/reset-password': ResetPassword,
    '/verify-email': VerifyEmail,
    '/help': Help,
    '/terms': Terms,
  }
  ```

- [ ] **Step 2: Delete the old file**

  ```bash
  rm routes.js
  ```

- [ ] **Step 3: Update the import in `src/App.svelte`**

  `src/App.svelte` currently imports from `'../routes'`. Check it still resolves:

  ```bash
  grep "routes" src/App.svelte
  ```

  Expected output: `import { routes } from '../routes';`

  This extensionless import resolves to `routes.ts` automatically — no change needed.

- [ ] **Step 4: Verify dev server — navigate to `/`, `/login`, `/admin`**

  In browser: navigate to each route and confirm pages load without errors.

---

## Task 5: Dependency cleanup

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Remove unused packages and add `@huggingface/transformers`**

  ```bash
  npm uninstall @tensorflow/tfjs tfjs svelte-routing
  npm install @huggingface/transformers
  ```

  Expected: No peer dependency errors. `package.json` should no longer contain `@tensorflow/tfjs`, `tfjs`, or `svelte-routing`.

- [ ] **Step 2: Update the transformers import in `Landing.svelte`**

  In `src/lib/pages/Landing.svelte`, line 10, change:

  ```javascript
  import { pipeline, env } from "@xenova/transformers";
  ```

  To:

  ```javascript
  import { pipeline, env } from "@huggingface/transformers";
  ```

  The `pipeline` call on line 267 does not need to change — the model ID `'Xenova/all-MiniLM-L6-v2'` is a Hugging Face Hub path and remains valid.

- [ ] **Step 3: Remove `@xenova/transformers`**

  ```bash
  npm uninstall @xenova/transformers
  ```

- [ ] **Step 4: Smoke test the embedding pipeline**

  Start the dev server, navigate to the home page, and run a search query. Expected: the model loads (progress shown in UI) and search results appear. If the model fails to load, check the browser console — the error will indicate whether it's a package resolution issue or a network issue fetching the model weights.

---

## Task 6: Add Google OAuth to Login page

**Files:**

- Modify: `src/lib/pages/Login.svelte`

- [ ] **Step 1: Prerequisite — configure Google OAuth in Supabase dashboard**

  Before writing any code, complete this in the Supabase dashboard:
  1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
  2. Application type: Web application
  3. Authorised redirect URIs: `https://your-project.supabase.co/auth/v1/callback`
  4. Copy the Client ID and Client Secret
  5. In Supabase dashboard → Authentication → Providers → Google → enable and paste credentials
  6. Save

  This step has no code — it is a prerequisite.

- [ ] **Step 2: Add OAuth handler to `Login.svelte` script block**

  In `src/lib/pages/Login.svelte`, add after the `handleLogin` function (before `</script>`):

  ```javascript
  async function handleGoogleLogin() {
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
    // On success, browser redirects — no need to set loading = false
  }
  ```

- [ ] **Step 3: Add OAuth button to `Login.svelte` template**

  After the closing `</form>` tag and before `<div class="auth-footer">`, add:

  ```html
  <div class="oauth-divider">
    <span>or</span>
  </div>

  <button
    type="button"
    class="oauth-button"
    on:click={handleGoogleLogin}
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
  ```

- [ ] **Step 4: Add styles to `Login.svelte` `<style>` block**

  ```css
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
  ```

---

## Task 7: Add Google OAuth to SignUp page

**Files:**

- Modify: `src/lib/pages/SignUp.svelte`

- [ ] **Step 1: Add OAuth handler to `SignUp.svelte` script block**

  In `src/lib/pages/SignUp.svelte`, add after the `handleSignUp` function (before `</script>`):

  ```javascript
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
  ```

- [ ] **Step 2: Add OAuth button to `SignUp.svelte` template**

  After the closing `</form>` tag and before `<div class="auth-footer">`, add:

  ```html
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
  ```

- [ ] **Step 3: Add same OAuth styles to `SignUp.svelte` `<style>` block**

  ```css
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
  ```

---

## Task 8: Full smoke test

- [ ] **Step 1: Run dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Verify auth flows**

  - Navigate to `/login` — confirm "Continue with Google" button appears
  - Navigate to `/signup` — confirm "Continue with Google" button appears
  - Test email/password login with an existing account — confirm it works
  - Test Google OAuth — clicking the button should redirect to Google's consent screen

- [ ] **Step 3: Verify search still works**

  Navigate to `/`. Type a search query. Confirm the model loads and results appear.

- [ ] **Step 4: Verify no console errors**

  Open browser DevTools → Console. Confirm no errors related to Supabase keys, missing imports, or transformers.

---

## Task 9: Commit

- [ ] **Step 1: Stage and commit**

  ```bash
  git add \
    src/lib/supabaseClient.ts \
    routes.ts \
    src/lib/pages/Admin.svelte \
    src/lib/pages/Login.svelte \
    src/lib/pages/ResetPassword.svelte \
    src/lib/pages/SignUp.svelte \
    src/lib/pages/UserProfile.svelte \
    src/lib/pages/VerifyEmail.svelte \
    src/lib/pages/Landing.svelte \
    package.json \
    package-lock.json

  git rm src/lib/supabaseClient.js routes.js

  git commit -m "feat: security migration — publishable key, TypeScript, OAuth, dep cleanup"
  ```

---

**Next:** [Plan 2 — Database Schema](2026-04-13-plan-2-schema.md)
