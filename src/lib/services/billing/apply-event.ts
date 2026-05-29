import { getPlan } from '@/lib/billing/plans'
import {
  getCreditPackageBySku,
  markSubscriptionCanceled,
  setWorkspacePlan,
  upsertSubscription,
} from '@/lib/db/queries/billing'
import { getTransactionByIdempotencyKey } from '@/lib/db/queries/credits'
import { allocate, refund } from '@/lib/services/credit.service'
import { billingLogger } from '@/lib/logger'

import type { BillingEvent } from './types'

export interface ApplyResult {
  ok: boolean
  skipped?: string
  error?: string
}

/**
 * Aplica um BillingEvent (já validado+deduplicado pelo webhook). Aloca/estorna
 * créditos (idempotente por idempotencyKey = id do evento do gateway) e atualiza
 * subscriptions/workspaces.plan_id. NÃO revoga créditos em cancelamento — só em
 * estorno/chargeback (§4). Pura o suficiente pra testar fora do Trigger.
 */
export async function applyBillingEvent(e: BillingEvent): Promise<ApplyResult> {
  if (e.type === 'ignored') return { ok: true, skipped: 'ignored' }

  if (!e.workspaceId) {
    billingLogger.error({ eventId: e.externalEventId }, 'billing event sem workspaceId')
    return { ok: false, error: 'no_workspace' }
  }
  const workspaceId = e.workspaceId
  const now = new Date()

  switch (e.type) {
    case 'invoice_paid': {
      const plan = e.planId ? getPlan(e.planId) : undefined
      if (!plan) {
        billingLogger.error({ planId: e.planId }, 'invoice_paid sem plano resolvível')
        return { ok: false, error: 'unknown_plan' }
      }
      const cycleEnd = new Date(now)
      cycleEnd.setMonth(cycleEnd.getMonth() + 1)

      await upsertSubscription({
        workspaceId,
        planId: plan.id,
        status: 'active',
        paymentProvider: e.provider,
        providerSubscriptionId: e.providerSubscriptionId ?? null,
        providerCustomerId: e.providerCustomerId ?? null,
        creditsPerCycle: plan.creditsPerCycle,
        currentCycleStartedAt: now,
        currentCycleEndsAt: cycleEnd,
      })
      await setWorkspacePlan(workspaceId, plan.id)
      await allocate(workspaceId, plan.creditsPerCycle, 'subscription', cycleEnd, {
        idempotencyKey: `sub_${e.invoiceId ?? e.externalEventId}`,
      })
      billingLogger.info(
        { workspaceId, plan: plan.id, credits: plan.creditsPerCycle },
        'assinatura creditada'
      )
      return { ok: true }
    }

    case 'pack_purchased': {
      if (!e.packSku) return { ok: false, error: 'no_pack_sku' }
      const pack = await getCreditPackageBySku(e.packSku)
      if (!pack) {
        billingLogger.error({ sku: e.packSku }, 'pack desconhecido')
        return { ok: false, error: 'unknown_pack' }
      }
      const expiresAt = new Date(now.getTime() + pack.validityDays * 24 * 60 * 60 * 1000)
      await allocate(workspaceId, pack.credits, 'pack', expiresAt, {
        idempotencyKey: `pack_${e.paymentId ?? e.externalEventId}`,
      })
      billingLogger.info({ workspaceId, sku: pack.sku, credits: pack.credits }, 'pack creditado')
      return { ok: true }
    }

    case 'charge_refunded': {
      const key = e.paymentId ?? e.invoiceId
      if (!key) return { ok: false, error: 'no_payment_id' }
      const original =
        (await getTransactionByIdempotencyKey(`sub_${key}`)) ??
        (await getTransactionByIdempotencyKey(`pack_${key}`))
      if (!original) {
        billingLogger.warn({ key }, 'estorno sem alocação original — nada a reverter')
        return { ok: true, skipped: 'no_original' }
      }
      await refund(workspaceId, original.id, `gateway ${e.provider} refund/chargeback`)
      billingLogger.info({ workspaceId, transactionId: original.id }, 'crédito estornado')
      return { ok: true }
    }

    case 'subscription_canceled': {
      if (e.providerSubscriptionId) {
        await markSubscriptionCanceled(e.provider, e.providerSubscriptionId)
      }
      return { ok: true } // não revoga créditos — expiram no fim do ciclo
    }

    default:
      return { ok: true, skipped: 'unhandled' }
  }
}
