import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances } from '@/lib/db/schema/billing'

/**
 * Le balance + buckets do workspace. Retorna null se workspace ainda
 * nao tem row em credit_balances (allocate cria a row no primeiro
 * deposito).
 */
export async function getBalanceForWorkspace(workspaceId: string) {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.workspaceId, workspaceId),
  })
  return row ?? null
}
