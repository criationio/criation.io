import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances, subscriptions } from '@/lib/db/schema/billing'

export async function getActiveSubscription(workspaceId: string) {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  })
  return row ?? null
}

export async function getCreditBalance(workspaceId: string) {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.workspaceId, workspaceId),
  })
  return row ?? null
}
