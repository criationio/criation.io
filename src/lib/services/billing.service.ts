import { asaasAdapter } from '@/lib/services/billing/asaas.adapter'
import { stripeAdapter } from '@/lib/services/billing/stripe.adapter'
import type {
  BillingAdapter,
  BillingEvent,
  BillingProvider,
  CreateCustomerInput,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
} from '@/lib/services/billing/types'

/**
 * billing.service — abstração sobre Asaas (BR) e Stripe (intl). Sessão 1.12.
 * Roteamento por país (x-vercel-ip-country) com lock ao provider já usado pela
 * assinatura existente (ADR-007). Webhooks normalizam pra BillingEvent.
 */

const ADAPTERS: Record<BillingProvider, BillingAdapter> = {
  asaas: asaasAdapter,
  stripe: stripeAdapter,
}

export function getAdapter(provider: BillingProvider): BillingAdapter {
  return ADAPTERS[provider]
}

/**
 * Provider pro workspace: lock ao já usado (se houver assinatura), senão
 * BR→asaas / resto→stripe.
 */
export function getProviderForWorkspace(
  country: string | null | undefined,
  existingProvider?: string | null
): BillingProvider {
  if (existingProvider === 'asaas' || existingProvider === 'stripe') return existingProvider
  return (country ?? '').toUpperCase() === 'BR' ? 'asaas' : 'stripe'
}

export function createCustomer(provider: BillingProvider, input: CreateCustomerInput) {
  return getAdapter(provider).createCustomer(input)
}

export function createSubscription(
  provider: BillingProvider,
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionResult> {
  return getAdapter(provider).createSubscription(input)
}

export function cancelSubscription(
  provider: BillingProvider,
  providerSubscriptionId: string,
  idempotencyKey: string
) {
  return getAdapter(provider).cancelSubscription(providerSubscriptionId, idempotencyKey)
}

export function changePlan(
  provider: BillingProvider,
  providerSubscriptionId: string,
  newPlanId: string,
  idempotencyKey: string
) {
  return getAdapter(provider).changePlan(providerSubscriptionId, newPlanId, idempotencyKey)
}

export function refund(
  provider: BillingProvider,
  paymentId: string,
  amountCents: number | undefined,
  idempotencyKey: string
) {
  return getAdapter(provider).refund(paymentId, amountCents, idempotencyKey)
}

/** Valida + normaliza um webhook. Lança se a assinatura falhar (fail closed). */
export function handleWebhook(
  provider: BillingProvider,
  rawBody: string,
  headers: Headers
): BillingEvent {
  const adapter = getAdapter(provider)
  if (!adapter.validateWebhook(rawBody, headers)) {
    throw new Error(`assinatura de webhook inválida (${provider})`)
  }
  return adapter.parseEvent(rawBody)
}
