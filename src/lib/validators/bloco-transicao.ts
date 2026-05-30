import { z } from 'zod'

/**
 * BLOCO DE TRANSIÇÃO — input padronizado que TODO pipeline do Estúdio monta e
 * passa pro claude.service. Desacopla a coleta de dados (Meta + gateway +
 * criativo + landing + contexto do usuário) da chamada ao Claude.
 *
 * Spec: docs/criation-io-arquitetura-v06.html Sessão 1.8.
 * Campos opcionais (landing_data, reference_benchmarks, frames/transcription/
 * vsl_transcript) só são preenchidos por pipelines que os têm (ex: Deep, VSL).
 */

export const campaignContextSchema = z.object({
  name: z.string(),
  objective: z.string(),
  platform: z.enum(['meta', 'google']),
  budgetDaily: z.number().nonnegative().nullable(),
  audience: z.string().nullable(),
  creativeType: z.string().nullable(),
  productType: z.string().nullable(),
  ticketRange: z.string().nullable(),
})

export const funnelMetricsSchema = z.object({
  hookRate: z.number().nullable(),
  holdRate: z.number().nullable(),
  ctr: z.number().nullable(),
  cpa: z.number().nullable(),
  roas: z.number().nullable(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  spend: z.number().nonnegative(),
})

export const bottleneckHintSchema = z.object({
  type: z.string(),
  stage: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
})

export const creativeDataSchema = z.object({
  copyText: z.string(),
  creativeUrl: z.string().url().nullable(),
  frames: z.array(z.string()).optional(),
  transcription: z.string().optional(),
  vslTranscript: z.string().optional(),
})

export const landingDataSchema = z.object({
  screenshotUrl: z.string().url().nullable(),
  domExtracted: z.string(),
})

export const userContextSchema = z.object({
  niche: z.string().nullable(),
  investmentRange: z.string().nullable(),
  profileContextFreeform: z.string().nullable(),
})

export const referenceBenchmarksSchema = z.object({
  marketBenchmarks: z.record(z.string(), z.unknown()).optional(),
  copyAnglePerformance: z.record(z.string(), z.unknown()).optional(),
})

export const blocoTransicaoSchema = z.object({
  campaignContext: campaignContextSchema,
  funnelMetrics: funnelMetricsSchema,
  bottleneckHint: bottleneckHintSchema,
  creativeData: creativeDataSchema,
  landingData: landingDataSchema.optional(),
  userContext: userContextSchema,
  referenceBenchmarks: referenceBenchmarksSchema.optional(),
})

export type BlocoTransicao = z.infer<typeof blocoTransicaoSchema>
