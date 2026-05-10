import { logger, task } from '@trigger.dev/sdk/v3'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema/billing'
import { getConnectionById } from '@/lib/db/queries/gateway-connections'
import { enqueueDlq, getEventById, markEventProcessed } from '@/lib/db/queries/gateway-events'
import {
  markSubscriptionCancelled,
  upsertSubscription,
} from '@/lib/db/queries/gateway-subscriptions'
import { allocate, type CreditSource } from '@/lib/services/credit.service'
import { hotmartAdapter } from '@/lib/services/gateways/hotmart'
import type {
  GatewayAdapter,
  GatewayProvider,
  NormalizedGatewayEvent,
} from '@/lib/services/gateways/types'

interface Payload {
  eventId: string
  workspaceId: string
  connectionId: string
}

const ADAPTERS: Partial<Record<GatewayProvider, GatewayAdapter>> = {
  hotmart: hotmartAdapter,
}

/**
 * Processa um `gateway_events` row apos webhook ter persistido.
 *
 * Comportamento por eventType:
 * - PURCHASE_APPROVED: upsert gateway_subscriptions (se subscription) +
 *   tenta creditService.allocate quando o workspace ja tem subscription ligada
 *   (mapping vem de billing.service na 1.12). Se nao ha mapping, marca
 *   `allocation_status='pending_no_mapping'` — nao e erro.
 * - PURCHASE_REFUNDED, PURCHASE_CHARGEBACK: marca `allocation_status='revoked'`.
 *   Chamada real a creditService.revoke entra na 1.7.5.
 * - SUBSCRIPTION_CANCELLATION: marca subscription como CANCELLED (mantem
 *   creditos do ciclo atual ate end_accession_date).
 * - BILLET_PRINTED, DELAYED, EXPIRED, OUT_OF_SHOPPING_CART: log + marca processed.
 * - Outros: marca processed sem acao.
 *
 * Idempotencia: re-execucao via mesmo `event.id` e segura — allocate dedup
 * por idempotencyKey, upsertSubscription e UPSERT, markEventProcessed e
 * UPDATE simples.
 */
export const processGatewayEventTask = task({
  id: 'process-gateway-event',
  maxDuration: 120,
  retry: { maxAttempts: 5, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 30_000 },
  run: async (payload: Payload) => {
    const { eventId, workspaceId, connectionId } = payload
    logger.info('process-gateway-event start', { eventId, workspaceId, connectionId })

    const event = await getEventById(eventId)
    if (!event) {
      logger.warn('process-gateway-event: event not found', { eventId })
      return { skipped: true, reason: 'event_not_found' }
    }

    if (event.processedAt) {
      logger.info('process-gateway-event: already processed', { eventId })
      return { skipped: true, reason: 'already_processed' }
    }

    const connection = await getConnectionById(connectionId)
    if (!connection) {
      await enqueueDlq({
        workspaceId,
        provider: event.provider,
        rawPayload: { eventId, reason: 'connection_not_found' },
        errorMessage: 'connection deleted before event processed',
      })
      return { error: 'connection_not_found' }
    }

    const adapter = ADAPTERS[event.provider as GatewayProvider]
    if (!adapter) {
      logger.error('process-gateway-event: no adapter', { provider: event.provider })
      return { error: 'no_adapter' }
    }

    // Reconstruct NormalizedGatewayEvent from persisted row. Os campos ja foram
    // normalizados no momento do INSERT pelo webhook handler — apenas projetamos
    // de volta para o shape do dominio.
    const normalized: NormalizedGatewayEvent = {
      provider: event.provider as GatewayProvider,
      providerEventId: event.providerEventId,
      providerEventVersion: event.providerEventVersion ?? '2.0.0',
      eventType: event.eventType as NormalizedGatewayEvent['eventType'],
      occurredAt: event.creationDateMs ? new Date(event.creationDateMs) : event.createdAt,
      occurredAtMs: event.creationDateMs ?? event.createdAt.getTime(),
      amountCents: event.amountCents ?? 0,
      feeCents: event.feeCents ?? undefined,
      producerNetCents: event.producerNetCents ?? undefined,
      currency: event.currency ?? 'BRL',
      productId: event.productId ?? '',
      subscriberCode: event.subscriberCode ?? undefined,
      subscriptionStatus:
        (event.subscriptionStatus as NormalizedGatewayEvent['subscriptionStatus']) ?? undefined,
      recurrenceNumber: event.recurrenceNumber ?? undefined,
      planId: event.planId ?? undefined,
      paymentMethod: (event.paymentMethod as NormalizedGatewayEvent['paymentMethod']) ?? undefined,
      installmentsNumber: event.installmentsNumber ?? undefined,
      buyerCountry: event.buyerCountry ?? undefined,
      buyerEmailHash: event.customerEmailHash ?? '',
      buyerPhoneHash: event.customerPhoneHash ?? undefined,
      buyerDocumentHash: event.buyerDocumentHash ?? undefined,
      affiliateEmailHash: event.affiliateEmailHash ?? undefined,
      affiliateSource:
        (event.affiliateSource as NormalizedGatewayEvent['affiliateSource']) ?? undefined,
      commissionAffiliateCents: event.commissionAffiliateCents ?? undefined,
      attribution: {
        utms: {
          source: event.utmSource ?? undefined,
          medium: event.utmMedium ?? undefined,
          campaign: event.utmCampaign ?? undefined,
          term: event.utmTerm ?? undefined,
          content: event.utmContent ?? undefined,
        },
        origin: (event.origin as NormalizedGatewayEvent['attribution']['origin']) ?? undefined,
        externalCode: event.externalCode ?? undefined,
        fbclid: event.fbclid ?? undefined,
        gclid: event.gclid ?? undefined,
        ttclid: event.ttclid ?? undefined,
      },
      allocationIdempotencyKey: event.allocationIdempotencyKey ?? event.providerEventId,
      rawPayload: event.rawPayload as Record<string, unknown>,
    }

    try {
      switch (normalized.eventType) {
        case 'PURCHASE_APPROVED':
          await handlePurchaseApproved(normalized, workspaceId, connectionId, eventId)
          break

        case 'PURCHASE_REFUNDED':
        case 'PURCHASE_CHARGEBACK':
          // creditService.revoke nao implementado ate 1.7.5 — apenas marcamos status
          await markEventProcessed(eventId, 'revoked', normalized.allocationIdempotencyKey)
          logger.info('process-gateway-event: marked revoked (revoke real chega na 1.7.5)', {
            eventId,
            providerEventId: normalized.providerEventId,
          })
          break

        case 'SUBSCRIPTION_CANCELLATION':
          if (normalized.subscriberCode) {
            await markSubscriptionCancelled(workspaceId, connectionId, normalized.subscriberCode)
          }
          await markEventProcessed(eventId, 'no_op_cancelled')
          break

        case 'PURCHASE_BILLET_PRINTED':
        case 'PURCHASE_DELAYED':
        case 'PURCHASE_EXPIRED':
        case 'PURCHASE_OUT_OF_SHOPPING_CART':
          // Tracked, sem acao de billing
          await markEventProcessed(eventId, 'no_op_tracked')
          break

        default:
          await markEventProcessed(eventId, 'no_op_unknown_event')
          logger.info('process-gateway-event: event type with no handler', {
            eventType: normalized.eventType,
            eventId,
          })
      }

      return { ok: true, eventType: normalized.eventType }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error('process-gateway-event: handler failed', { eventId, err: errorMessage })
      await enqueueDlq({
        workspaceId,
        provider: event.provider,
        rawPayload: { eventId, normalized },
        errorMessage,
      })
      // Re-throw para Trigger.dev tentar novamente
      throw err
    }
  },
})

async function handlePurchaseApproved(
  normalized: NormalizedGatewayEvent,
  workspaceId: string,
  connectionId: string,
  eventId: string
): Promise<void> {
  // 1. Sync subscription state (se for compra de assinatura)
  const isSubscription = !!normalized.subscriberCode
  if (isSubscription && normalized.subscriberCode) {
    const isFirstPurchase = (normalized.recurrenceNumber ?? 1) === 1
    await upsertSubscription({
      workspaceId,
      connectionId,
      subscriberCode: normalized.subscriberCode,
      planId: normalized.planId ?? undefined,
      productId: normalized.productId,
      status: 'ACTIVE',
      currentRecurrence: normalized.recurrenceNumber ?? 1,
      monthlyValueCents: normalized.amountCents,
      currency: normalized.currency,
      // origin so e gravado na primeira venda — upsert preserva em renovacoes
      origin: isFirstPurchase
        ? (normalized.attribution.origin as Record<string, unknown> | undefined)
        : undefined,
      identifiedVisitorId: isFirstPurchase ? normalized.attribution.externalCode : undefined,
    })
  }

  // 2. Tentar creditService.allocate via mapping em `subscriptions`
  // Mapping completo entra na 1.12 (billing.service). Aqui pulamos quando
  // nao ha mapping — registramos status para visibilidade no admin.
  if (!isSubscription || !normalized.subscriberCode) {
    await markEventProcessed(eventId, 'no_op_one_time_purchase')
    return
  }

  // Resolve internal subscription pelo provider_subscription_id
  const internalSub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.workspaceId, workspaceId),
      eq(subscriptions.providerSubscriptionId, normalized.subscriberCode)
    ),
  })

  if (!internalSub) {
    logger.info(
      'process-gateway-event: PURCHASE_APPROVED sem internal subscription (billing.service nao linkou ainda)',
      { eventId, subscriberCode: normalized.subscriberCode }
    )
    await markEventProcessed(eventId, 'pending_no_mapping')
    return
  }

  if (!internalSub.creditsPerCycle || internalSub.creditsPerCycle <= 0) {
    logger.warn('process-gateway-event: subscription sem creditsPerCycle definido', {
      eventId,
      subscriptionId: internalSub.id,
    })
    await markEventProcessed(eventId, 'pending_no_credits_per_cycle')
    return
  }

  const source: CreditSource = 'subscription'
  const cycleEndsAt =
    internalSub.currentCycleEndsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const result = await allocate(workspaceId, internalSub.creditsPerCycle, source, cycleEndsAt, {
    idempotencyKey: normalized.allocationIdempotencyKey,
    metadata: {
      gatewayEventId: eventId,
      provider: normalized.provider,
      providerEventId: normalized.providerEventId,
      subscriberCode: normalized.subscriberCode,
      recurrenceNumber: normalized.recurrenceNumber,
    },
  })

  await markEventProcessed(eventId, 'allocated', normalized.allocationIdempotencyKey)
  logger.info('process-gateway-event: credits allocated', {
    eventId,
    transactionId: result.transactionId,
    idempotent: result.idempotent,
    newBalance: result.newBalance,
  })
}
