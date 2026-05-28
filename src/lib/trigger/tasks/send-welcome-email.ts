import { logger, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { sendTransactional } from '@/lib/email/resend'
import { WelcomeEmail } from '@/emails/welcome'

/**
 * TD-013 — Welcome email via Trigger.dev task (retry built-in).
 *
 * Sessao 1.5: substitui chamada direta a `sendTransactional` em
 * verify-email/route.ts. Trigger.dev v3 da retry com backoff exponencial +
 * dead-letter queue nativo quando esgota tentativas.
 *
 * Throwa em falha pra acionar retry. `sendTransactional` ja swallow-and-log
 * errors do Resend retornando `{ok:false}` — pra disparar retry precisamos
 * promover esses em throw aqui.
 */
export const sendWelcomeEmailTask = task({
  id: 'send-welcome-email',
  maxDuration: 60,
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    randomize: true,
  },
  run: async (payload: {
    userId: string
    email: string
    appUrl: string
    signupCredits: number
    expiresInDays: number
    correlationId?: string
  }) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      logger.info('send-welcome-email: dispatching', {
        userId: payload.userId,
        correlationId: cid,
      })

      const result = await sendTransactional({
        to: payload.email,
        subject: 'Bem-vindo ao Criation',
        template: WelcomeEmail({
          appUrl: payload.appUrl,
          signupCredits: payload.signupCredits,
          expiresInDays: payload.expiresInDays,
        }),
        tags: [{ name: 'category', value: 'welcome' }],
      })

      if (!result.ok) {
        // Promove falha do Resend pra throw - Trigger.dev faz retry com backoff.
        // Apos 5 tentativas (~31s wallclock), task vira `failed` no dashboard.
        throw new Error(`resend_send_failed: ${result.reason ?? 'unknown'}`)
      }

      logger.info('send-welcome-email: delivered', {
        userId: payload.userId,
        correlationId: cid,
      })

      return { delivered: true, userId: payload.userId }
    })
  },
})
