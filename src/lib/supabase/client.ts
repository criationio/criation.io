import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

import { env } from '@/env'

/**
 * Supabase client para Client Components.
 * Usa cookies do browser para sessao via @supabase/ssr.
 */
export function createBrowserClient() {
  return createSSRBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
