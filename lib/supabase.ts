import { createClient } from '@supabase/supabase-js'

// Public (anon) credentials only. Never use the service_role key in this app.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// null when the env vars are missing: the booking store then falls back to the mock.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
