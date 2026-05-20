/**
 * Sentry server-side init (Node.js runtime — TD-022).
 *
 * Carregado pelo `instrumentation.ts` quando `NEXT_RUNTIME === 'nodejs'`.
 * Cobre route handlers, Server Components, Server Actions, middleware (Node),
 * Trigger.dev tasks (quando rodando na Vercel — Trigger.dev cloud tem
 * observabilidade propria).
 *
 * **Integração com TD-021/TD-021b correlation:** `beforeSend` lê o
 * correlationId do AsyncLocalStorage (`getCorrelationId()`) e injeta como tag
 * em todo evento Sentry. Pino logs e Sentry events com mesmo ID podem ser
 * cross-referenciados pra debug E2E.
 *
 * Skip init quando `NEXT_PUBLIC_SENTRY_DSN` ausente (local dev sem barulho).
 */
import * as Sentry from '@sentry/nextjs'

import { getCorrelationId } from '@/lib/correlation'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,

    // Adiciona request headers e IP em eventos. Consistente com retention 30d
    // de plain IP/UA (TD-108) — Sentry e processador de dados, mesma base legal
    // LGPD Art. 7º IX (interesse legitimo pra security observability).
    sendDefaultPii: true,

    // 100% em dev, 10% em prod. Ajustar conforme volume cobrar (alvo: < 5%
    // dos events ao chegar em 100k req/dia).
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Environment tag pra filtragem no dashboard
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

    // Release tag — Vercel injeta VERCEL_GIT_COMMIT_SHA automaticamente
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,

    /**
     * Cross-reference com pino logs: cada evento Sentry recebe `correlationId`
     * como tag. Em prod, abrir um issue no Sentry → pegar correlationId → buscar
     * mesmo ID em Vercel/Better Stack logs pra contexto completo (route handler
     * → service → DB query chain).
     *
     * `getCorrelationId()` retorna UUID fallback quando storage vazio (fora
     * de withCorrelation context) — tag fica presente mas isolada.
     */
    beforeSend(event) {
      const correlationId = getCorrelationId()
      event.tags = { ...event.tags, correlationId }
      return event
    },
  })
}
