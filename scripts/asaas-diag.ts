import { writeFileSync } from 'fs'

const KEY = process.env.ASAAS_API_KEY as string
const BASE = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3'

async function get(path: string): Promise<{ status: number; body: string }> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { access_token: KEY, 'User-Agent': 'Criation.io' },
  })
  return { status: r.status, body: await r.text() }
}

async function post(path: string, body: unknown): Promise<{ status: number; body: string }> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { access_token: KEY, 'Content-Type': 'application/json', 'User-Agent': 'Criation.io' },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.text() }
}

async function main() {
  const out: Record<string, unknown> = {}

  // 1. status de habilitação da conta (o que falta pra cobrar)
  out.accountStatus = await get('/myAccount/status')

  // 2. cria customer fresco
  const cust = await post('/customers', {
    name: 'Diag E2E',
    email: 'me@criation.io',
    cpfCnpj: '62213634000180',
    externalReference: 'ce75fb9b-9771-4f15-8b6b-9c98743297c7',
  })
  out.createCustomer = cust

  // 3. tenta pagamento avulso com esse customer
  let custId: string | null = null
  try {
    custId = (JSON.parse(cust.body) as { id?: string }).id ?? null
  } catch {
    custId = null
  }
  if (custId) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    out.createPayment = await post('/payments', {
      customer: custId,
      billingType: 'PIX',
      value: 297,
      dueDate: tomorrow,
      description: 'Diag one-time',
    })
  }

  writeFileSync('/tmp/asaas-diag-out.json', JSON.stringify(out, null, 2))
}

main()
  .then(() => {
    console.log('DIAG_DONE')
  })
  .catch((e) => {
    writeFileSync('/tmp/asaas-diag-out.json', JSON.stringify({ threw: String(e) }, null, 2))

    console.log('DIAG_THREW')
  })
