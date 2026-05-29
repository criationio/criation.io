import { analyze } from '@/lib/services/claude.service'
import { analysisQuickPrompt } from '@/lib/claude/prompts'
import {
  getCampaignHeader,
  getCampaignKpis,
  getCreativeForAnalysis,
  type CampaignDetailHeader,
  type CampaignKpiSnapshot,
  type CreativeForAnalysis,
} from '@/lib/db/queries/campaign-detail'
import { getTransactionByIdempotencyKey } from '@/lib/db/queries/credits'
import { insertAnalysisResult, updateAnalysisStatus } from '@/lib/db/queries/analyses'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'
import { eq } from 'drizzle-orm'
import {
  blocoTransicaoSchema,
  type BlocoTransicao,
  type funnelMetricsSchema,
} from '@/lib/validators/bloco-transicao'
import type { z } from 'zod'
import { analysisLogger } from '@/lib/logger'

/**
 * analysis.service — orquestra o pipeline `analisar.video_ad` (Quick, Sessão 1.9).
 *
 * Disparado pela task Trigger.dev `estudio-analisar-video-ad`. Monta o BLOCO DE
 * TRANSIÇÃO a partir de dados já no DB (Meta insights + gateway + criativo +
 * perfil do usuário), chama claude.service.analyze (que aplica budget hard-cap +
 * gates de crédito) e persiste o resultado. NÃO chama Server Actions (Regra 2).
 *
 * Erro esperado = shape discriminado { ok:false, error } (Regra 7).
 */

type FunnelMetrics = z.infer<typeof funnelMetricsSchema>

const PIPELINE_ID = 'analisar.video_ad'

// --- Heurística de gargalo -----------------------------------------------

// Thresholds de mercado BR (infoproduto/e-commerce). Calibrados grosso —
// servem só como DICA pro Claude, que recalibra com o contexto completo.
const CTR_WEAK_PCT = 1.0 // CTR abaixo disso = criativo não está prendendo
const CVR_WEAK_PCT = 1.0 // conversão cliques→compra abaixo disso = landing/oferta
const ROAS_WEAK = 1.0 // abaixo de 1 = prejuízo
const MIN_IMPRESSIONS = 1000 // volume mínimo pra confiar no CTR
const MIN_CLICKS = 50 // volume mínimo pra confiar na conversão

/**
 * Detecta heuristicamente a maior alavanca do funil a partir das métricas.
 * Pura e testável. O Claude usa isto como ponto de partida, não como verdade.
 */
export function detectBottleneckHint(m: FunnelMetrics): BlocoTransicao['bottleneckHint'] {
  const cvr = m.clicks > 0 ? (m.conversions / m.clicks) * 100 : null

  // 1. Impressões em volume mas CTR baixo → o criativo/hook não converte view em clique.
  if (m.impressions >= MIN_IMPRESSIONS && m.ctr != null && m.ctr < CTR_WEAK_PCT) {
    return {
      type: 'low_ctr',
      stage: 'creative',
      severity: m.ctr < CTR_WEAK_PCT / 2 ? 'high' : 'medium',
    }
  }

  // 2. Cliques chegam mas não viram venda → landing/checkout/oferta.
  if (m.clicks >= MIN_CLICKS && cvr != null && cvr < CVR_WEAK_PCT) {
    return {
      type: 'low_conversion',
      stage: 'landing',
      severity: cvr < CVR_WEAK_PCT / 2 ? 'high' : 'medium',
    }
  }

  // 3. Converte mas ROAS ruim → precificação/oferta.
  if (m.roas != null && m.spend > 0 && m.roas < ROAS_WEAK) {
    return {
      type: 'low_roas',
      stage: 'offer',
      severity: m.roas < ROAS_WEAK / 2 ? 'high' : 'medium',
    }
  }

  // 4. Sem gargalo claro ou dados insuficientes.
  return { type: 'baseline', stage: 'overall', severity: 'low' }
}

// --- Builder do BLOCO DE TRANSIÇÃO ---------------------------------------

const AD_SPEND_LABEL: Record<string, string> = {
  lt10k: 'até R$10k/mês',
  '10k_50k': 'R$10k–50k/mês',
  '50k_100k': 'R$50k–100k/mês',
  '100k_300k': 'R$100k–300k/mês',
  gt300k: 'acima de R$300k/mês',
}

function centsToReais(cents: number | null): number | null {
  return cents == null ? null : Math.round(cents) / 100
}

interface ProfileContext {
  niche?: string
  monthlyAdSpend?: string
}

/**
 * Monta o BLOCO DE TRANSIÇÃO (input padronizado do claude.service). Money em
 * reais (BRL) e CTR em % pra legibilidade do LLM. Métricas de vídeo
 * (hookRate/holdRate) saem null — Meta v25 descontinuou video_*_sec_watched.
 */
export function buildBlocoTransicao(args: {
  campaign: CampaignDetailHeader
  kpis: CampaignKpiSnapshot
  creative: CreativeForAnalysis
  profileContext: ProfileContext | null
  extraContext?: string | null | undefined
}): BlocoTransicao {
  const { campaign, kpis, creative, profileContext, extraContext } = args

  const funnelMetrics: FunnelMetrics = {
    hookRate: null,
    holdRate: null,
    ctr: kpis.ctrPct,
    cpa: centsToReais(kpis.cpaCents),
    roas: kpis.roas,
    impressions: kpis.impressions,
    clicks: kpis.clicks,
    conversions: kpis.conversions,
    spend: centsToReais(kpis.spendCents) ?? 0,
  }

  const copyText = [creative.title, creative.body].filter((t) => t && t.trim()).join('\n\n')
  const adSpend = profileContext?.monthlyAdSpend
  const investmentRange = adSpend ? (AD_SPEND_LABEL[adSpend] ?? adSpend) : null

  const bloco: BlocoTransicao = {
    campaignContext: {
      name: campaign.name,
      objective: campaign.objective ?? 'não informado',
      platform: campaign.provider === 'google' ? 'google' : 'meta',
      budgetDaily: centsToReais(campaign.dailyBudgetCents),
      audience: null,
      creativeType: creative.type ?? null,
      productType: null,
      ticketRange: null,
    },
    funnelMetrics,
    bottleneckHint: detectBottleneckHint(funnelMetrics),
    creativeData: {
      copyText: copyText.length > 0 ? copyText : '(sem texto de copy disponível)',
      creativeUrl: creative.videoUrl ?? creative.thumbnailUrl ?? null,
    },
    userContext: {
      niche: profileContext?.niche ?? null,
      investmentRange,
      profileContextFreeform: extraContext?.trim() ? extraContext.trim() : null,
    },
  }

  return bloco
}

// --- Orquestração --------------------------------------------------------

export type RunAnalysisResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } }

interface RunVideoAdAnalysisInput {
  analysisId: string
  workspaceId: string
  userId: string
  planId?: string | null | undefined
  campaignId: string
  creativeId: string
  extraContext?: string | null | undefined
}

/**
 * Executa o pipeline analisar.video_ad fim-a-fim para uma análise já criada
 * (status='running' setado pela task antes de chamar). Monta o bloco, chama
 * analyze (budget + créditos), persiste resultado e atualiza status.
 */
export async function runVideoAdAnalysis(
  input: RunVideoAdAnalysisInput
): Promise<RunAnalysisResult> {
  const { analysisId, workspaceId, userId, planId, campaignId, creativeId, extraContext } = input

  // 1. Coleta de dados (período: últimos 30d).
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [campaign, creative, userRow] = await Promise.all([
    getCampaignHeader({ workspaceId, campaignId }),
    getCreativeForAnalysis({ workspaceId, creativeId }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { profileContext: true } }),
  ])

  if (!campaign) {
    return await fail(analysisId, 'CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.')
  }
  if (!creative) {
    return await fail(analysisId, 'CREATIVE_NOT_FOUND', 'Criativo não encontrado.')
  }

  const kpis = await getCampaignKpis({ workspaceId, campaignId, start, end })

  // 2. Monta + valida o bloco antes de gastar request Claude.
  let bloco: BlocoTransicao
  try {
    bloco = buildBlocoTransicao({
      campaign,
      kpis,
      creative,
      profileContext: (userRow?.profileContext as ProfileContext | null) ?? null,
      extraContext,
    })
  } catch (err) {
    analysisLogger.error({ analysisId, err: String(err) }, 'falha ao montar bloco de transição')
    return await fail(analysisId, 'BLOCO_BUILD_FAILED', 'Falha ao montar contexto da análise.')
  }

  const parsed = blocoTransicaoSchema.safeParse(bloco)
  if (!parsed.success) {
    analysisLogger.error(
      { analysisId, issues: parsed.error.issues },
      'bloco de transição inválido — abortando antes do Claude'
    )
    return await fail(analysisId, 'BLOCO_INVALID', 'Contexto da análise inválido.')
  }

  // 3. Chama o Claude (budget hard-cap + gates de crédito dentro de analyze).
  const result = await analyze(
    analysisQuickPrompt,
    parsed.data,
    {
      workspaceId,
      userId,
      planId: planId ?? null,
      analysisId,
      credits: { cost: 1, idempotencyKey: analysisId },
    },
    { judge: true }
  )

  if (!result.ok) {
    return await fail(analysisId, result.error.code, result.error.message)
  }

  // 4. Persiste resultado + marca completed. Propaga crédito consumido.
  const tx = await getTransactionByIdempotencyKey(analysisId)
  await insertAnalysisResult({
    analysisId,
    workspaceId,
    pipelineId: PIPELINE_ID,
    resultData: result.data,
    modelUsed: result.usage.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    processingTimeMs: result.usage.latencyMs,
  })
  await updateAnalysisStatus(analysisId, {
    status: 'completed',
    completedAt: new Date(),
    creditsConsumed: tx?.amount ? Math.abs(tx.amount) : 1,
    creditTransactionId: tx?.id ?? null,
  })

  analysisLogger.info(
    { analysisId, workspaceId, model: result.usage.model, costUsd: result.usage.costUsd },
    'analisar.video_ad concluído'
  )
  return { ok: true }
}

async function fail(analysisId: string, code: string, message: string): Promise<RunAnalysisResult> {
  await updateAnalysisStatus(analysisId, {
    status: 'failed',
    completedAt: new Date(),
    errorMessage: `${code}: ${message}`,
  })
  return { ok: false, error: { code, message } }
}
