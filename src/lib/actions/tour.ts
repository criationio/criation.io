'use server'

import { withCorrelatedAction } from '@/lib/correlation'
import { markTourCompleted } from '@/lib/db/queries/users'
import { authLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'

/**
 * Marca o tour interativo (react-joyride) como completo/skipado. Chamado
 * pelo callback do Joyride no `finish` OU `skip`. Idempotente.
 *
 * Server Action retorna shape simples — Joyride callback nao precisa
 * roteamento, so persiste estado.
 */
export async function markDashboardTourDone(): Promise<{ ok: true } | { ok: false }> {
  return withCorrelatedAction(async () => {
    const user = await getUser()
    if (!user) return { ok: false }

    await markTourCompleted(user.id)
    authLogger.info({ userId: user.id, event: 'dashboard_tour_done' }, 'tour marcado completo')
    return { ok: true }
  })
}
