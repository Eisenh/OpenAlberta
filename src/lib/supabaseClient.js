import { createClient } from '@supabase/supabase-js'
import { session } from './stores/session'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables. Check that .env file is properly loaded.');
  console.error('If you are running the dev server, try running with "node dev-script.js" instead of "npm run dev".');
} else {
  console.log('Supabase URL ',supabaseUrl,' and Anon Key loaded successfully.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize auth state listener
supabase.auth.onAuthStateChange((event, newSession) => {
  session.set(newSession)
});

// Get initial session
supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
  session.set(initialSession)
});
