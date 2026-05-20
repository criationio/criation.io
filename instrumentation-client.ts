/**
 * Sentry client-side init (browser — TD-022).
 *
 * Next.js 15+ pattern — substitui o legado `sentry.client.config.ts`.
 * Carregado automaticamente pelo Next runtime no client.
 *
 * Inclui session replay: 10% das sessoes + 100% das sessoes com erro.
 * Util pra dogfood debugging — ver exato fluxo do user que deu erro.
 *
 * Skip init quando `NEXT_PUBLIC_SENTRY_DSN` ausente.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,

    // IP + headers no client. Sentry redacta passwords/credit cards/emails
    // automaticamente; PII custom (phone, document) precisa scrubbing manual
    // se aparecer em error messages.
    sendDefaultPii: true,

    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? undefined,

    integrations: [
      Sentry.replayIntegration({
        // Redacta TODO texto/inputs em replays por default — LGPD-safe.
        // Pra debug especifico, configurar allowlist via data-attr.
        maskAllText: true,
        maskAllInputs: true,
      }),
    ],

    // 10% sessions normais + 100% sessions com erro = balance entre cost
    // (replays sao caros) e visibilidade de bugs.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}
