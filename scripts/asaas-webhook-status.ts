import { writeFileSync } from 'fs'

const KEY = process.env.ASAAS_API_KEY as string
const BASE = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3'

async function get(path: string): Promise<{ status: number; body: string }> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { access_token: KEY, 'User-Agent': 'Criation.io' },
  })
  return { status: r.status, body: await r.text() }
}

async function main() {
  const out: Record<string, unknown> = {}
  out.webhooks = await get('/webhooks')
  // status do pagamento recebido (confirma se virou RECEIVED)
  out.payment = await get('/payments/pay_pu0clvedx6jd6jsl')
  writeFileSync('/tmp/asaas-webhook-status.json', JSON.stringify(out, null, 2))
}

main()
  .then(() => {
    console.log('DONE')
  })
  .catch((e) => {
    writeFileSync('/tmp/asaas-webhook-status.json', JSON.stringify({ threw: String(e) }))

    console.log('THREW')
  })
