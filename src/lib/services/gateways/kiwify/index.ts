import type { GatewayAdapter, NormalizedGatewayEvent, SignatureValidationResult } from '../types'

import { normalizeKiwifyEvent } from './normalizer'
import { parseKiwifyWebhook, type KiwifyWebhookPayload } from './parser'
import { validateKiwifySignature } from './signature'

/**
 * Adapter Kiwify **MVP** (Sessao 1.4.6 — escopo simplificado seguindo padrao 1.4.5).
 *
 * Implementa apenas as 3 funcoes pure obrigatorias:
 * - `validateSignature`: tri-camada (query string ?token=, header x-kiwify-token, body payload.token)
 * - `parseWebhook`: Zod schema generoso com passthrough (Kiwify nao tem versionamento explicito)
 * - `normalizeEvent`: hashea PII inline, mapeia 10 eventos Kiwify para canonicos
 *
 * **Funcoes REST omitidas** (TD-049/050): fetchAccessToken/fetchSalesHistory/etc.
 * Cliente nao precisa fornecer client_id/client_secret no MVP — basta o token
 * webhook que ele cola no painel Kiwify.
 *
 * Token e gerado pelo nosso wizard como UUIDv4 e cliente cola no painel.
 */
export const kiwifyAdapter: GatewayAdapter = {
  provider: 'kiwify',

  validateSignature(rawBody, headers, creds, ctx): SignatureValidationResult {
    let payloadToken: string | undefined
    try {
      const obj = JSON.parse(rawBody) as { token?: string }
      payloadToken = obj.token
    } catch {
      // payload mal-formado — segue para validacao via query/header
    }

    // Reusa URL passada pelo route handler (Kiwify entrega token em query string)
    const url = ctx?.url ?? new URL('http://localhost/')

    return validateKiwifySignature(rawBody, headers, url, creds.webhookSecret, {
      token: payloadToken,
    })
  },

  parseWebhook(rawBody): KiwifyWebhookPayload {
    return parseKiwifyWebhook(rawBody)
  },

  normalizeEvent(parsed): NormalizedGatewayEvent {
    return normalizeKiwifyEvent(parsed as KiwifyWebhookPayload)
  },
}
