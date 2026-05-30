import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { analyses, analysisResults } from '@/lib/db/schema/analyses'

export type AnalysisRow = typeof analyses.$inferSelect
export type AnalysisResultRow = typeof analysisResults.$inferSelect
export type NewAnalysis = typeof analyses.$inferInsert
export type NewAnalysisResult = typeof analysisResults.$inferInsert

/** Cria a row de análise no estado inicial (status='queued'). Retorna a row. */
export async function createAnalysis(input: NewAnalysis): Promise<AnalysisRow> {
  const [row] = await db.insert(analyses).values(input).returning()
  if (!row) throw new Error('falha ao criar analysis')
  return row
}

/**
 * Patch parcial do status/timing/erro da análise. `updatedAt` é gerenciado
 * pelo $onUpdate do schema.
 */
export async function updateAnalysisStatus(
  id: string,
  patch: Partial<
    Pick<
      NewAnalysis,
      | 'status'
      | 'startedAt'
      | 'completedAt'
      | 'errorMessage'
      | 'triggerJobId'
      | 'creditsConsumed'
      | 'creditTransactionId'
    >
  >
): Promise<void> {
  await db.update(analyses).set(patch).where(eq(analyses.id, id))
}

/** Persiste o resultado do pipeline (1:1 com analysis via unique constraint). */
export async function insertAnalysisResult(input: NewAnalysisResult): Promise<AnalysisResultRow> {
  const [row] = await db.insert(analysisResults).values(input).returning()
  if (!row) throw new Error('falha ao persistir analysis_result')
  return row
}

export interface AnalysisWithResult {
  analysis: AnalysisRow
  result: AnalysisResultRow | null
}

/**
 * Carrega uma análise do workspace + seu resultado (null enquanto pendente).
 * Filtra por workspaceId pra isolamento (defesa em profundidade além da RLS).
 */
export async function getAnalysisById(
  workspaceId: string,
  id: string
): Promise<AnalysisWithResult | null> {
  const analysis = await db.query.analyses.findFirst({
    where: and(eq(analyses.workspaceId, workspaceId), eq(analyses.id, id)),
  })
  if (!analysis) return null

  const result = await db.query.analysisResults.findFirst({
    where: eq(analysisResults.analysisId, id),
  })
  return { analysis, result: result ?? null }
}

/**
 * Últimas análises do workspace (histórico). Ordena por created_at desc.
 * `folderId`: ausente (undefined) = todas; `null` = só sem pasta; string = pasta.
 */
export async function listAnalysesByWorkspace(
  workspaceId: string,
  opts: { limit?: number | undefined; folderId?: string | null | undefined } = {}
): Promise<AnalysisRow[]> {
  const { limit = 50, folderId } = opts
  const folderFilter =
    folderId === undefined
      ? undefined
      : folderId === null
        ? isNull(analyses.folderId)
        : eq(analyses.folderId, folderId)

  return db.query.analyses.findMany({
    where: and(eq(analyses.workspaceId, workspaceId), folderFilter),
    orderBy: desc(analyses.createdAt),
    limit,
  })
}

/** Move (ou remove de) uma análise pra uma pasta. folderId null = sem pasta. */
export async function setAnalysisFolder(
  workspaceId: string,
  id: string,
  folderId: string | null
): Promise<void> {
  await db
    .update(analyses)
    .set({ folderId })
    .where(and(eq(analyses.workspaceId, workspaceId), eq(analyses.id, id)))
}

/** Renomeia uma análise (workspace-scoped). */
export async function updateAnalysisName(
  workspaceId: string,
  id: string,
  name: string
): Promise<void> {
  await db
    .update(analyses)
    .set({ name })
    .where(and(eq(analyses.workspaceId, workspaceId), eq(analyses.id, id)))
}

/**
 * Apaga uma análise permanentemente (workspace-scoped). `analysis_results` cai
 * por cascade FK; `credit_transactions` permanece (auditoria do consumo).
 */
export async function deleteAnalysis(workspaceId: string, id: string): Promise<void> {
  await db.delete(analyses).where(and(eq(analyses.workspaceId, workspaceId), eq(analyses.id, id)))
}
