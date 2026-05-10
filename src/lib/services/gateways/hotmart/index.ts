import type { GatewayAdapter, NormalizedGatewayEvent, SignatureValidationResult } from '../types'

import { mapV1StatusToEvent, parseV1, type ParsedHotmartV1 } from './legacyParser'
import { normalizeV1, normalizeV2 } from './normalizer'
import { detectHotmartVersion, parseV2, type ParsedHotmartV2 } from './parser'
import { validateHotmartSignature } from './signature'

type ParsedHotmart =
  | { version: 'v2'; payload: ParsedHotmartV2 }
  | { version: 'v1'; payload: ParsedHotmartV1; eventName: string }

/**
 * Adapter Hotmart **MVP** (Sessao 1.4.5 — escopo simplificado).
 *
 * Implementa apenas as 3 funcoes pure obrigatorias:
 * - `validateSignature`: dual HOTTOK no payload + HMAC header
 * - `parseWebhook`: detect v1/v2 + parse tipado
 * - `normalizeEvent`: hashea PII inline e devolve `NormalizedGatewayEvent`
 *
 * **Funcoes REST omitidas:** fetchAccessToken/fetchSalesHistory/fetchSubscriptions/
 * fetchProducts. O cliente nao precisa criar OAuth credentials — basta o HOTTOK
 * que ja existe no painel postback. Quando precisar de backfill historico ou
 * sync proativo de subscriptions, reativar o REST client (audit
 * `HOTMART_API_2026-05.md` §4 mantem o mapping).
 */
export const hotmartAdapter: GatewayAdapter = {
  provider: 'hotmart',

  validateSignature(rawBody, headers, creds): SignatureValidationResult {
    let payloadToken: string | undefined
    try {
      const detected = detectHotmartVersion(rawBody, headers)
      if (detected === 'v2') {
        const obj = JSON.parse(rawBody) as { hottok?: string }
        payloadToken = obj.hottok
      } else if (detected === 'v1') {
        const params = new URLSearchParams(rawBody)
        payloadToken = params.get('hottok') ?? undefined
      }
    } catch {
      // payload mal-formado — segue para validacao HMAC pura
    }

    return validateHotmartSignature(rawBody, headers, creds.webhookSecret, {
      hottok: payloadToken,
    })
  },

  parseWebhook(rawBody, headers): ParsedHotmart {
    const version = detectHotmartVersion(rawBody, headers)
    if (version === 'v2') {
      return { version: 'v2', payload: parseV2(rawBody) }
    }
    if (version === 'v1') {
      const parsed = parseV1(rawBody)
      const eventName = mapV1StatusToEvent(parsed.fields.status ?? '')
      return { version: 'v1', payload: parsed, eventName }
    }
    throw new Error('unsupported hotmart payload format')
  },

  normalizeEvent(parsed): NormalizedGatewayEvent {
    const p = parsed as ParsedHotmart
    if (p.version === 'v2') return normalizeV2(p.payload)
    return normalizeV1(p.payload)
  },
}

export type { ParsedHotmart }
