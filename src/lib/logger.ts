import pino from 'pino'

import { getCorrelationId } from './correlation'

/**
 * Pino redact paths — substitui valores por `[Redacted]` antes do log
 * chegar no stdout/aggregator. Tabelas de DB ainda guardam plain
 * (LGPD: retention 30d via TD-108).
 *
 * Cobertura:
 *  - Genericos (1- e 2-level wildcards): email/password/token/document/phone/etc
 *  - Meta CAPI payload (1.4.9): `data[*].user_data.{em,ph,fn,ln,...}`
 *    — todos os campos hashed E plain dentro do user_data sao PII.
 *    Pino aceita array indexing `[*]` + dot path.
 *  - Hashes de PII em rows DB ou domain types: matched_buyer_email_hash,
 *    customer_email_hash, customer_phone_hash, buyer_document_hash, etc.
 *    Mesmo hash e PII pseudonimizado — LGPD/GDPR recomendam tratar igual.
 *  - Plain IP/UA (1.4.9): client_ip_address + client_user_agent em qualquer
 *    profundidade (1- e 2-level wildcards).
 *  - fbp/fbc: Facebook cookies que identificam o browser session —
 *    pseudoanonimos mas em log podem correlacionar com user agent + IP.
 */
export const REDACT_PATHS: readonly string[] = [
  // Generic PII (1- e 2-level wildcards)
  '*.email',
  '*.password',
  '*.token',
  '*.key',
  '*.secret',
  '*.cpf',
  '*.cnpj',
  '*.document',
  '*.documento',
  '*.phone',
  '*.telefone',
  '*.celular',
  '*.ip',
  '*.name',
  '*.nome',
  '*.address',
  '*.endereco',
  '*.client_secret',
  '*.api_key',
  '*.hottok',
  'email',
  'password',
  'token',
  'document',
  'phone',
  'name',
  'client_secret',
  'hottok',
  // Hashed PII (1.4.9 — Meta CAPI / gateway events / tracking events)
  // Hash de email/phone/document/external_id ainda identifica o titular.
  '*.matched_buyer_email_hash',
  '*.customer_email_hash',
  '*.customer_phone_hash',
  '*.buyer_email_hash',
  '*.buyer_phone_hash',
  '*.buyer_document_hash',
  '*.affiliate_email_hash',
  '*.external_id_hash',
  '*.identified_buyer_email_hash',
  // Plain IP/UA (1.4.9 step 5)
  '*.client_ip_address',
  '*.client_user_agent',
  // Facebook session cookies (1.4.9) — pseudoanonimo + correlacionavel
  '*.fbp',
  '*.fbc',
  // Meta CAPI payload — user_data deep paths (1.4.9 step 6)
  'data[*].user_data.em',
  'data[*].user_data.ph',
  'data[*].user_data.fn',
  'data[*].user_data.ln',
  'data[*].user_data.ge',
  'data[*].user_data.db',
  'data[*].user_data.ct',
  'data[*].user_data.st',
  'data[*].user_data.zp',
  'data[*].user_data.external_id',
  'data[*].user_data.client_ip_address',
  'data[*].user_data.client_user_agent',
  'data[*].user_data.fbc',
  'data[*].user_data.fbp',
  // Mesmo Meta paths em logger nested em payload field (ex: requestPayload, body)
  '*.user_data.em',
  '*.user_data.ph',
  '*.user_data.external_id',
  '*.user_data.client_ip_address',
  '*.user_data.client_user_agent',
]

const transport =
  process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' as const, options: { colorize: true } }
    : undefined

const baseOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: [...REDACT_PATHS],
  base: { service: 'criation-io' },
  mixin: () => ({ correlationId: getCorrelationId() }),
}

export const logger = transport ? pino({ ...baseOptions, transport }) : pino(baseOptions)

export const authLogger = logger.child({ domain: 'auth' })
export const billingLogger = logger.child({ domain: 'billing' })
export const analysisLogger = logger.child({ domain: 'analysis' })
export const capiLogger = logger.child({ domain: 'capi' })
export const trackingLogger = logger.child({ domain: 'tracking' })
export const dbLogger = logger.child({ domain: 'db' })
