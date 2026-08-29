import { createClient } from '@supabase/supabase-js'

// Strip /rest/v1/ suffix if present — the JS SDK constructs its own paths
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseUrl = rawUrl.endsWith('/rest/v1/')
  ? rawUrl.slice(0, -9)
  : rawUrl.endsWith('/rest/v1')
  ? rawUrl.slice(0, -8)
  : rawUrl

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
