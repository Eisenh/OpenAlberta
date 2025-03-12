import Landing from './src/lib/pages/Landing.svelte';
import Admin from './src/lib/pages/Admin.svelte';
import UserProfile from './src/lib/pages/UserProfile.svelte';
import Login from './src/lib/pages/Login.svelte';
import SignUp from './src/lib/pages/SignUp.svelte';

export const routes = {
  '/': Landing,
  '/admin': Admin,
  '/profile': UserProfile,
  '/login': Login,
  '/signup': SignUp
};
