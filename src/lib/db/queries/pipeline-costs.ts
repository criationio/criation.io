import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { pipelineCosts } from '@/lib/db/schema/billing'

/**
 * Custo em créditos de um pipeline (seed em src/lib/db/seeds/index.ts).
 * Retorna null se o pipeline não tem custo ativo cadastrado — o caller
 * decide como tratar (UI mostra "—", action bloqueia).
 */
export async function getPipelineCost(pipelineId: string): Promise<number | null> {
  const row = await db.query.pipelineCosts.findFirst({
    where: and(eq(pipelineCosts.pipelineId, pipelineId), eq(pipelineCosts.active, true)),
    columns: { costCredits: true },
  })
  return row?.costCredits ?? null
}
