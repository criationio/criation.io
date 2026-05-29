import { z } from 'zod'

/**
 * Input da Server Action createAnalysis (Sessão 1.9). MVP: só origem
 * "campanha conectada" + tipo vídeo + profundidade Quick. Os demais valores
 * existem no enum pra forward-compat mas a action recusa o que não for MVP.
 */
export const createAnalysisSchema = z.object({
  assetType: z.literal('video_ad'),
  source: z.literal('campaign'),
  campaignId: z.string().uuid('Selecione uma campanha'),
  creativeId: z.string().uuid('Selecione um criativo'),
  depth: z.literal('quick'),
  extraContext: z.string().trim().max(1000).optional(),
})

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>
