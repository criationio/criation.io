import { defineConfig } from '@trigger.dev/sdk/v3'

/**
 * Trigger.dev v3 config (SDK 4.x).
 *
 * Pre-req: criar project em https://cloud.trigger.dev e setar
 * TRIGGER_PROJECT_REF + TRIGGER_SECRET_KEY no .env.local. CLI
 * (npx trigger.dev@latest dev) carrega .env.local automaticamente.
 *
 * Tasks vivem em src/lib/trigger/tasks/. Cada arquivo exporta task()
 * ou schedules.task() que vira invocavel via tasks.trigger() ou cron.
 */

const projectRef = process.env.TRIGGER_PROJECT_REF
if (!projectRef) {
  throw new Error(
    'TRIGGER_PROJECT_REF nao definida. Crie project em cloud.trigger.dev e adicione no .env.local'
  )
}

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
