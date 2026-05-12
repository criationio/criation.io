import { hashEmail, hashIp, hashUserAgent } from '@/lib/security/hash'
import { trackingLogger } from '@/lib/logger'
import {
  getInstallationStatus as getInstallationStatusQuery,
  insertTrackingEvent,
} from '@/lib/db/queries/tracking'
import { getActiveConnection } from '@/lib/db/queries/connections'
import type { NewTrackingEvent } from '@/lib/db/schema'

import type { IngestEventInput } from '@/lib/validators/tracking'

const CDP_PROVIDER = 'criation_cdp'
const CDP_TYPE = 'analytics' as const

export interface IngestRequestMeta {
  clientIp: string | null
  userAgent: string | null
  origin: string | null
}

export interface IngestResult {
  ok: boolean
  eventDbId: string | null
  eventTs: Date
  /** false = retry idempotente absorvido (mesmo event_id+ts ja existia). */
  created: boolean
}

/**
 * Persiste 1 evento browser (hot path do endpoint).
 *
 * NAO faz:
 * - Origin validation (caller deve chamar `validateOrigin` antes).
 * - Visitor upsert (delegado pro task `process-tracking-event` async).
 * - Trigger.dev fanout (idem).
 *
 * Idempotente: UNIQUE (workspace, event_id, event_ts) absorve retries de
 * sendBeacon. Latencia alvo p99 < 50ms (1 INSERT na particao certa).
 */
export async function ingestEvent(
  input: IngestEventInput,
  meta: IngestRequestMeta
): Promise<IngestResult> {
  const eventTs = parseEventTs(input.event_ts)

  const eventRow: NewTrackingEvent = {
    workspaceId: input.workspace_id,
    visitorId: input.visitor_id,
    eventId: input.event_id,
    eventName: input.event_name,
    eventTs,
    clientIpHash: meta.clientIp ? hashIp(meta.clientIp) : null,
    clientUserAgentHash: meta.userAgent ? hashUserAgent(meta.userAgent) : null,
    pageUrl: truncate(input.page_url, 2048) ?? null,
    pageTitle: truncate(input.page_title, 512) ?? null,
    referrer: truncate(input.referrer, 2048) ?? null,
    utms: (input.utms ?? {}) as Record<string, unknown>,
    fbp: input.fbp ?? null,
    fbc: input.fbc ?? null,
    fbclid: input.fbclid ?? null,
    gclid: input.gclid ?? null,
    ttclid: input.ttclid ?? null,
    msclkid: input.msclkid ?? null,
    ctwaClid: input.ctwa_clid ?? null,
    wbraid: input.wbraid ?? null,
    gbraid: input.gbraid ?? null,
    consentState: (input.consent ?? null) as Record<string, unknown> | null,
    customData: (input.custom_data ?? null) as Record<string, unknown> | null,
    matchedBuyerEmailHash: input.identify_email ? hashEmail(input.identify_email) : null,
    matchedAt: input.identify_email ? eventTs : null,
  }

  const { event, created } = await insertTrackingEvent(eventRow)

  trackingLogger.info(
    {
      workspaceId: input.workspace_id,
      visitorId: input.visitor_id,
      eventName: input.event_name,
      eventId: input.event_id,
      created,
    },
    'ingest event'
  )

  return { ok: true, eventDbId: event?.id ?? null, eventTs, created }
}

/**
 * Origin allowlist. 3 modos (fix A1 da auditoria):
 *  1. Sem connection CDP — workspace nao registrou tracking via UI. Aceita
 *     qualquer origem (onboarding em andamento).
 *  2. Connection existe + grace period ativo (< 7d desde install) + allowlist
 *     vazia — aceita qualquer origem (cliente ainda configurando).
 *  3. Grace period expirou OU allowlist populada — enforce match estrito.
 *
 * Isso fecha o vetor de poisoning: depois de 7d, atacante que adivinhou
 * workspace_id nao consegue mais postar de origin arbitrario.
 */
export async function validateOrigin(
  workspaceId: string,
  origin: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!origin) {
    // Sem header Origin (sendBeacon de algumas browsers/contextos): aceita.
    // CSRF nao se aplica aqui — endpoint nao age sobre sessao de usuario.
    return { ok: true }
  }

  const connection = await getActiveConnection(workspaceId, CDP_PROVIDER, CDP_TYPE)
  if (!connection) {
    // Modo 1: workspace ainda nao registrou o CDP via UI.
    return { ok: true }
  }

  const config = (connection.config ?? {}) as {
    originAllowlist?: string[]
    gracePeriodEndsAt?: string
  }
  const allowlist = Array.isArray(config.originAllowlist) ? config.originAllowlist : []
  const gracePeriodEndsAt = config.gracePeriodEndsAt ? new Date(config.gracePeriodEndsAt) : null
  const inGracePeriod = gracePeriodEndsAt ? gracePeriodEndsAt > new Date() : false

  // Modo 2: grace period + allowlist vazia → aceita.
  if (allowlist.length === 0 && inGracePeriod) {
    return { ok: true }
  }

  // Modo 3: enforcar.
  // Allowlist vazia + grace expirado = reject all (forca cliente configurar).
  if (allowlist.length === 0) {
    return { ok: false, reason: 'allowlist_required_after_grace_period' }
  }

  const originHost = safeOriginHost(origin)
  if (!originHost) return { ok: false, reason: 'invalid_origin' }

  const matched = allowlist.some((entry) => matchOrigin(entry, originHost))
  return matched ? { ok: true } : { ok: false, reason: 'origin_not_allowed' }
}

export async function getInstallationStatus(workspaceId: string) {
  return getInstallationStatusQuery(workspaceId)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Captura IP real do cliente atrás do proxy Vercel. Em ordem:
 *  1. `x-forwarded-for` — primeira entry e o IP real do cliente
 *  2. `x-real-ip` — fallback
 *  3. null — endpoint funciona sem IP (so afeta EMQ)
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = headers.get('x-real-ip')
  if (xri) return xri.trim()
  return null
}

function parseEventTs(input: number | string): Date {
  if (typeof input === 'number') return new Date(input)
  return new Date(input)
}

function truncate(value: string | undefined | null, max: number): string | undefined {
  if (!value) return undefined
  return value.length > max ? value.slice(0, max) : value
}

/**
 * Click ID prioritario: ordem reflete relevancia comercial pra atribuicao
 * (Meta > Google > TikTok > MS > WhatsApp > Google web/iOS). Exportado pra
 * reuso pelo task `process-tracking-event` (visitor upsert).
 */
export function pickPrimaryClickIdFromEvent(event: {
  fbclid?: string | null
  gclid?: string | null
  ttclid?: string | null
  msclkid?: string | null
  ctwaClid?: string | null
  wbraid?: string | null
  gbraid?: string | null
}): { id: string; type: string } | null {
  if (event.fbclid) return { id: event.fbclid, type: 'fbclid' }
  if (event.gclid) return { id: event.gclid, type: 'gclid' }
  if (event.ttclid) return { id: event.ttclid, type: 'ttclid' }
  if (event.msclkid) return { id: event.msclkid, type: 'msclkid' }
  if (event.ctwaClid) return { id: event.ctwaClid, type: 'ctwa_clid' }
  if (event.wbraid) return { id: event.wbraid, type: 'wbraid' }
  if (event.gbraid) return { id: event.gbraid, type: 'gbraid' }
  return null
}

function safeOriginHost(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Match de origin entry. Suporta:
 *  - host exato: `app.cliente.com`
 *  - wildcard subdomain: `*.cliente.com` (acerta `app.cliente.com` mas nao `cliente.com`)
 *  - host bare: `cliente.com` acerta tambem `www.cliente.com`
 *
 * Exportado para teste — usado internamente por `validateOrigin`.
 */
export function matchOrigin(entry: string, originHost: string): boolean {
  const normalized = entry
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  if (!normalized) return false
  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(1) // '.cliente.com'
    return originHost.endsWith(suffix) && originHost !== suffix.slice(1)
  }
  return originHost === normalized || originHost.endsWith('.' + normalized)
}
