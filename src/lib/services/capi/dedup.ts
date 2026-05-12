import crypto from 'node:crypto'

/**
 * Event ID determinístico pra dedup no fanout CAPI — Sessao 1.4.9.
 *
 * Dois cenarios:
 *
 * 1. **Browser events** (tracking_events): `event_id` ja vem como UUID v4
 *    gerado client-side pelo `criation-tracking.js`. Service usa esse ID
 *    direto via `resolveEventId(existing, fallback)`.
 *
 * 2. **Gateway events** (purchase via webhook): sem event_id intrinseco.
 *    Geramos deterministicamente via `deterministicEventId(inputs)` pra
 *    garantir que retries do fanout (Trigger.dev backoff) produzam o
 *    MESMO ID — Meta CAPI dedupe por event_id. Sem isso, retry duplica
 *    evento no Events Manager.
 *
 * Cross-channel com Pixel cliente legado (limitacao documentada):
 *  Cliente que ja tem Pixel Meta firing `Purchase` no thank-you page
 *  usa event_id auto-gerado pelo proprio Pixel. Nosso event_id server-
 *  side seria diferente — Meta NAO dedupa. Pra dedup real cross-channel
 *  com Pixel cliente, cliente teria que configurar Pixel pra usar
 *  nosso event_id (raro, fora do scope MVP). Workaround alternativo:
 *  Meta tambem aceita dedup por (event_name + event_time + user_data
 *  match) com janela 48h — chamado "fuzzy dedup" — mas EMQ degrada.
 *
 * Cross-platform Meta vs Google (real e funciona):
 *  Quando enviamos o MESMO evento pra Meta CAPI + Google EC, ambos
 *  recebem o mesmo `event_id`. Meta dedupe por event_id, Google dedupe
 *  por order_id — ter mesmo event_id em ambos ajuda debug + auditoria.
 *  Por isso a chave canonica NAO inclui `provider` — mesmo logical
 *  event = mesmo event_id, independente do canal.
 */

export interface DedupInputs {
  workspaceId: string
  /** Canonical Meta event name: 'Purchase', 'AddToCart', 'Lead', etc. */
  eventName: string
  /** order_id (gateway) ou visitor_id (browser) — chave estavel do evento. */
  primaryKey: string
  /** Timestamp do evento ORIGINAL (nao do retry). */
  eventTime: Date
}

/**
 * Gera UUID-formatted ID deterministico a partir dos inputs canonicos.
 * Same inputs => same ID (idempotent, retry-safe).
 *
 * Implementacao: SHA-256 da chave canonica, formatada como UUID 8-4-4-4-12
 * dos primeiros 32 hex chars. Nao e UUID v5 estrito (RFC 4122 usa SHA-1 +
 * namespace) mas e funcionalmente equivalente pro nosso uso — Meta CAPI
 * aceita qualquer string UUID-formatted como event_id.
 *
 * Por que SHA-256 e nao SHA-1: zero deps (no `uuid` package) + colisao
 * astronomicamente improvavel em qualquer escala que faz sentido.
 */
export function deterministicEventId(inputs: DedupInputs): string {
  const key = canonicalKey(inputs)
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-')
}

/**
 * Retorna `existingId` se preenchido (tracking_events ja vem com UUID v4
 * do `criation-tracking.js`); senao gera deterministico.
 *
 * Whitespace-only e tratado como vazio (gera novo).
 */
export function resolveEventId(existingId: string | null | undefined, inputs: DedupInputs): string {
  const trimmed = existingId?.trim()
  if (trimmed) return trimmed
  return deterministicEventId(inputs)
}

/**
 * Chave canonica pra hashing. Ordem fixa, separador `:`, lowercase + trim
 * em strings, ISO timestamp UTC com milissegundos (event_time `2026-05-12T13:45:30.000Z`).
 *
 * NAO inclui `provider` ou `event_source` — mesmo logical event em Meta
 * CAPI + Google EC + browser Pixel teria mesmo ID (so funciona quando
 * todos os canais usam nossa logica — caso comum: Meta+Google ambos do
 * nosso fanout).
 */
function canonicalKey(inputs: DedupInputs): string {
  return [
    inputs.workspaceId.toLowerCase().trim(),
    inputs.eventName.toLowerCase().trim(),
    inputs.primaryKey.toLowerCase().trim(),
    inputs.eventTime.toISOString(),
  ].join(':')
}
