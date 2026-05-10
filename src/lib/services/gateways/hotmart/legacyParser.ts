import crypto from 'node:crypto'

/**
 * Parser do Hotmart Postback v1 (legacy, form-urlencoded).
 *
 * v1 nao tem envelope — campos vem na raiz do form. Mantido como fallback;
 * onboarding novo forca v2 (ADR-016 dec.1). Quando cliente legado chegar,
 * adapter detecta v1 via content-type e cai aqui.
 *
 * Idempotencia: v1 NAO tem `event.id` UUID. Geramos chave sintetica
 * `sha256(transaction + status + creation_date)` para usar em
 * `gateway_events.allocation_idempotency_key`.
 */

export interface ParsedHotmartV1 {
  /** Campos raw do form. */
  fields: Record<string, string>
  /** Chave sintetica para idempotencia. */
  syntheticEventId: string
}

export function parseV1(rawBody: string): ParsedHotmartV1 {
  const params = new URLSearchParams(rawBody)
  const fields: Record<string, string> = {}
  for (const [k, v] of params.entries()) {
    fields[k] = v
  }

  // Idempotency key sintetica — v1 nao traz UUID
  const transaction = fields.transaction ?? ''
  const status = fields.status ?? ''
  const creationDate = fields.creation_date ?? fields.purchase_date ?? ''
  const syntheticEventId = crypto
    .createHash('sha256')
    .update(`${transaction}|${status}|${creationDate}`)
    .digest('hex')

  return { fields, syntheticEventId }
}

/**
 * Mapeia eventos v1 (status field) para o nome canonico v2-like.
 * v1 nao tem campo `event` separado — o tipo e inferido do `status`.
 */
export function mapV1StatusToEvent(status: string): string {
  const map: Record<string, string> = {
    APPROVED: 'PURCHASE_APPROVED',
    REFUNDED: 'PURCHASE_REFUNDED',
    CHARGEBACK: 'PURCHASE_CHARGEBACK',
    CANCELED: 'PURCHASE_CANCELED',
    BILLET_PRINTED: 'PURCHASE_BILLET_PRINTED',
    DELAYED: 'PURCHASE_DELAYED',
    EXPIRED: 'PURCHASE_EXPIRED',
    COMPLETE: 'PURCHASE_COMPLETE',
  }
  return map[status.toUpperCase()] ?? `UNKNOWN_${status}`
}
