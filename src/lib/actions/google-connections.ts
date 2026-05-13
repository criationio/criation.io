'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { env } from '@/env'
import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import {
  softDeleteGoogleConnection,
  getActiveGoogleConnectionByWorkspace,
} from '@/lib/db/queries/google-connections'
import { buildAuthUrl, generatePkcePair, GOOGLE_OAUTH_SCOPES } from '@/lib/services/google.service'
import { generateState } from '@/lib/services/oauth-state.service'
import { getUser } from '@/lib/supabase/server'

export type GoogleActionResult =
  | { ok: true; redirectUrl?: string }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_CONFIGURED' | 'NOT_FOUND' | 'INTERNAL'
        message: string
      }
    }

async function getCurrentWorkspaceId(): Promise<string | null> {
  const user = await getUser()
  if (!user) return null
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (userRow?.defaultWorkspaceId) return userRow.defaultWorkspaceId
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  })
  return membership?.workspaceId ?? null
}

function buildRedirectUri(): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/oauth/google/callback`
}

/**
 * Inicia fluxo OAuth Google. Gera PKCE pair (verifier persistido em Upstash
 * via oauth-state, challenge SHA-256 no URL) + state CSRF. Retorna URL pra
 * cliente redirecionar.
 *
 * Scopes pedidos: auth/datamanager + auth/adwords + auth/cloud-platform +
 * openid/email/profile (ADR-015 — 3 sensitive scopes na mesma consent screen).
 */
export async function initiateGoogleConnect(input?: {
  returnTo?: string
}): Promise<GoogleActionResult> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return {
      ok: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'OAuth Google nao esta configurado neste ambiente',
      },
    }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return {
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'workspace nao encontrado' },
    }
  }

  const { codeVerifier, codeChallenge } = generatePkcePair()

  const stateToken = await generateState('google', {
    userId: user.id,
    workspaceId,
    returnTo: input?.returnTo ?? '/configuracoes/google/conversoes',
    codeVerifier,
  })

  const authUrl = buildAuthUrl({
    state: stateToken,
    codeChallenge,
    redirectUri: buildRedirectUri(),
  })

  authLogger.info({ workspaceId, scopes: GOOGLE_OAUTH_SCOPES.length }, 'google oauth iniciado')

  return { ok: true, redirectUrl: authUrl }
}

/**
 * Desconecta Google (soft-delete). UI mostra "reconectar" depois disso.
 * Tokens encriptados permanecem na tabela mas connection nao e mais ativa.
 */
export async function disconnectGoogle(): Promise<GoogleActionResult> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }
  const connection = await getActiveGoogleConnectionByWorkspace(workspaceId)
  if (!connection) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'conexao Google nao encontrada' } }
  }
  await softDeleteGoogleConnection(workspaceId)
  authLogger.info({ workspaceId, connectionId: connection.id }, 'google connection disconnected')
  revalidatePath('/configuracoes/conexoes')
  revalidatePath('/configuracoes/google/conversoes')
  return { ok: true }
}
