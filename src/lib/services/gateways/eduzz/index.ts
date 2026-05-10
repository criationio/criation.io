import type { GatewayAdapter, NormalizedGatewayEvent, SignatureValidationResult } from '../types'

import { normalizeEduzzEvent } from './normalizer'
import { parseEduzzWebhook, type EduzzWebhookEnvelope } from './parser'
import { validateEduzzSignature } from './signature'

/**
 * Adapter Eduzz Webhook v3 (Sessao 1.4.7).
 *
 * Mais limpo dos 3 BR:
 * - HMAC-SHA256 oficial (validacao single-layer)
 * - Envelope `{id, event, data, sentDate}` consistente
 * - Eventos `app.action` namespaced
 *
 * Implementa as 3 funcoes pure obrigatorias do `GatewayAdapter`.
 *
 * **Funcoes REST omitidas** (TD-060): backfill via `/api/myeduzz/v1/sales`
 * + sync proativo de assinaturas. Igual MVP Hotmart/Kiwify — webhook only.
 */
export const eduzzAdapter: GatewayAdapter = {
  provider: 'eduzz',

  validateSignature(rawBody, headers, creds): SignatureValidationResult {
    return validateEduzzSignature(rawBody, headers, creds.webhookSecret)
  },

  parseWebhook(rawBody): EduzzWebhookEnvelope {
    return parseEduzzWebhook(rawBody)
  },

  normalizeEvent(parsed): NormalizedGatewayEvent {
    return normalizeEduzzEvent(parsed as EduzzWebhookEnvelope)
  },
}
