import { createClient } from '@supabase/supabase-js'
import { session } from './stores/session'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Initialize auth state listener
supabase.auth.onAuthStateChange((event, newSession) => {
  session.set(newSession)
})

// Get initial session
supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
  session.set(initialSession)
})
