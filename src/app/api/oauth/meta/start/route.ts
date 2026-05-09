import { type NextRequest, NextResponse } from 'next/server'

import { env } from '@/env'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { generateState } from '@/lib/services/oauth-state.service'
import { META_SCOPES } from '@/lib/services/meta.service'
import { getUser } from '@/lib/supabase/server'

function fbOauthDialogUrl(): string {
  return `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`
}

function buildRedirectUri(req: NextRequest): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  return `${base.replace(/\/$/, '')}/api/oauth/meta/callback`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get('returnTo') ?? '/configuracoes/conexoes'

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    authLogger.warn({ userId: user.id }, 'oauth meta start sem workspace')
    return NextResponse.redirect(new URL('/bem-vindo', req.url))
  }

  const stateToken = await generateState('meta', {
    userId: user.id,
    workspaceId,
    returnTo,
  })

  const redirectUri = buildRedirectUri(req)
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: redirectUri,
    state: stateToken,
    scope: META_SCOPES.join(','),
    response_type: 'code',
  })

  authLogger.info({ workspaceId }, 'oauth meta start')
  return NextResponse.redirect(`${fbOauthDialogUrl()}?${params.toString()}`)
}
