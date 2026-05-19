import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { env } from '@/env'

/**
 * Refresh dos cookies de sessao Supabase. Chamado pelo middleware raiz.
 * Retorna NextResponse com cookies atualizados e o user revalidado
 * (ou null se nao autenticado).
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() forca refresh do JWT se expirado.
  // Nao colocar nada entre createServerClient e getUser per docs Supabase SSR.
  const { data } = await supabase.auth.getUser()

  return { response, user: data.user }
}
