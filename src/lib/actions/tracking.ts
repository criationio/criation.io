'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { connections } from '@/lib/db/schema/connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'
import { getActiveConnection } from '@/lib/db/queries/connections'

const CDP_PROVIDER = 'criation_cdp'
const CDP_TYPE = 'analytics' as const

export interface TrackingConfig {
  originAllowlist: string[]
  installedAt: string | null
  /** Após esta data, `validateOrigin` enforce allowlist. Default = installedAt + 7d. */
  gracePeriodEndsAt: string | null
}

interface Ok<T> {
  ok: true
  data: T
}
interface Err {
  ok: false
  error: { code: string; message: string }
}
type Result<T> = Ok<T> | Err

async function resolveWorkspaceId(): Promise<Result<string>> {
  const user = await getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Login necessário' } }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    return { ok: false, error: { code: 'NO_WORKSPACE', message: 'Workspace não encontrado' } }
  }
  return { ok: true, data: workspaceId }
}

function parseConfig(raw: unknown): TrackingConfig {
  if (!raw || typeof raw !== 'object') {
    return { originAllowlist: [], installedAt: null, gracePeriodEndsAt: null }
  }
  const obj = raw as Record<string, unknown>
  const allowlist = Array.isArray(obj.originAllowlist)
    ? (obj.originAllowlist.filter((v) => typeof v === 'string') as string[])
    : []
  const installedAt = typeof obj.installedAt === 'string' ? obj.installedAt : null
  const gracePeriodEndsAt = typeof obj.gracePeriodEndsAt === 'string' ? obj.gracePeriodEndsAt : null
  return { originAllowlist: allowlist, installedAt, gracePeriodEndsAt }
}

/**
 * Idempotente. Cria a row em `connections` (type='analytics' provider='criation_cdp')
 * se nao existir — sinaliza que workspace passou pela tela de tracking ao menos
 * uma vez. NAO cria credentials (CDP nao tem OAuth) — `encryptedCredentials` e
 * nullable desde migration 0010.
 */
export async function ensureTrackingConnection(): Promise<Result<{ connectionId: string }>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const existing = await getActiveConnection(ws.data, CDP_PROVIDER, CDP_TYPE)
  if (existing) return { ok: true, data: { connectionId: existing.id } }

  const now = new Date()
  // Grace period: cliente tem 7d a partir do install pra configurar allowlist.
  // Depois disso `validateOrigin` passa a exigir match. Fix A1 da auditoria.
  const gracePeriodEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [row] = await db
    .insert(connections)
    .values({
      workspaceId: ws.data,
      type: CDP_TYPE,
      provider: CDP_PROVIDER,
      encryptedCredentials: null,
      status: 'active',
      config: {
        originAllowlist: [],
        installedAt: now.toISOString(),
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
      },
    })
    .returning({ id: connections.id })

  if (!row) {
    return { ok: false, error: { code: 'INSERT_FAILED', message: 'Falha ao criar conexão' } }
  }
  return { ok: true, data: { connectionId: row.id } }
}

export async function getTrackingConfig(): Promise<Result<TrackingConfig>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const connection = await getActiveConnection(ws.data, CDP_PROVIDER, CDP_TYPE)
  if (!connection) {
    return {
      ok: true,
      data: { originAllowlist: [], installedAt: null, gracePeriodEndsAt: null },
    }
  }

  return { ok: true, data: parseConfig(connection.config) }
}

const originSchema = z
  .string()
  .trim()
  .min(3, 'Origin muito curto')
  .max(255, 'Origin muito longo')
  // Aceita: hostnames (cliente.com, app.cliente.com), wildcards (*.cliente.com),
  // localhost, IPv4 (127.0.0.1), opcional porta. Não aceita schemas (http://) — strip antes se vier.
  .regex(
    /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*|localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/i,
    'Formato inválido (ex: app.cliente.com, *.cliente.com, localhost, 127.0.0.1)'
  )

export async function addAllowedOrigin(origin: string): Promise<Result<TrackingConfig>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const parsed = originSchema.safeParse(origin)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID_ORIGIN', message: parsed.error.issues[0]?.message ?? 'Inválido' },
    }
  }

  // Ensure connection exists
  const ensured = await ensureTrackingConnection()
  if (!ensured.ok) return ensured

  const connection = await getActiveConnection(ws.data, CDP_PROVIDER, CDP_TYPE)
  if (!connection) return { ok: false, error: { code: 'NOT_FOUND', message: 'Conexão sumiu' } }

  const current = parseConfig(connection.config)
  if (current.originAllowlist.includes(parsed.data)) {
    return { ok: true, data: current }
  }
  const next: TrackingConfig = {
    ...current,
    originAllowlist: [...current.originAllowlist, parsed.data],
  }

  await db
    .update(connections)
    .set({ config: next })
    .where(
      and(
        eq(connections.workspaceId, ws.data),
        eq(connections.type, CDP_TYPE),
        eq(connections.provider, CDP_PROVIDER),
        isNull(connections.deletedAt)
      )
    )

  revalidatePath('/configuracoes/tracking-script')
  revalidatePath('/configuracoes/conexoes')
  return { ok: true, data: next }
}

export async function removeAllowedOrigin(origin: string): Promise<Result<TrackingConfig>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const connection = await getActiveConnection(ws.data, CDP_PROVIDER, CDP_TYPE)
  if (!connection) {
    return {
      ok: true,
      data: { originAllowlist: [], installedAt: null, gracePeriodEndsAt: null },
    }
  }

  const current = parseConfig(connection.config)
  const next: TrackingConfig = {
    ...current,
    originAllowlist: current.originAllowlist.filter((o) => o !== origin),
  }

  await db
    .update(connections)
    .set({ config: next })
    .where(
      and(
        eq(connections.workspaceId, ws.data),
        eq(connections.type, CDP_TYPE),
        eq(connections.provider, CDP_PROVIDER),
        isNull(connections.deletedAt)
      )
    )

  revalidatePath('/configuracoes/tracking-script')
  revalidatePath('/configuracoes/conexoes')
  return { ok: true, data: next }
}
