import Stripe from 'stripe'

import { env } from '@/env'
import { billingLogger } from '@/lib/logger'

import type { BillingAdapter, BillingEvent, BillingEventType } from './types'

/**
 * Adapter Stripe (internacional) — ENXUTO (Sessão 1.12): webhook real
 * (validação de assinatura + parse). O fluxo de create/checkout fica pra 1.13
 * (lançamento internacional) — métodos de escrita lançam NOT_IMPLEMENTED.
 */

let client: Stripe | null = null
function stripe(): Stripe {
  if (client) return client
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
  client = new Stripe(key)
  return client
}

const NOT_IMPLEMENTED = 'Stripe write-flow chega na 1.13 (lançamento internacional)'

function mapEventType(stripeType: string): BillingEventType {
  switch (stripeType) {
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return 'invoice_paid'
    case 'checkout.session.completed':
      return 'pack_purchased' // mode=payment (pack); subscriptions vêm por invoice.paid
    case 'charge.refunded':
    case 'charge.dispute.created':
      return 'charge_refunded'
    case 'customer.subscription.deleted':
      return 'subscription_canceled'
    default:
      return 'ignored'
  }
}

function meta(obj: unknown): Record<string, string> {
  const m = (obj as { metadata?: Record<string, string> } | null)?.metadata
  return m ?? {}
}

export const stripeAdapter: BillingAdapter = {
  provider: 'stripe',

  createCustomer() {
    throw new Error(NOT_IMPLEMENTED)
  },
  createSubscription() {
    throw new Error(NOT_IMPLEMENTED)
  },
  cancelSubscription() {
    throw new Error(NOT_IMPLEMENTED)
  },
  changePlan() {
    throw new Error(NOT_IMPLEMENTED)
  },
  refund() {
    throw new Error(NOT_IMPLEMENTED)
  },

  validateWebhook(rawBody: string, headers: Headers): boolean {
    const sig = headers.get('stripe-signature')
    const secret = env.STRIPE_WEBHOOK_SECRET
    if (!sig || !secret) {
      billingLogger.error({}, 'Stripe webhook sem assinatura/secret — rejeitando')
      return false
    }
    try {
      stripe().webhooks.constructEvent(rawBody, sig, secret)
      return true
    } catch (err) {
      billingLogger.error({ err: String(err) }, 'Stripe webhook signature inválida')
      return false
    }
  },

  parseEvent(rawBody: string): BillingEvent {
    const evt = JSON.parse(rawBody) as Stripe.Event
    const type = mapEventType(evt.type)
    const obj = evt.data.object as unknown as Record<string, unknown>
    const m = meta(obj)

    // amount: invoice.amount_paid / charge.amount (cents já). currency direto.
    const amountCents =
      typeof obj.amount_paid === 'number'
        ? obj.amount_paid
        : typeof obj.amount === 'number'
          ? (obj.amount as number)
          : typeof obj.amount_total === 'number'
            ? (obj.amount_total as number)
            : null

    return {
      provider: 'stripe',
      type,
      externalEventId: evt.id,
      workspaceId: m.workspaceId ?? null,
      planId: m.planId ?? null,
      packSku: m.packSku ?? null,
      amountCents,
      currency: typeof obj.currency === 'string' ? obj.currency.toUpperCase() : null,
      providerCustomerId: typeof obj.customer === 'string' ? obj.customer : null,
      providerSubscriptionId: typeof obj.subscription === 'string' ? obj.subscription : null,
      invoiceId: typeof obj.id === 'string' ? obj.id : null,
      paymentId:
        typeof obj.payment_intent === 'string'
          ? obj.payment_intent
          : typeof obj.id === 'string'
            ? obj.id
            : null,
      cycleEndsAt: null,
      raw: evt,
    }
  },
}
