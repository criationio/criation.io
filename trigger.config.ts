import { defineConfig } from '@trigger.dev/sdk/v3'
import { syncEnvVars } from '@trigger.dev/build/extensions/core'

/**
 * Trigger.dev v3 config (SDK 4.x).
 *
 * Pre-req: criar project em https://cloud.trigger.dev e setar
 * TRIGGER_PROJECT_REF + TRIGGER_SECRET_KEY no .env.local.
 *
 * Tasks vivem em src/lib/trigger/tasks/. Cada arquivo exporta task()
 * ou schedules.task() que vira invocavel via tasks.trigger() ou cron.
 *
 * Nota: o CLI da Trigger.dev usa jiti+c12 pra carregar este arquivo
 * fora do runtime Next.js. Por isso precisa loadEnvFile manual —
 * mesmo padrao usado em drizzle.config.ts e seeds (TD-003 closed).
 */

try {
  process.loadEnvFile('.env.local')
} catch {
  // .env.local pode nao existir em CI/prod/build container — env vars vem
  // de outro lugar (ou caimos no fallback hardcoded abaixo).
}

// Skip env validation no indexer/build container do `trigger deploy` (que nao
// tem .env.local). Task files importam @/env (t3-env) e validariam todos os
// secrets — quebra a enumeracao de tasks. Em runtime de task, env vars vem
// injetadas via cloud.trigger.dev > project > Environment Variables.
// `??=` preserva valor explicito quando setado (CI/prod).
process.env.SKIP_ENV_VALIDATION ??= '1'

// Project ref nao e secret (e o slug publico do projeto; o secret e o
// TRIGGER_SECRET_KEY). Fallback hardcoded permite que o indexer rode dentro
// do build container do `trigger deploy` (que nao recebe .env.local).
// Override via env quando precisar apontar pra outro projeto.
const projectRef = process.env.TRIGGER_PROJECT_REF ?? 'proj_xxaeizypavwtbpfpzyzk'

// Env vars que cada task precisa em runtime. syncEnvVars empurra do process.env
// local (`.env.local` carregado acima) pro Trigger.dev cloud durante deploy.
// Mantenha a lista alinhada com o que `src/env.ts` valida + secrets de
// encryption (que nao passam por env.ts mas sao lidos via process.env direto).
const TRIGGER_RUNTIME_ENV_KEYS = [
  // DB + Supabase
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  // Encryption (multi-version) + PII hash salt
  'ENCRYPTION_KEY',
  'ENCRYPTION_KEY_V1',
  'ENCRYPTION_VERSION',
  'HASH_SALT',
  // Upstash Redis (rate limit + OAuth state)
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  // Meta (1.3 + 1.4.9)
  'META_APP_ID',
  'META_APP_SECRET',
  'META_GRAPH_VERSION',
  // Google (1.4.9.B / ADR-015)
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_API_VERSION',
  'GOOGLE_DATA_MANAGER_API_VERSION',
] as const

export default defineConfig({
  project: projectRef,
  runtime: 'node',
  logLevel: 'log',
  maxDuration: 300, // 5min default por run; cada task pode override
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['./src/lib/trigger/tasks'],
  build: {
    extensions: [
      syncEnvVars(async () => {
        return TRIGGER_RUNTIME_ENV_KEYS.flatMap((name) => {
          const value = process.env[name]
          return value ? [{ name, value }] : []
        })
      }),
    ],
  },
})
