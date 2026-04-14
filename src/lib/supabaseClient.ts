import { createClient } from '@supabase/supabase-js'
import { session } from './stores/session'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Check .env_local.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

supabase.auth.onAuthStateChange((_event, newSession) => {
  session.set(newSession)
})

supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
  session.set(initialSession)
})
