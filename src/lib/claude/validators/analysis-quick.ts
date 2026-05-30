import { z } from 'zod'

/**
 * Schema do output do pipeline `analisar.video_ad` (Quick). Garante que o JSON
 * devolvido pelo Claude tenha a forma esperada antes de persistir em
 * analysis_results.result_data. Forma MVP — refina na Sessão 1.9.
 */

export const analysisQuickOutputSchema = z.object({
  verdict: z.enum(['strong', 'average', 'weak']),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  bottleneck: z.object({
    stage: z.string(),
    explanation: z.string(),
  }),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()).min(1),
})

export type AnalysisQuickOutput = z.infer<typeof analysisQuickOutputSchema>
