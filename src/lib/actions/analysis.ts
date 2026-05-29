'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import {
  createAnalysis as insertAnalysis,
  deleteAnalysis as deleteAnalysisQuery,
  getAnalysisById,
  setAnalysisFolder,
  updateAnalysisName,
  updateAnalysisStatus,
} from '@/lib/db/queries/analyses'
import {
  createFolder as createFolderQuery,
  deleteFolder as deleteFolderQuery,
  listFoldersByWorkspace,
  renameFolder as renameFolderQuery,
  type AnalysisFolderRow,
} from '@/lib/db/queries/analysis-folders'
import { getActiveSubscription } from '@/lib/db/queries/billing'
import { getCampaignCreatives, type CampaignCreative } from '@/lib/db/queries/campaign-detail'
import { listCampaignsWithMetrics } from '@/lib/db/queries/campaigns'
import { getPipelineCost } from '@/lib/db/queries/pipeline-costs'
import { getUser } from '@/lib/supabase/server'
import { checkBalance } from '@/lib/services/credit.service'
import { triggerEstudioAnalisarVideoAd } from '@/lib/trigger/client'
import { analysisLogger } from '@/lib/logger'
import {
  createAnalysisSchema,
  createFolderSchema,
  moveAnalysisSchema,
  renameAnalysisSchema,
  renameFolderSchema,
} from '@/lib/validators/analysis'
import { revalidatePath } from 'next/cache'

const PIPELINE_ID = 'analisar.video_ad'

interface Ok<T> {
  ok: true
  data: T
}
interface Err {
  ok: false
  error: { code: string; message: string }
}
type Result<T> = Ok<T> | Err

interface AnalysisContext {
  userId: string
  workspaceId: string
  planId: string | null
}

async function resolveContext(): Promise<Result<AnalysisContext>> {
  const user = await getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Login necessário' } }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    return { ok: false, error: { code: 'NO_WORKSPACE', message: 'Workspace não encontrado' } }
  }

  const sub = await getActiveSubscription(workspaceId)
  return { ok: true, data: { userId: user.id, workspaceId, planId: sub?.planId ?? null } }
}

/**
 * Cria uma análise e dispara o pipeline async (Trigger.dev). Thin controller
 * (Regra 1): valida → resolve contexto → preflight de saldo → cria row →
 * dispara task → grava trigger_job_id. A cobrança real acontece dentro de
 * analyze (§4.11); aqui o checkBalance só evita gastar job sem saldo.
 */
export async function createAnalysis(input: unknown): Promise<Result<{ analysisId: string }>> {
  const parsed = createAnalysisSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'inválido' },
    }
  }

  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  const cost = (await getPipelineCost(PIPELINE_ID)) ?? 1
  const preflight = await checkBalance(ctx.data.workspaceId, cost, { safetyFactor: 1.5 })
  if (!preflight.ok) {
    return {
      ok: false,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: `Créditos insuficientes: ${preflight.available} disponível, ${cost} necessário.`,
      },
    }
  }

  const { campaignId, creativeId, extraContext, name } = parsed.data
  const analysis = await insertAnalysis({
    workspaceId: ctx.data.workspaceId,
    userId: ctx.data.userId,
    pipelineId: PIPELINE_ID,
    name: name ?? null,
    status: 'queued',
    inputType: 'video_ad',
    inputText: extraContext ?? null,
  })

  try {
    const handle = await triggerEstudioAnalisarVideoAd({
      analysisId: analysis.id,
      workspaceId: ctx.data.workspaceId,
      userId: ctx.data.userId,
      planId: ctx.data.planId,
      campaignId,
      creativeId,
      extraContext,
    })
    await updateAnalysisStatus(analysis.id, { triggerJobId: handle.id })
  } catch (err) {
    analysisLogger.error(
      { analysisId: analysis.id, err: String(err) },
      'falha ao disparar pipeline'
    )
    await updateAnalysisStatus(analysis.id, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'TRIGGER_FAILED: não foi possível iniciar a análise',
    })
    return {
      ok: false,
      error: { code: 'TRIGGER_FAILED', message: 'Não foi possível iniciar a análise.' },
    }
  }

  return { ok: true, data: { analysisId: analysis.id } }
}

export interface PickerCampaign {
  id: string
  name: string
  status: string
}

/**
 * Lista campanhas ACTIVE de uma ad account (nível 2 do seletor em cascata da
 * /estudio/analisar/nova). adAccountId = provider id (ex: "617..."). Read-only.
 */
export async function getCampaignsForPicker(
  adAccountId: string
): Promise<Result<PickerCampaign[]>> {
  if (!adAccountId) return { ok: false, error: { code: 'INVALID', message: 'conta necessária' } }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const { rows } = await listCampaignsWithMetrics({
    workspaceId: ctx.data.workspaceId,
    adAccountId,
    status: 'ACTIVE',
    start,
    end,
    limit: 500,
  })
  return { ok: true, data: rows.map((r) => ({ id: r.id, name: r.name, status: r.status })) }
}

/**
 * Status atual de uma análise (workspace-scoped). Usado pelo polling do
 * client (`RunningWatcher`) na página /estudio/analisar/[id] enquanto a análise
 * roda — quando vira completed/failed, o client faz router.refresh() pra
 * renderizar o resultado server-side. Read-only.
 */
export async function getAnalysisStatus(id: string): Promise<Result<{ status: string }>> {
  if (!id) return { ok: false, error: { code: 'INVALID', message: 'id necessário' } }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  const data = await getAnalysisById(ctx.data.workspaceId, id)
  if (!data) return { ok: false, error: { code: 'NOT_FOUND', message: 'análise não encontrada' } }
  return { ok: true, data: { status: data.analysis.status } }
}

/** Renomeia uma análise (workspace-scoped). */
export async function renameAnalysis(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = renameAnalysisSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'inválido' },
    }
  }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  await updateAnalysisName(ctx.data.workspaceId, parsed.data.id, parsed.data.name)
  revalidatePath('/estudio/analisar')
  revalidatePath(`/estudio/analisar/${parsed.data.id}`)
  return { ok: true, data: { id: parsed.data.id } }
}

/** Apaga uma análise permanentemente (workspace-scoped). */
export async function deleteAnalysis(id: string): Promise<Result<{ id: string }>> {
  if (!id) return { ok: false, error: { code: 'INVALID', message: 'id necessário' } }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  await deleteAnalysisQuery(ctx.data.workspaceId, id)
  revalidatePath('/estudio/analisar')
  return { ok: true, data: { id } }
}

// --- Pastas (Commit C) ---------------------------------------------------

export async function listFolders(): Promise<Result<AnalysisFolderRow[]>> {
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx
  return { ok: true, data: await listFoldersByWorkspace(ctx.data.workspaceId) }
}

export async function createFolder(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = createFolderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'inválido' },
    }
  }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  const folder = await createFolderQuery({
    workspaceId: ctx.data.workspaceId,
    name: parsed.data.name,
    createdBy: ctx.data.userId,
  })
  revalidatePath('/estudio/analisar')
  return { ok: true, data: { id: folder.id } }
}

export async function renameFolder(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = renameFolderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'inválido' },
    }
  }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  await renameFolderQuery(ctx.data.workspaceId, parsed.data.id, parsed.data.name)
  revalidatePath('/estudio/analisar')
  return { ok: true, data: { id: parsed.data.id } }
}

/** Apaga uma pasta. As análises dentro dela voltam pra "sem pasta" (FK SET NULL). */
export async function deleteFolder(id: string): Promise<Result<{ id: string }>> {
  if (!id) return { ok: false, error: { code: 'INVALID', message: 'id necessário' } }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  await deleteFolderQuery(ctx.data.workspaceId, id)
  revalidatePath('/estudio/analisar')
  return { ok: true, data: { id } }
}

/** Move uma análise pra uma pasta (folderId null = tira da pasta). */
export async function moveAnalysisToFolder(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = moveAnalysisSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'inválido' },
    }
  }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  await setAnalysisFolder(ctx.data.workspaceId, parsed.data.analysisId, parsed.data.folderId)
  revalidatePath('/estudio/analisar')
  revalidatePath(`/estudio/analisar/${parsed.data.analysisId}`)
  return { ok: true, data: { id: parsed.data.analysisId } }
}

/**
 * Lista os criativos de uma campanha pro segundo passo do seletor (form da
 * /estudio/analisar/nova). Read-only, isolado por workspace.
 */
export async function getCreativesForPicker(
  campaignId: string
): Promise<Result<CampaignCreative[]>> {
  if (!campaignId) return { ok: false, error: { code: 'INVALID', message: 'campanha necessária' } }
  const ctx = await resolveContext()
  if (!ctx.ok) return ctx

  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  const creatives = await getCampaignCreatives({
    workspaceId: ctx.data.workspaceId,
    campaignId,
    start,
    end,
  })
  return { ok: true, data: creatives }
}
