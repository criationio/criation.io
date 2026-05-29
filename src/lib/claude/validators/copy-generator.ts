import { z } from 'zod'

/**
 * Schema do output do `copy-generator` — variações de copy geradas pelo Claude.
 * Forma MVP — usada por generateCopy; refina quando o pipeline Variar (Fase 2)
 * for implementado.
 */

export const copyVariationSchema = z.object({
  angle: z.string().min(1),
  headline: z.string().min(1),
  body: z.string().min(1),
})

export const copyGeneratorOutputSchema = z.object({
  variations: z.array(copyVariationSchema).min(1),
})

export type CopyGeneratorOutput = z.infer<typeof copyGeneratorOutputSchema>
