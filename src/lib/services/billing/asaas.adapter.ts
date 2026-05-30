import { env } from '@/env'
import { billingLogger } from '@/lib/logger'

import type {
  BillingAdapter,
  BillingEvent,
  BillingEventType,
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
} from './types'

/**
 * Adapter Asaas (BR) — checkout transparente (Pix + cartão tokenizado).
 * Doc: https://docs.asaas.com/. Auth via header `access_token`. Valores em
 * reais (decimal). Webhook validado pelo header `asaas-access-token`.
 */

const DEFAULT_BASE = 'https://api-sandbox.asaas.com/v3'

function baseUrl(): string {
  return env.ASAAS_BASE_URL ?? DEFAULT_BASE
}

async function asaasFetch<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const apiKey = env.ASAAS_API_KEY
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada')
  const reqInit: RequestInit = {
    method: init.method,
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Criation.io',
    },
  }
  if (init.body !== undefined) reqInit.body = JSON.stringify(init.body)
  const res = await fetch(`${baseUrl()}${path}`, reqInit)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Asaas ${init.method} ${path} -> ${res.status}: ${text.slice(0, 300)}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

function reais(cents: number): number {
  return Math.round(cents) / 100
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** externalReference: `${workspaceId}|${planId}` ou `${workspaceId}|pack:${sku}`. */
function buildExternalRef(workspaceId: string, planOrPack: string): string {
  return `${workspaceId}|${planOrPack}`
}

interface ParsedRef {
  workspaceId: string | null
  planId: string | null
  packSku: string | null
}
function parseExternalRef(ref: string | null | undefined): ParsedRef {
  if (!ref) return { workspaceId: null, planId: null, packSku: null }
  const [ws, tag] = ref.split('|')
  const workspaceId = ws?.trim() || null
  if (!tag) return { workspaceId, planId: null, packSku: null }
  if (tag.startsWith('pack:')) return { workspaceId, planId: null, packSku: tag.slice(5) }
  return { workspaceId, planId: tag.trim(), packSku: null }
}

// --- Webhook payload (tolerante) -----------------------------------------

interface AsaasPayment {
  id: string
  customer?: string
  subscription?: string | null
  value?: number
  externalReference?: string | null
  billingType?: string
  status?: string
}
interface AsaasWebhook {
  id?: string
  event?: string
  payment?: AsaasPayment
  subscription?: { id: string; externalReference?: string | null }
}

function mapEventType(event: string, hasSubscription: boolean): BillingEventType {
  switch (event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      return hasSubscription ? 'invoice_paid' : 'pack_purchased'
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_CHARGEBACK_REQUESTED':
    case 'PAYMENT_CHARGEBACK_DISPUTE':
      return 'charge_refunded'
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      return 'subscription_canceled'
    default:
      return 'ignored'
  }
}

export const asaasAdapter: BillingAdapter = {
  provider: 'asaas',

  async createCustomer(input: CreateCustomerInput) {
    const res = await asaasFetch<{ id: string }>('/customers', {
      method: 'POST',
      body: {
        name: input.name,
        email: input.email,
        cpfCnpj: input.cpfCnpj,
        externalReference: input.workspaceId,
      },
    })
    return { providerCustomerId: res.id }
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // Preço/créditos vêm do catálogo no caller; aqui recebemos só o planId e
    // resolvemos o valor via catálogo no billing.service (passado adiante).
    // O caller injeta valueCents em metadata? Mantemos simples: o billing.service
    // monta o body completo. Esta assinatura usa o catálogo via import tardio.
    const { getPlan } = await import('@/lib/billing/plans')
    const plan = getPlan(input.planId)
    if (!plan) throw new Error(`plano desconhecido: ${input.planId}`)

    const body: Record<string, unknown> = {
      customer: input.providerCustomerId,
      billingType: input.billingType,
      value: reais(plan.monthlyPriceBrlCents),
      nextDueDate: todayIso(),
      cycle: 'MONTHLY',
      description: `Criation.io — Plano ${plan.name}`,
      externalReference: buildExternalRef(input.workspaceId, plan.id),
    }
    if (input.billingType === 'CREDIT_CARD' && input.creditCardToken) {
      body.creditCardToken = input.creditCardToken
    }

    const res = await asaasFetch<{ id: string; status: string; invoiceUrl?: string }>(
      '/subscriptions',
      { method: 'POST', body }
    )
    return {
      providerSubscriptionId: res.id,
      status: res.status,
      invoiceUrl: res.invoiceUrl ?? null,
    }
  },

  async cancelSubscription(providerSubscriptionId: string) {
    await asaasFetch(`/subscriptions/${providerSubscriptionId}`, { method: 'DELETE' })
  },

  async changePlan(providerSubscriptionId: string, newPlanId: string) {
    const { getPlan } = await import('@/lib/billing/plans')
    const plan = getPlan(newPlanId)
    if (!plan) throw new Error(`plano desconhecido: ${newPlanId}`)
    await asaasFetch(`/subscriptions/${providerSubscriptionId}`, {
      method: 'POST',
      body: {
        value: reais(plan.monthlyPriceBrlCents),
        description: `Criation.io — Plano ${plan.name}`,
        updatePendingPayments: true,
      },
    })
  },

  async refund(paymentId: string, amountCents: number | undefined) {
    await asaasFetch(`/payments/${paymentId}/refund`, {
      method: 'POST',
      body: amountCents != null ? { value: reais(amountCents) } : {},
    })
  },

  validateWebhook(_rawBody: string, headers: Headers): boolean {
    const token = headers.get('asaas-access-token')
    const expected = env.ASAAS_WEBHOOK_SECRET
    if (!expected) {
      billingLogger.error({}, 'ASAAS_WEBHOOK_SECRET não configurada — rejeitando webhook')
      return false
    }
    return token === expected
  },

  parseEvent(rawBody: string): BillingEvent {
    const body = JSON.parse(rawBody) as AsaasWebhook
    const event = body.event ?? 'UNKNOWN'
    const payment = body.payment
    const hasSubscription = !!payment?.subscription
    const type = mapEventType(event, hasSubscription)

    const ref = parseExternalRef(payment?.externalReference ?? body.subscription?.externalReference)
    const externalEventId = body.id ?? `${event}_${payment?.id ?? body.subscription?.id ?? 'na'}`

    return {
      provider: 'asaas',
      type,
      externalEventId,
      workspaceId: ref.workspaceId,
      planId: ref.planId,
      packSku: ref.packSku,
      amountCents: payment?.value != null ? Math.round(payment.value * 100) : null,
      currency: 'BRL',
      providerCustomerId: payment?.customer ?? null,
      providerSubscriptionId: payment?.subscription ?? body.subscription?.id ?? null,
      invoiceId: payment?.id ?? null,
      paymentId: payment?.id ?? null,
      cycleEndsAt: null, // calculado no task (now + 1 mês) p/ assinaturas
      raw: body,
    }
  },
}
