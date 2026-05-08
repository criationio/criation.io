import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { env } from '@/env'

/**
 * Supabase client para Server Components, Server Actions e Route Handlers.
 * Le e escreve cookies de sessao via next/headers, anon key.
 */
export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components nao podem setar cookies.
          // O middleware refresca o cookie no proximo request.
        }
      },
    },
  })
}

/**
 * Service-role client. Bypassa RLS — ADR-009.
 * Uso permitido apenas em:
 *   - Jobs Trigger.dev backend
 *   - Admin actions com audit log obrigatorio
 * Qualquer outro uso requer ADR aprovado.
 */
export function createServiceClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Le user atual via Auth Server (revalida JWT).
 * Use em vez de getSession() em rotas autenticadas.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

/**
 * Le sessao local (cookie). Mais rapido que getUser, mas nao revalida.
 * Use apenas quando o caller ja confiou no JWT.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
