import Landing from './src/lib/pages/Landing.svelte';
import Admin from './src/lib/pages/Admin.svelte';
import UserProfile from './src/lib/pages/UserProfile.svelte';
import Login from './src/lib/pages/Login.svelte';
import SignUp from './src/lib/pages/SignUp.svelte';
import ResetPassword from './src/lib/pages/ResetPassword.svelte';
import VerifyEmail from './src/lib/pages/VerifyEmail.svelte';
import Help from './src/lib/pages/Help.svelte';
import Terms from './src/lib/pages/Terms_of_service.svelte';

export const routes = {
  '/': Landing,
  '/admin': Admin,
  '/profile': UserProfile,
  '/login': Login,
  '/signup': SignUp,
  '/reset-password': ResetPassword,
  '/verify-email': VerifyEmail,
  '/help': Help,
  '/terms': Terms
};
