'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import { workspaceMembers } from '@/lib/db/schema/auth'
import {
  ErasureValidationError,
  eraseDataSubject,
  type ErasureResult,
} from '@/lib/services/erasure.service'
import { getUser } from '@/lib/supabase/server'

interface ActionOk<T> {
  ok: true
  data: T
}
interface ActionErr {
  ok: false
  error: { code: string; message: string }
}
type Result<T> = ActionOk<T> | ActionErr

const requestSchema = z
  .object({
    workspaceId: z.string().uuid(),
    emailHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, 'emailHash deve ser SHA-256 hex (64 chars)')
      .nullish(),
    visitorId: z.string().min(1).max(255).nullish(),
    reason: z.string().trim().min(3).max(500),
  })
  .refine(
    (v) =>
      (v.emailHash != null && v.emailHash !== '') || (v.visitorId != null && v.visitorId !== ''),
    {
      message: 'Pelo menos emailHash OU visitorId obrigatorio',
    }
  )

export type LgpdErasureInput = z.infer<typeof requestSchema>

const ADMIN_ROLES = new Set(['owner', 'admin'])

/**
 * Server Action LGPD erasure — TD-104.
 *
 * Apenas owner/admin do workspace pode disparar. Caso de uso: titular faz
 * pedido de eliminacao via canal out-of-band (email, formulario, telefone),
 * admin do workspace valida identidade e dispara erasure via UI.
 *
 * Endpoint publico self-service com email confirmation fica como TD-104b
 * (require Resend setup + tabela de tokens de confirmacao).
 *
 * Retorna shape discriminado (CLAUDE.md regra 21). UI exibe counts e
 * decide redirect/toast.
 */
export async function requestLgpdErasure(input: LgpdErasureInput): Promise<Result<ErasureResult>> {
  return withCorrelatedAction(async () => {
    const user = await getUser()
    if (!user) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Login necessario' } }
    }

    const parsed = requestSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalido' },
      }
    }

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, parsed.data.workspaceId),
        eq(workspaceMembers.userId, user.id)
      ),
    })

    if (!membership || !ADMIN_ROLES.has(membership.role)) {
      return {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Apenas owner/admin do workspace pode disparar erasure',
        },
      }
    }

    try {
      // `exactOptionalPropertyTypes: true` proibe passar `undefined` explicito em
      // optional props — construimos request condicionalmente.
      const req: Parameters<typeof eraseDataSubject>[0] = {
        workspaceId: parsed.data.workspaceId,
        actorUserId: user.id,
        reason: parsed.data.reason,
      }
      if (parsed.data.emailHash) req.emailHash = parsed.data.emailHash
      if (parsed.data.visitorId) req.visitorId = parsed.data.visitorId

      const result = await eraseDataSubject(req)

      revalidatePath('/configuracoes/privacidade')
      return { ok: true, data: result }
    } catch (err) {
      if (err instanceof ErasureValidationError) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: err.message } }
      }
      const errorMessage = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        error: { code: 'INTERNAL', message: `Erasure falhou: ${errorMessage}` },
      }
    }
  })
}
