'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema/audit'
import { googleConnections } from '@/lib/db/schema/connections'
import {
  getActiveGoogleConnectionByWorkspace,
  listAdsAccountsByConnection,
  setDefaultGoogleAdsAccount as setDefaultAccountQuery,
  softDeleteMapping,
  upsertMapping,
} from '@/lib/db/queries/google-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'

/**
 * Server Actions pro wizard `/configuracoes/google/conversoes` (1.4.9.B step 10).
 *
 * Pattern thin controller (CLAUDE.md regra 1): valida via Zod, delega
 * pra query, retorna Result<T, AppError>. Action revalida o path apos
 * sucesso pra a UI re-render com state atualizado.
 *
 * Cada action confere que o resource (account/mapping) pertence ao
 * workspace do user — RLS-like check em userland antes da query.
 */

export type GoogleConversoesActionResult =
  | { ok: true }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'INTERNAL'
        message: string
      }
    }

const REVALIDATE_PATH = '/configuracoes/google/conversoes'

async function resolveSession(): Promise<{ workspaceId: string; userId: string } | null> {
  const user = await getUser()
  if (!user) return null
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (userRow?.defaultWorkspaceId) {
    return { workspaceId: userRow.defaultWorkspaceId, userId: user.id }
  }
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  })
  if (!membership) return null
  return { workspaceId: membership.workspaceId, userId: user.id }
}

// ---------------------------------------------------------------------------
// Account default (multi-customer picker)
// ---------------------------------------------------------------------------

const setDefaultAccountSchema = z.object({
  accountId: z.string().uuid(),
})

/**
 * Marca uma `google_ads_account` como default do workspace. Fanout usa default
 * quando mapping nao especifica account. Query desmarca os outros do mesmo
 * connection na mesma operacao (atomic).
 */
export async function setDefaultGoogleAdsAccount(input: {
  accountId: string
}): Promise<GoogleConversoesActionResult> {
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

  const parsed = setDefaultAccountSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
    }
  }

  const connection = await getActiveGoogleConnectionByWorkspace(session.workspaceId)
  if (!connection) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Google nao conectado' } }
  }

  // Confirma que a account pertence ao connection do workspace (ownership check)
  const accounts = await listAdsAccountsByConnection(connection.id)
  const target = accounts.find((a) => a.id === parsed.data.accountId)
  if (!target) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Conta Google Ads nao encontrada nesse workspace' },
    }
  }

  const previousDefault = accounts.find((a) => a.isDefault) ?? null

  try {
    await setDefaultAccountQuery(connection.id, parsed.data.accountId)
    // Audit P1-4 fix: default account define qual customer Google Ads recebe
    // conversões. Mudança auditavel.
    await db.insert(auditLogs).values({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      eventType: 'google_capi.default_account_changed',
      payload: {
        previous_account_id: previousDefault?.id ?? null,
        previous_customer_id: previousDefault?.customerId ?? null,
        new_account_id: parsed.data.accountId,
        new_customer_id: target.customerId,
      },
    })
    authLogger.info(
      { workspaceId: session.workspaceId, accountId: parsed.data.accountId },
      'google ads default account changed'
    )
    revalidatePath(REVALIDATE_PATH)
    return { ok: true }
  } catch (err) {
    authLogger.error({ err, workspaceId: session.workspaceId }, 'setDefaultGoogleAdsAccount falhou')
    return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao salvar' } }
  }
}

// ---------------------------------------------------------------------------
// Conversion Action Mapping CRUD
// ---------------------------------------------------------------------------

const upsertMappingSchema = z.object({
  googleAdsAccountId: z.string().uuid(),
  internalEventName: z.string().trim().min(1).max(64),
  productDestinationId: z.string().trim().min(1).max(64),
  conversionActionName: z.string().trim().max(255).optional().nullable(),
  conversionActionType: z.string().trim().max(64).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
})

export async function upsertGoogleConversionActionMapping(input: {
  googleAdsAccountId: string
  internalEventName: string
  productDestinationId: string
  conversionActionName?: string | null
  conversionActionType?: string | null
  isPrimary?: boolean
  isEnabled?: boolean
}): Promise<GoogleConversoesActionResult> {
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

  const parsed = upsertMappingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
    }
  }

  // Ownership check: account precisa estar no connection do workspace
  const connection = await getActiveGoogleConnectionByWorkspace(session.workspaceId)
  if (!connection) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Google nao conectado' } }
  }
  const accounts = await listAdsAccountsByConnection(connection.id)
  const accountBelongs = accounts.some((a) => a.id === parsed.data.googleAdsAccountId)
  if (!accountBelongs) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Conta Google Ads nao encontrada nesse workspace' },
    }
  }

  try {
    const result = await upsertMapping({
      workspaceId: session.workspaceId,
      googleAdsAccountId: parsed.data.googleAdsAccountId,
      internalEventName: parsed.data.internalEventName,
      productDestinationId: parsed.data.productDestinationId,
      conversionActionName: parsed.data.conversionActionName ?? null,
      conversionActionType: parsed.data.conversionActionType ?? null,
      isPrimary: parsed.data.isPrimary ?? false,
      isEnabled: parsed.data.isEnabled ?? true,
    })
    // Audit P1-4 fix: mapping define qual conversion action recebe cada
    // event_name Criation. Mudança auditavel pra forense pos-fato.
    await db.insert(auditLogs).values({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      eventType: 'google_capi.mapping_upserted',
      payload: {
        mapping_id: result.id,
        google_ads_account_id: parsed.data.googleAdsAccountId,
        internal_event_name: parsed.data.internalEventName,
        product_destination_id: parsed.data.productDestinationId,
        is_enabled: parsed.data.isEnabled ?? true,
      },
    })
    authLogger.info(
      {
        workspaceId: session.workspaceId,
        eventName: parsed.data.internalEventName,
        productDestinationId: parsed.data.productDestinationId,
      },
      'google conversion action mapping upserted'
    )
    revalidatePath(REVALIDATE_PATH)
    return { ok: true }
  } catch (err) {
    authLogger.error(
      { err, workspaceId: session.workspaceId },
      'upsertGoogleConversionActionMapping falhou'
    )
    return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao salvar mapping' } }
  }
}

const deleteMappingSchema = z.object({ mappingId: z.string().uuid() })

export async function deleteGoogleConversionActionMapping(input: {
  mappingId: string
}): Promise<GoogleConversoesActionResult> {
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

  const parsed = deleteMappingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
    }
  }

  // Ownership check: mapping deve pertencer ao workspace do user
  const mapping = await db.query.googleConversionActionMappings.findFirst({
    where: (m, { eq, and, isNull }) => and(eq(m.id, parsed.data.mappingId), isNull(m.deletedAt)),
  })
  if (!mapping) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Mapping nao encontrado' } }
  }
  if (mapping.workspaceId !== session.workspaceId) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Mapping de outro workspace' } }
  }

  try {
    // P2-5 fix: passa workspaceId pra query — belt-and-suspenders mesmo
    // com ownership check acima (defense em profundidade).
    await softDeleteMapping(parsed.data.mappingId, session.workspaceId)
    // Audit P1-4 fix: delete de mapping desliga conversion action — auditavel.
    await db.insert(auditLogs).values({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      eventType: 'google_capi.mapping_deleted',
      payload: {
        mapping_id: parsed.data.mappingId,
        internal_event_name: mapping.internalEventName,
        product_destination_id: mapping.productDestinationId,
      },
    })
    authLogger.info(
      { workspaceId: session.workspaceId, mappingId: parsed.data.mappingId },
      'google conversion action mapping deleted'
    )
    revalidatePath(REVALIDATE_PATH)
    return { ok: true }
  } catch (err) {
    authLogger.error(
      { err, workspaceId: session.workspaceId },
      'deleteGoogleConversionActionMapping falhou'
    )
    return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao apagar' } }
  }
}

// ---------------------------------------------------------------------------
// Test mode toggle
// ---------------------------------------------------------------------------

const toggleTestModeSchema = z.object({ enabled: z.boolean() })

/**
 * Liga/desliga modo teste no google_connections. Quando true, adapter envia
 * `validateOnly: true` no body do request pra Data Manager API — Google valida
 * payload mas NAO conta como conversao real. Equivalente Meta `test_event_code`.
 */
export async function toggleGoogleTestMode(input: {
  enabled: boolean
}): Promise<GoogleConversoesActionResult> {
  const session = await resolveSession()
  if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

  const parsed = toggleTestModeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
    }
  }

  const connection = await getActiveGoogleConnectionByWorkspace(session.workspaceId)
  if (!connection) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Google nao conectado' } }
  }

  // P2-4 fix: early-exit se valor ja esta no estado solicitado — evita
  // UPDATE redundante + audit log noise.
  if (connection.testMode === parsed.data.enabled) {
    return { ok: true }
  }

  try {
    await db
      .update(googleConnections)
      .set({ testMode: parsed.data.enabled })
      .where(and(eq(googleConnections.id, connection.id)))
    // Audit P1-4 fix: modo teste afeta `validateOnly: true` no payload pro
    // Data Manager API — Google valida sem contar como conversao. Mudança
    // auditavel pra forense "por que essas conversões nao foram contabilizadas?"
    await db.insert(auditLogs).values({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      eventType: 'google_capi.test_mode_toggled',
      payload: {
        previous: connection.testMode,
        current: parsed.data.enabled,
        mode: parsed.data.enabled ? 'test' : 'production',
      },
    })
    authLogger.info(
      { workspaceId: session.workspaceId, testMode: parsed.data.enabled },
      'google test mode toggled'
    )
    revalidatePath(REVALIDATE_PATH)
    return { ok: true }
  } catch (err) {
    authLogger.error({ err, workspaceId: session.workspaceId }, 'toggleGoogleTestMode falhou')
    return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao salvar' } }
  }
}
