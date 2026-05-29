import { NextResponse, type NextRequest } from 'next/server'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { recordProcessedWebhook } from '@/lib/db/queries/gateway-events'
import { billingLogger } from '@/lib/logger'
import { handleWebhook } from '@/lib/services/billing.service'
import { triggerProcessBillingEvent } from '@/lib/trigger/client'

import type { BillingProvider } from './types'

/**
 * Handler comum dos webhooks de billing (Asaas/Stripe). Sessão 1.12.
 *  1. lê raw body (necessário pra validar assinatura)
 *  2. valida assinatura + normaliza (handleWebhook) — fail closed (401)
 *  3. dedup via processed_webhook_events (ON CONFLICT DO NOTHING)
 *  4. enfileira process-billing-event → 200 SEMPRE (exceto assinatura inválida)
 */
export async function handleBillingWebhook(
  provider: BillingProvider,
  req: NextRequest
): Promise<Response> {
  return withCorrelation(generateCorrelationId(), async () => {
    const rawBody = await req.text()

    let event
    try {
      event = handleWebhook(provider, rawBody, req.headers)
    } catch (err) {
      billingLogger.error({ provider, err: String(err) }, 'webhook billing inválido (fail closed)')
      return new NextResponse('invalid signature', { status: 401 })
    }

    const { alreadyProcessed } = await recordProcessedWebhook(
      provider,
      event.externalEventId,
      event.type,
      event.raw
    )
    if (alreadyProcessed) {
      billingLogger.info(
        { provider, eventId: event.externalEventId },
        'webhook billing duplicado — ignorado'
      )
      return NextResponse.json({ received: true, deduped: true })
    }

    try {
      const lean = { ...event }
      lean.raw = undefined // payload enxuto pro Trigger (raw fica em processed_webhook_events)
      await triggerProcessBillingEvent({ event: lean })
    } catch (err) {
      // Já registrado como processado; reenviar não ajuda. Loga p/ alerta.
      billingLogger.error(
        { provider, eventId: event.externalEventId, err: String(err) },
        'falha ao enfileirar process-billing-event'
      )
    }

    return NextResponse.json({ received: true })
  })
}
