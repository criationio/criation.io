import { writeFileSync } from 'fs'

import { sql } from 'drizzle-orm'

import { db } from '../src/lib/db'

async function main() {
  const ev = await db.execute(sql`
    select provider, event_id, event_type, processed_at
    from processed_webhook_events
    order by processed_at desc
    limit 10`)
  const tx = await db.execute(sql`
    select workspace_id::text, type, source, amount, idempotency_key, created_at
    from credit_transactions
    where workspace_id = 'ce75fb9b-9771-4f15-8b6b-9c98743297c7'::uuid
    order by created_at desc
    limit 10`)
  writeFileSync(
    '/tmp/criation-webhook-events.json',
    JSON.stringify({ processed_webhook_events: ev, credit_transactions: tx }, null, 2)
  )

  console.log('WROTE')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERR:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  })
