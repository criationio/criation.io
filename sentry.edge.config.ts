/**
 * Sentry edge runtime init (TD-022).
 *
 * Carregado pelo `instrumentation.ts` quando `NEXT_RUNTIME === 'edge'`.
 * Cobre middleware quando configurado pra edge runtime (atualmente Node) e
 * route handlers com `export const runtime = 'edge'`.
 *
 * AsyncLocalStorage **não disponível** em edge runtime (limitacao do
 * V8 isolate). Por isso `beforeSend` aqui nao injeta correlationId — fica
 * so server config (Node runtime).
 *
 * Skip init quando `NEXT_PUBLIC_SENTRY_DSN` ausente.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
  })
}
