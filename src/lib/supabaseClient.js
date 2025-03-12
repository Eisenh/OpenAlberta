import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lpajogamsldueqilqisl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwYWpvZ2Ftc2xkdWVxaWxxaXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2MjUwMDgsImV4cCI6MjA1NzIwMTAwOH0.8csrjlRnGb26bmCNlm_LsZ5VJ4-KUjwyoahxDh-G0iE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
