import { writeFileSync } from 'fs'

import { sql } from 'drizzle-orm'

import { db } from '../src/lib/db'

async function main() {
  const out: Record<string, unknown> = {}

  const ws = await db.execute(sql`
    select w.id::text as workspace_id, w.name, w.slug, w.plan_id
    from workspaces w
    order by w.created_at asc
    limit 10`)
  out.workspaces = ws

  // dono via workspace_members (role owner/admin)
  const owners = await db.execute(sql`
    select wm.workspace_id::text as workspace_id, wm.user_id::text as user_id,
           wm.role, u.email
    from workspace_members wm
    join users u on u.id = wm.user_id
    where wm.role in ('owner','admin')
    order by wm.created_at asc`)
  out.members = owners

  const bal = await db.execute(sql`
    select workspace_id::text as workspace_id, balance, signup_balance,
           subscription_balance, pack_balance, admin_balance
    from credit_balances`)
  out.balances = bal

  const subs = await db.execute(sql`
    select workspace_id::text as workspace_id, plan_id, status,
           provider_subscription_id, current_cycle_credits_remaining
    from subscriptions`)
  out.subscriptions = subs

  writeFileSync('/tmp/criation-probe.json', JSON.stringify(out, null, 2))

  console.log('WROTE /tmp/criation-probe.json')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('PROBE_ERR:', e instanceof Error ? e.stack : String(e))
    process.exit(1)
  })
