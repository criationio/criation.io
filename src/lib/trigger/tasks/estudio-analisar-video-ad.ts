import { logger, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { updateAnalysisStatus } from '@/lib/db/queries/analyses'
import { runVideoAdAnalysis } from '@/lib/services/analysis.service'

export interface EstudioAnalisarVideoAdPayload {
  analysisId: string
  workspaceId: string
  userId: string
  planId?: string | null | undefined
  campaignId: string
  creativeId: string
  extraContext?: string | null | undefined
  correlationId?: string | undefined
}

/**
 * Pipeline `analisar.video_ad` (Quick) — Sessão 1.9.
 *
 * Disparado via tasks.trigger() da Server Action createAnalysis depois de criar
 * a row em `analyses` (status='queued'). Marca running, delega ao
 * analysis.service (monta bloco + analyze + persiste) e fecha completed/failed.
 *
 * O analysis.service já grava status='failed' nos erros de fluxo; este wrapper
 * cobre exceções inesperadas (throw) como rede de segurança.
 */
export const estudioAnalisarVideoAdTask = task({
  id: 'estudio-analisar-video-ad',
  maxDuration: 120, // 2min — Quick é ~30s; folga pra retry de validação/judge.
  run: async (payload: EstudioAnalisarVideoAdPayload) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const { analysisId, workspaceId, userId, planId, campaignId, creativeId, extraContext } =
        payload

      logger.info('estudio-analisar-video-ad iniciado', { correlationId: cid, analysisId })

      await updateAnalysisStatus(analysisId, { status: 'running', startedAt: new Date() })

      try {
        const result = await runVideoAdAnalysis({
          analysisId,
          workspaceId,
          userId,
          planId,
          campaignId,
          creativeId,
          extraContext,
        })

        if (!result.ok) {
          logger.warn('estudio-analisar-video-ad falhou', {
            analysisId,
            error: result.error,
          })
        }
        return result
      } catch (err) {
        // Exceção inesperada — service só marca failed nos erros de fluxo.
        logger.error('estudio-analisar-video-ad exceção', { analysisId, err: String(err) })
        await updateAnalysisStatus(analysisId, {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: `UNEXPECTED: ${String(err)}`,
        })
        throw err
      }
    })
  },
})
