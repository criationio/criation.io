/**
 * Next.js instrumentation hook (TD-022 — Sentry).
 *
 * Carrega config Sentry baseado em runtime (Node.js vs Edge). Roda uma vez no
 * boot do server e em cada cold start de funcao. Cliente browser inicia via
 * `instrumentation-client.ts` (Next 15+ pattern).
 *
 * Re-export `onRequestError` captura erros de Server Components, middleware
 * e Vercel proxies que nao sao pegos pelo error boundary do Next.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
