import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for server-side use only. Bypasses RLS - never
 * import this from anything that ships to the browser (only /api routes).
 */
export function getServiceClient() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}
