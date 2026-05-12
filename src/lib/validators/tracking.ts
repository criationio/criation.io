import { z } from 'zod/v4'

/**
 * Schemas Zod para o endpoint publico `/api/v1/track` (Sessao 1.4.A / ADR-014).
 *
 * Estrategia: PERMISSIVO no input — script browser pode evoluir mais rapido
 * que o backend, e queremos tolerar campos novos sem 400. Validamos forma
 * minima (workspace, visitor, event_id, event_name, event_ts) e deixamos
 * o resto passar via `passthrough()`. `custom_data` e jsonb aberto.
 *
 * Anti-padroes evitados:
 * - Nao rejeitamos `event_name` desconhecido — fanout (1.4.9) decide o que
 *   mapeia pra Meta/Google; eventos custom do cliente devem persistir.
 * - Nao rejeitamos URLs malformadas — sanitizamos em vez de bloquear (Loss
 *   silencioso de eventos = pior que persistir lixo gerenciavel).
 */

const trackingUtmsSchema = z
  .object({
    utm_source: z.string().max(255).optional(),
    utm_medium: z.string().max(255).optional(),
    utm_campaign: z.string().max(255).optional(),
    utm_content: z.string().max(255).optional(),
    utm_term: z.string().max(255).optional(),
  })
  .loose()

const trackingConsentSchema = z
  .object({
    ad_storage: z.enum(['granted', 'denied']).optional(),
    analytics_storage: z.enum(['granted', 'denied']).optional(),
    ad_user_data: z.enum(['granted', 'denied']).optional(),
    ad_personalization: z.enum(['granted', 'denied']).optional(),
  })
  .loose()

export const ingestEventSchema = z
  .object({
    workspace_id: z.uuid('workspace_id must be a UUID'),
    visitor_id: z.string().min(8).max(64),
    event_id: z.string().min(8).max(128),
    event_name: z.string().min(1).max(64),
    /** Unix ms ou ISO 8601 — coercionamos para Date. */
    event_ts: z.union([z.number().int().positive(), z.iso.datetime()]),
    // Contexto
    page_url: z.string().max(2048).optional(),
    page_title: z.string().max(512).optional(),
    referrer: z.string().max(2048).optional(),
    // UTMs + click IDs (top-level pra facilitar query e index)
    utms: trackingUtmsSchema.optional(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
    fbclid: z.string().max(255).optional(),
    gclid: z.string().max(255).optional(),
    ttclid: z.string().max(255).optional(),
    msclkid: z.string().max(255).optional(),
    ctwa_clid: z.string().max(255).optional(),
    wbraid: z.string().max(255).optional(),
    gbraid: z.string().max(255).optional(),
    // Consent Mode v2
    consent: trackingConsentSchema.optional(),
    // Identify (raw email — hasheamos server-side, NUNCA loggar plain)
    identify_email: z.email().max(254).optional(),
    // Dados do evento (jsonb aberto: value, currency, content_ids, etc)
    custom_data: z.record(z.string(), z.unknown()).optional(),
  })
  .loose()

export type IngestEventInput = z.infer<typeof ingestEventSchema>
