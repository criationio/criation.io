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
} from '@/lib/db/queries/connections'
import { encrypt } from '@/lib/encryption'
import { billingLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'
import {
  connectEduzzSchema,
  connectGenericSchema,
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
 * URL Kiwify limpa — validacao via HMAC-SHA1 (ADR-017 revisado pos-E2E).
 * Nao precisamos mais anexar `?token=` (cliente colava nosso UUID antigo).
 * Kiwify assina cada webhook com `?signature=hmac_sha1(token, body)` —
 * validamos no recebimento.
 */
function buildKiwifyWebhookUrl(connectionId: string): string {
  return buildWebhookUrl('kiwify', connectionId)
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
 * Conecta Kiwify (MVP — token Kiwify nativo + HMAC-SHA1).
 *
 * Fluxo correto (revisado pos-E2E 2026-05-10):
 * 1. Cliente cria webhook na Kiwify (sem URL ainda)
 * 2. Kiwify gera token automatico (ex: `3x27zgg73o3`)
 * 3. Cliente cola esse token aqui
 * 4. Salvamos como webhookSecret cifrado
 * 5. Devolvemos webhook URL LIMPA (sem `?token=`)
 * 6. Cliente edita webhook na Kiwify e cola a URL limpa
 *
 * Validacao inbound via HMAC-SHA1(token, raw_body) na query `?signature=`.
 * Algoritmo confirmado empiricamente em sandbox real.
 */
export async function connectKiwify(rawInput: unknown): Promise<
  GatewayActionResult<{
    connectionId: string
    webhookUrl: string
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

    const webhookUrl = buildKiwifyWebhookUrl(row.id)

    revalidatePath('/configuracoes/gateways')
    revalidatePath('/configuracoes/gateways/kiwify')

    billingLogger.info({ workspaceId, connectionId: row.id }, 'connectKiwify: success')

    return { ok: true, data: { connectionId: row.id, webhookUrl } }
  } catch (err) {
    billingLogger.error(
      { workspaceId, err: (err as Error).message },
      'connectKiwify: insert failed'
    )
    return { ok: false, error: { code: 'INTERNAL', message: 'falha ao salvar conexao' } }
  }
}

/**
 * Conecta Eduzz (MVP — webhook signing key + HMAC-SHA256).
 *
 * Cliente cria webhook em integrations.eduzz.com/webhook/configs, gera
 * signing key, cola aqui. Validamos webhooks via HMAC-SHA256 do raw body
 * com `x-signature` header. URL fica limpa.
 */
export async function connectEduzz(rawInput: unknown): Promise<
  GatewayActionResult<{
    connectionId: string
    webhookUrl: string
  }>
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const parsed = connectEduzzSchema.safeParse(rawInput)
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

  const existing = await getActiveConnection(workspaceId, 'eduzz')
  if (existing) {
    return {
      ok: false,
      error: {
        code: 'ALREADY_CONNECTED',
        message: 'Ja existe uma conexao Eduzz ativa neste workspace.',
      },
    }
  }

  const encryptedWebhookSecret = encrypt(parsed.data.webhookKey)

  try {
    const row = await insertConnection({
      workspaceId,
      provider: 'eduzz',
      encryptedCredentials: encrypt(JSON.stringify({ provider: 'eduzz' })),
      encryptionKeyVersion: 'v1',
      webhookSecret: encryptedWebhookSecret,
      apiCredentials: {},
      webhookVersion: '3.0.0',
      status: 'active',
    })

    const webhookUrl = buildWebhookUrl('hotmart', row.id).replace('/hotmart/', '/eduzz/')

    revalidatePath('/configuracoes/gateways')
    revalidatePath('/configuracoes/gateways/eduzz')

    billingLogger.info({ workspaceId, connectionId: row.id }, 'connectEduzz: success')
    return { ok: true, data: { connectionId: row.id, webhookUrl } }
  } catch (err) {
    billingLogger.error({ workspaceId, err: (err as Error).message }, 'connectEduzz: insert failed')
    return { ok: false, error: { code: 'INTERNAL', message: 'falha ao salvar conexao' } }
  }
}

/**
 * Conecta webhook generico (long-tail via n8n/Make/Zapier).
 *
 * Cliente declara `sourceProvider` (ex: 'Monetizze') opcionalmente. Geramos
 * UUIDv4 token, ele cola no header `x-criation-token` do flow Make/n8n. URL
 * limpa devolvida pra cliente apontar webhook do gateway dele -> Make/n8n
 * -> nossa URL.
 */
export async function connectGeneric(rawInput: unknown): Promise<
  GatewayActionResult<{
    connectionId: string
    webhookUrl: string
    token: string
    sourceProvider?: string
  }>
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const parsed = connectGenericSchema.safeParse(rawInput)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      error: { code: 'INVALID', message: firstIssue?.message ?? 'input invalido' },
    }
  }

  const token = parsed.data.webhookToken
  const encryptedWebhookSecret = encrypt(token)

  try {
    const row = await insertConnection({
      workspaceId,
      provider: 'generic',
      encryptedCredentials: encrypt(
        JSON.stringify({
          provider: 'generic',
          sourceProvider: parsed.data.sourceProvider ?? null,
        })
      ),
      encryptionKeyVersion: 'v1',
      webhookSecret: encryptedWebhookSecret,
      apiCredentials: { sourceProvider: parsed.data.sourceProvider ?? null },
      webhookVersion: '1.0.0',
      status: 'active',
    })

    const webhookUrl = buildWebhookUrl('hotmart', row.id).replace('/hotmart/', '/generic/')

    revalidatePath('/configuracoes/gateways')
    revalidatePath('/configuracoes/gateways/generic')

    billingLogger.info(
      { workspaceId, connectionId: row.id, sourceProvider: parsed.data.sourceProvider },
      'connectGeneric: success'
    )
    return {
      ok: true,
      data: {
        connectionId: row.id,
        webhookUrl,
        token,
        ...(parsed.data.sourceProvider ? { sourceProvider: parsed.data.sourceProvider } : {}),
      },
    }
  } catch (err) {
    billingLogger.error(
      { workspaceId, err: (err as Error).message },
      'connectGeneric: insert failed'
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
  // Revalida path do provider especifico (hotmart/kiwify/eduzz/generic)
  revalidatePath(`/configuracoes/gateways/${connection.provider}`)

  billingLogger.info(
    { workspaceId, connectionId: parsed.data.connectionId, provider: connection.provider },
    'gateway disconnected'
  )

  return { ok: true, data: { connectionId: parsed.data.connectionId } }
}
