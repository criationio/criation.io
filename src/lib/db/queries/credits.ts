import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances, creditTransactions } from '@/lib/db/schema/billing'

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

/**
 * Resolve a transação de crédito por idempotencyKey. Usado após
 * `claude.service.analyze` consumir (consume usa analysisId como
 * idempotencyKey) pra gravar credit_transaction_id na row de análise.
 */
export async function getTransactionByIdempotencyKey(
  idempotencyKey: string
): Promise<{ id: string; amount: number } | null> {
  const row = await db.query.creditTransactions.findFirst({
    where: eq(creditTransactions.idempotencyKey, idempotencyKey),
    columns: { id: true, amount: true },
  })
  return row ?? null
}
