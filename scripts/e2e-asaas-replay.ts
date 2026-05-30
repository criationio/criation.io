import { sql } from 'drizzle-orm'

import { db } from '../src/lib/db'

const TUNNEL = process.env.E2E_TUNNEL_URL ?? 'https://floors-hood-heavy-guru.trycloudflare.com'

async function main() {
  const r = await db.execute(sql`
    select event_id, payload
    from processed_webhook_events
    where provider = 'asaas' and event_type = 'invoice_paid'
    order by processed_at desc
    limit 1`)
  const row = (r.rows ?? r)[0] as { event_id: string; payload: unknown }
  if (!row) throw new Error('nenhum invoice_paid em processed_webhook_events')

  const res = await fetch(`${TUNNEL}/api/webhooks/asaas`, {
    method: 'POST',
    headers: {
      'asaas-access-token': process.env.ASAAS_WEBHOOK_SECRET as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(row.payload),
  })

  console.log('replay event_id:', row.event_id)

  console.log('replay status:', res.status, '| body:', await res.text())
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('REPLAY_ERR:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
