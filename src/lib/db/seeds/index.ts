import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// tsx runs this script outside the Next.js runtime, so .env.local must be
// loaded before evaluating ../index (which reads DATABASE_URL at import time).
// db and schema are imported dynamically inside seed() so this loader runs first.
const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envLocalPath)
}

async function seed() {
  const { db } = await import('../index')
  const { creditPackages, pipelineCosts, featureFlags, promptVersions } = await import('../schema')
  const { PRODUCTION_PROMPTS } = await import('@/lib/claude/prompts')

  console.log('Seeding credit_packages...')
  await db
    .insert(creditPackages)
    .values([
      {
        sku: 'pack_100',
        name: '100 créditos',
        credits: 100,
        priceBrlCents: 14900,
        validityDays: 60,
        displayOrder: 1,
      },
      {
        sku: 'pack_300',
        name: '300 créditos',
        credits: 300,
        priceBrlCents: 39900,
        validityDays: 60,
        displayOrder: 2,
      },
      {
        sku: 'pack_700',
        name: '700 créditos',
        credits: 700,
        priceBrlCents: 89900,
        validityDays: 60,
        displayOrder: 3,
      },
    ])
    .onConflictDoNothing()

  console.log('Seeding pipeline_costs...')
  await db
    .insert(pipelineCosts)
    .values([
      {
        pipelineId: 'analisar.video_ad',
        costCredits: 1,
        estimatedRealCostBrl: '0.40',
        description: 'Quick — análise rápida de video ad',
      },
      {
        pipelineId: 'comparar.analyses',
        costCredits: 2,
        estimatedRealCostBrl: '0.80',
        description: 'Comparar análises A×B',
      },
      {
        pipelineId: 'variar.video_ad',
        costCredits: 3,
        estimatedRealCostBrl: '1.20',
        description: 'Variar — gerar variações',
      },
      {
        pipelineId: 'analisar.deep',
        costCredits: 7,
        estimatedRealCostBrl: '2.60',
        description: 'Deep — análise multi-pipeline + Deepgram',
      },
      {
        pipelineId: 'modelar.sales_page',
        costCredits: 8,
        estimatedRealCostBrl: '3.00',
        description: 'Modelar com sales page + Browserless',
      },
      {
        pipelineId: 'analisar.sales_page',
        costCredits: 9,
        estimatedRealCostBrl: '3.50',
        description: 'Sales page deep full',
      },
      {
        pipelineId: 'modelar.youtube',
        costCredits: 11,
        estimatedRealCostBrl: '4.25',
        description: 'Modelar com YouTube + Deepgram longo',
      },
    ])
    .onConflictDoNothing()

  console.log('Seeding feature_flags...')
  await db
    .insert(featureFlags)
    .values([
      { key: 'estudio_quick_enabled', enabled: true, rolloutPercentage: 100 },
      { key: 'estudio_deep_enabled', enabled: false, rolloutPercentage: 0 },
      { key: 'capi_meta_enabled', enabled: false, rolloutPercentage: 0 },
      { key: 'affiliates_enabled', enabled: false, rolloutPercentage: 0 },
      { key: 'google_ads_enabled', enabled: false, rolloutPercentage: 0 },
    ])
    .onConflictDoNothing()

  console.log('Seeding prompt_versions...')
  await db
    .insert(promptVersions)
    .values(
      PRODUCTION_PROMPTS.map((p) => ({
        pipelineId: p.pipelineId,
        version: p.version,
        systemPrompt: p.systemPrompt,
        // userPromptTemplate é montado dinamicamente em código (buildUserPrompt);
        // a row registra o deploy + system prompt pra auditoria.
        userPromptTemplate: null,
        model: p.model,
        maxTokens: p.maxTokens,
        status: 'production',
      }))
    )
    .onConflictDoNothing()

  console.log('Seeds complete!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
