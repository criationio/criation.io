'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { env } from '@/env'
import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import {
  getActiveConnection,
  getConnectionById,
  insertConnection,
  softDeleteConnection,
} from '@/lib/db/queries/gateway-connections'
import { encrypt } from '@/lib/encryption'
import { billingLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'
import {
  connectHotmartSchema,
  connectKiwifySchema,
  disconnectGatewaySchema,
} from '@/lib/validators/gateway'

export type GatewayActionError = {
  code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'ALREADY_CONNECTED' | 'INTERNAL'
  message: string
  /** Field-level error from Zod, when applicable. */
  field?: string
}

export type GatewayActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: GatewayActionError }

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

function buildWebhookUrl(provider: 'hotmart' | 'kiwify', connectionId: string): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/api/webhooks/gateway/${provider}/${connectionId}`
}

/**
 * Para Kiwify, anexa `?token=...` ao final da URL — Kiwify entrega o token
 * em query string (ADR-017 dec.2 — camada 1 de validacao). UI mostra a URL
 * COMPLETA pra cliente colar no painel.
 */
function buildKiwifyWebhookUrl(connectionId: string, token: string): string {
  return `${buildWebhookUrl('kiwify', connectionId)}?token=${encodeURIComponent(token)}`
}

/**
 * Conecta Hotmart (MVP — apenas HOTTOK).
 *
 * Fluxo simplificado: cliente cola HOTTOK do painel postback, salvamos
 * cifrado, devolvemos a webhook URL para colar no painel.
 *
 * Smoke test pre-validacao removido — sem REST API no MVP nao temos como
 * validar antecipadamente. A "validacao real" e o primeiro webhook chegar.
 */
export async function connectHotmart(rawInput: unknown): Promise<
  GatewayActionResult<{
    connectionId: string
    webhookUrl: string
  }>
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const parsed = connectHotmartSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const field = firstIssue?.path.join('.')
    return {
      ok: false,
      error: {
        code: 'INVALID',
        message: firstIssue?.message ?? 'input invalido',
        ...(field ? { field } : {}),
      },
    }
  }

  const input = parsed.data

  const existing = await getActiveConnection(workspaceId, 'hotmart')
  if (existing) {
    return {
      ok: false,
      error: {
        code: 'ALREADY_CONNECTED',
        message:
          'Ja existe uma conexao Hotmart ativa neste workspace. Desconecte antes de conectar outra.',
      },
    }
  }

  const encryptedWebhookSecret = encrypt(input.hottok)

  try {
    const row = await insertConnection({
      workspaceId,
      provider: 'hotmart',
      // Mantemos `encryptedCredentials` legacy (NOT NULL no schema) com um
      // marker minimo. Coluna sera removida em PR de cleanup futuro.
      encryptedCredentials: encrypt(JSON.stringify({ sandbox: input.sandbox })),
      encryptionKeyVersion: 'v1',
      webhookSecret: encryptedWebhookSecret,
      apiCredentials: { sandbox: input.sandbox },
      webhookVersion: 'v2',
      status: 'active',
    })

    const webhookUrl = buildWebhookUrl('hotmart', row.id)

    revalidatePath('/configuracoes/gateways')
    revalidatePath('/configuracoes/gateways/hotmart')

    billingLogger.info(
      { workspaceId, connectionId: row.id, sandbox: input.sandbox },
      'connectHotmart: success'
    )

    return { ok: true, data: { connectionId: row.id, webhookUrl } }
  } catch (err) {
    billingLogger.error(
      { workspaceId, err: (err as Error).message },
      'connectHotmart: insert failed'
    )
    return { ok: false, error: { code: 'INTERNAL', message: 'falha ao salvar conexao' } }
  }
}

/**
 * Conecta Kiwify (MVP — apenas token webhook).
 *
 * UX defensiva: nosso wizard gera UUIDv4 e mostra ao cliente pra colar
 * no campo "Token" do painel Kiwify. Cliente pode optar por colar token
 * proprio se ja tiver outra integracao usando a mesma URL.
 *
 * Token e enviado pelo Kiwify em ?token=... na query string (camada 1 de
 * validateSignature). A URL devolvida pelo wizard JA inclui o token.
 */
export async function connectKiwify(rawInput: unknown): Promise<
  GatewayActionResult<{
    connectionId: string
    webhookUrl: string
    token: string
  }>
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const parsed = connectKiwifySchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const field = firstIssue?.path.join('.')
    return {
      ok: false,
      error: {
        code: 'INVALID',
        message: firstIssue?.message ?? 'input invalido',
        ...(field ? { field } : {}),
      },
    }
  }

  const existing = await getActiveConnection(workspaceId, 'kiwify')
  if (existing) {
    return {
      ok: false,
      error: {
        code: 'ALREADY_CONNECTED',
        message:
          'Ja existe uma conexao Kiwify ativa neste workspace. Desconecte antes de conectar outra.',
      },
    }
  }

  const token = parsed.data.webhookToken
  const encryptedWebhookSecret = encrypt(token)

  try {
    const row = await insertConnection({
      workspaceId,
      provider: 'kiwify',
      // Compat com NOT NULL do schema legado — marker minimo
      encryptedCredentials: encrypt(JSON.stringify({ provider: 'kiwify' })),
      encryptionKeyVersion: 'v1',
      webhookSecret: encryptedWebhookSecret,
      apiCredentials: {},
      webhookVersion: 'v1',
      status: 'active',
    })

    const webhookUrl = buildKiwifyWebhookUrl(row.id, token)

    revalidatePath('/configuracoes/gateways')
    revalidatePath('/configuracoes/gateways/kiwify')

    billingLogger.info({ workspaceId, connectionId: row.id }, 'connectKiwify: success')

    return { ok: true, data: { connectionId: row.id, webhookUrl, token } }
  } catch (err) {
    billingLogger.error(
      { workspaceId, err: (err as Error).message },
      'connectKiwify: insert failed'
    )
    return { ok: false, error: { code: 'INTERNAL', message: 'falha ao salvar conexao' } }
  }
}

export async function disconnectGateway(
  rawInput: unknown
): Promise<GatewayActionResult<{ connectionId: string }>> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }
  const parsed = disconnectGatewaySchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID', message: 'connectionId invalido' } }
  }

  const connection = await getConnectionById(parsed.data.connectionId)
  if (!connection || connection.workspaceId !== workspaceId) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'conexao nao encontrada' } }
  }

  await softDeleteConnection(parsed.data.connectionId)
  revalidatePath('/configuracoes/gateways')
  revalidatePath('/configuracoes/gateways/hotmart')

  billingLogger.info(
    { workspaceId, connectionId: parsed.data.connectionId, provider: connection.provider },
    'gateway disconnected'
  )

  return { ok: true, data: { connectionId: parsed.data.connectionId } }
}
