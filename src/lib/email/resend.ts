import { render } from '@react-email/render'
import { Resend } from 'resend'
import type { ReactElement } from 'react'

import { env } from '@/env'
import { authLogger } from '@/lib/logger'

let cached: Resend | null | undefined

function getClient(): Resend | null {
  if (cached !== undefined) return cached
  if (!env.RESEND_API_KEY) {
    cached = null
    return null
  }
  cached = new Resend(env.RESEND_API_KEY)
  return cached
}

const DEFAULT_FROM = 'Criation <noreply@criation.io>'

export interface SendTransactionalParams {
  to: string
  subject: string
  template: ReactElement
  // Tags Resend para categorizacao (opcional)
  tags?: { name: string; value: string }[]
}

/**
 * Envia email transacional via Resend.
 *
 * Em dev sem RESEND_API_KEY: log estruturado + retorna ok:false (signal
 * para caller mostrar warning no log de aplicacao). Nao quebra fluxo.
 *
 * Em prod sem chave: caso anomalo — env validation deve catch antes.
 */
export async function sendTransactional(
  params: SendTransactionalParams
): Promise<{ ok: true; id: string } | { ok: false; reason: 'no_api_key' | 'send_failed' }> {
  const client = getClient()
  const html = await render(params.template)

  if (!client) {
    authLogger.warn(
      { event: 'email_send_skipped', subject: params.subject },
      'RESEND_API_KEY ausente — preview only'
    )
    return { ok: false, reason: 'no_api_key' }
  }

  const from = env.RESEND_FROM_EMAIL ?? DEFAULT_FROM
  const result = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html,
    ...(params.tags ? { tags: params.tags } : {}),
  })

  if (result.error || !result.data) {
    authLogger.error(
      { event: 'email_send_failed', errName: result.error?.name },
      'resend send failed'
    )
    return { ok: false, reason: 'send_failed' }
  }

  return { ok: true, id: result.data.id }
}
