import { writeFileSync } from 'fs'

/**
 * E2E sandbox 1.12 — assinatura CARTÃO com cartão de teste do Asaas (auto-aprovado).
 * Dispara PAYMENT_CONFIRMED real (com subscription) → webhook → invoice_paid →
 * allocate (plano pro = 120 créditos). receiveInCash NÃO dispara webhook, por isso
 * a tentativa PIX anterior não alocou.
 */

const WORKSPACE_ID = 'ce75fb9b-9771-4f15-8b6b-9c98743297c7' // me@criation.io
const BASE = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3'
const KEY = process.env.ASAAS_API_KEY as string

async function asaas(path: string, method: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { access_token: KEY, 'Content-Type': 'application/json', 'User-Agent': 'Criation.io' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: await r.text() }
}

async function main() {
  const out: Record<string, unknown> = {}

  const today = new Date().toISOString().slice(0, 10)

  // customer fresco
  const c = await asaas('/customers', 'POST', {
    name: 'Vinicius E2E Card',
    email: 'me@criation.io',
    cpfCnpj: '62213634000180',
    externalReference: WORKSPACE_ID,
  })
  out.customer = c
  const custId = (JSON.parse(c.body) as { id: string }).id

  // assinatura CARTÃO — cartão de teste sandbox auto-aprova → PAYMENT_CONFIRMED
  const sub = await asaas('/subscriptions', 'POST', {
    customer: custId,
    billingType: 'CREDIT_CARD',
    value: 297,
    nextDueDate: today,
    cycle: 'MONTHLY',
    description: 'Criation.io — Plano Pro',
    externalReference: `${WORKSPACE_ID}|pro`,
    creditCard: {
      holderName: 'VINICIUS TESTE',
      number: '5162306219378829',
      expiryMonth: '05',
      expiryYear: '2028',
      ccv: '318',
    },
    creditCardHolderInfo: {
      name: 'Vinicius Teste',
      email: 'me@criation.io',
      cpfCnpj: '62213634000180',
      postalCode: '06544072',
      addressNumber: '235',
      phone: '11985890630',
    },
    remoteIp: '187.10.20.30',
  })
  out.subscription = sub

  writeFileSync('/tmp/criation-card-sub.json', JSON.stringify(out, null, 2))

  console.log('SUB_STATUS=' + sub.status)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    writeFileSync('/tmp/criation-card-sub.json', JSON.stringify({ threw: String(e) }))

    console.log('THREW')
    process.exit(1)
  })
