import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { alerts } from '@/lib/db/schema/alerts'

/**
 * Conta alertas nao lidos da workspace. Fonte de verdade do badge no
 * item "Alertas" do sidebar — separada de notifications (que inclui
 * analises e sistema). Ate alerts.job (Sessao 2.7-2.8) popular essa
 * tabela, retorna 0.
 */
export async function countUnreadAlertsByWorkspace(workspaceId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(eq(alerts.workspaceId, workspaceId), isNull(alerts.readAt)))

  return result[0]?.count ?? 0
}
