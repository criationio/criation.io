import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { analysisFolders } from '@/lib/db/schema/analyses'

export type AnalysisFolderRow = typeof analysisFolders.$inferSelect

/** Pastas do workspace (planas, compartilhadas). Ordena por nome. */
export async function listFoldersByWorkspace(workspaceId: string): Promise<AnalysisFolderRow[]> {
  return db.query.analysisFolders.findMany({
    where: eq(analysisFolders.workspaceId, workspaceId),
    orderBy: asc(analysisFolders.name),
  })
}

export async function createFolder(input: {
  workspaceId: string
  name: string
  createdBy: string | null
}): Promise<AnalysisFolderRow> {
  const [row] = await db
    .insert(analysisFolders)
    .values({ workspaceId: input.workspaceId, name: input.name, createdBy: input.createdBy })
    .returning()
  if (!row) throw new Error('falha ao criar pasta')
  return row
}

/** Renomeia uma pasta (workspace-scoped). */
export async function renameFolder(workspaceId: string, id: string, name: string): Promise<void> {
  await db
    .update(analysisFolders)
    .set({ name })
    .where(and(eq(analysisFolders.workspaceId, workspaceId), eq(analysisFolders.id, id)))
}

/**
 * Apaga uma pasta (workspace-scoped). As análises dentro dela NÃO são apagadas —
 * `analyses.folder_id` cai pra null pelo `ON DELETE SET NULL` da FK.
 */
export async function deleteFolder(workspaceId: string, id: string): Promise<void> {
  await db
    .delete(analysisFolders)
    .where(and(eq(analysisFolders.workspaceId, workspaceId), eq(analysisFolders.id, id)))
}
