'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/lib/db'
import { metaConnections } from '@/lib/db/schema/connections'
import { auditLogs } from '@/lib/db/schema/audit'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getActiveConnectionByWorkspace } from '@/lib/db/queries/meta-connections'
import { capiLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'

/**
 * Server Actions pro wizard `/configuracoes/meta/eventos` (1.4.9).
 *
 * Pattern thin controller (CLAUDE.md regra 1): valida via Zod, delega
 * pra query, retorna Result<T, AppError>.
 */

export type MetaCapiActionResult =
  | { ok: true }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'INTERNAL'
        message: string
      }
    }

// ---------------------------------------------------------------------------
// Test Event Code (modo teste)
// ---------------------------------------------------------------------------

const testEventCodeSchema = z.object({
  testEventCode: z
    .string()
    .trim()
    .max(64, 'test_event_code maximo 64 chars')
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

async function resolveWorkspaceAndUser(): Promise<{
  workspaceId: string
  userId: string
} | null> {
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

/**
 * Liga/desliga modo teste no Meta CAPI. Quando preenchido, todo evento
 * vai com `test_event_code` no payload — visivel em Events Manager >
 * Test Events tab, sem afetar atribuicao de campanha.
 *
 * Caller deve passar null/empty pra desligar.
 */
export async function updateMetaTestEventCode(input: {
  testEventCode: string | null
}): Promise<MetaCapiActionResult> {
  const session = await resolveWorkspaceAndUser()
  if (!session) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }
  }
  const { workspaceId, userId } = session

  const parsed = testEventCodeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
    }
  }

  const connection = await getActiveConnectionByWorkspace(workspaceId)
  if (!connection) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Meta nao conectado pra esse workspace' },
    }
  }

  const previousValue = connection.testEventCode
  const newValue = parsed.data.testEventCode

  try {
    await db
      .update(metaConnections)
      .set({ testEventCode: newValue })
      .where(and(eq(metaConnections.id, connection.id), eq(metaConnections.status, 'active')))

    // Audit log (P3 #16): mudanca em modo teste afeta dados enviados pro
    // Meta. Auditavel pra investigar "por que esses eventos foram pra
    // Test Events e nao prod?" depois.
    await db.insert(auditLogs).values({
      workspaceId,
      actorUserId: userId,
      eventType: 'meta_capi.test_event_code_updated',
      payload: {
        previous_was_set: previousValue !== null,
        new_was_set: newValue !== null,
        mode: newValue ? 'test' : 'production',
      },
    })

    capiLogger.info(
      { workspaceId, testMode: newValue !== null },
      'meta-capi: test_event_code updated'
    )

    revalidatePath('/configuracoes/meta/eventos')
    return { ok: true }
  } catch (err) {
    capiLogger.error({ err, workspaceId }, 'meta-capi: failed to update test_event_code')
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Falha ao atualizar — tente de novo' },
    }
  }
}
