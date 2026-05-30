import { writeFileSync } from 'fs'

import { asaasAdapter } from '../src/lib/services/billing/asaas.adapter'

/**
 * E2E sandbox 1.12 — cria customer + assinatura (PIX) pro workspace me@criation.io
 * e "recebe em dinheiro" o 1o pagamento, disparando PAYMENT_RECEIVED → webhook →
 * process-billing-event → allocate (plano pro = 120 créditos).
 */

const WORKSPACE_ID = 'ce75fb9b-9771-4f15-8b6b-9c98743297c7' // me@criation.io
const USER_ID = '3ad82f80-31f1-4a6c-8cd8-44f80f644566' // owner me@criation.io
const PLAN_ID = 'pro'
const CNPJ = '62213634000180' // CNPJ real da conta (valido no sandbox)
const BASE = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3'
const KEY = process.env.ASAAS_API_KEY as string

async function asaas<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { access_token: KEY, 'Content-Type': 'application/json', 'User-Agent': 'Criation.io' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Asaas ${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`)
  return (text ? JSON.parse(text) : {}) as T
}

async function main() {
  const out: Record<string, unknown> = {}

  const customer = await asaasAdapter.createCustomer({
    workspaceId: WORKSPACE_ID,
    name: 'Vinicius (E2E 1.12)',
    email: 'me@criation.io',
    cpfCnpj: CNPJ,
  })
  out.customer = customer

  const sub = await asaasAdapter.createSubscription({
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    planId: PLAN_ID,
    providerCustomerId: customer.providerCustomerId,
    billingType: 'PIX',
    idempotencyKey: `e2e_sub_${WORKSPACE_ID}_${PLAN_ID}`,
  })
  out.subscription = sub

  const payments = await asaas<{ data: Array<{ id: string; status: string; value: number }> }>(
    `/payments?subscription=${sub.providerSubscriptionId}`,
    'GET'
  )
  out.payments = payments.data
  const firstPayment = payments.data[0]
  if (!firstPayment) throw new Error('assinatura sem pagamento gerado')

  const today = new Date().toISOString().slice(0, 10)
  const received = await asaas(`/payments/${firstPayment.id}/receiveInCash`, 'POST', {
    paymentDate: today,
    value: firstPayment.value,
    notifyCustomer: false,
  })
  out.receivedInCash = received

  writeFileSync('/tmp/criation-sub.json', JSON.stringify(out, null, 2))

  console.log(
    'OK sub=',
    sub.providerSubscriptionId,
    'payment=',
    firstPayment.id,
    'value=',
    firstPayment.value
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('CREATE_SUB_ERR:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
