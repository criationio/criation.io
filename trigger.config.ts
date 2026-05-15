import { defineConfig } from '@trigger.dev/sdk/v3'

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
})
