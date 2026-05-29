'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import {
  createAnalysis as insertAnalysis,
  getAnalysisById,
  updateAnalysisStatus,
} from '@/lib/db/queries/analyses'
import { getActiveSubscription } from '@/lib/db/queries/billing'
import { getCampaignCreatives, type CampaignCreative } from '@/lib/db/queries/campaign-detail'
import { getPipelineCost } from '@/lib/db/queries/pipeline-costs'
import { getUser } from '@/lib/supabase/server'
import { checkBalance } from '@/lib/services/credit.service'
import { triggerEstudioAnalisarVideoAd } from '@/lib/trigger/client'
import { analysisLogger } from '@/lib/logger'
import { createAnalysisSchema } from '@/lib/validators/analysis'

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

  const { campaignId, creativeId, extraContext } = parsed.data
  const analysis = await insertAnalysis({
    workspaceId: ctx.data.workspaceId,
    userId: ctx.data.userId,
    pipelineId: PIPELINE_ID,
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
