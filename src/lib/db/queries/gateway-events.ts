import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayEvents, gatewayEventsDlq } from '@/lib/db/schema/gateway'
import { processedWebhookEvents } from '@/lib/db/schema/billing'
import type { GatewayEvent, NewGatewayEvent } from '@/lib/db/schema'

/**
 * Insert idempotente. Se ja existe `(workspace_id, provider, provider_event_id)`,
 * retorna a row existente (sem error). Garante que retries do gateway nao
 * geram duplicatas.
 */
export async function insertEventIdempotent(
  input: NewGatewayEvent
): Promise<{ event: GatewayEvent; created: boolean }> {
  const inserted = await db
    .insert(gatewayEvents)
    .values(input)
    .onConflictDoNothing({
      target: [gatewayEvents.workspaceId, gatewayEvents.provider, gatewayEvents.providerEventId],
    })
    .returning()

  if (inserted[0]) return { event: inserted[0], created: true }

  // Conflict — busca a row existente
  const existing = await db.query.gatewayEvents.findFirst({
    where: and(
      eq(gatewayEvents.workspaceId, input.workspaceId),
      eq(gatewayEvents.provider, input.provider),
      eq(gatewayEvents.providerEventId, input.providerEventId)
    ),
  })
  if (!existing) throw new Error('insertEventIdempotent: conflict but row not found')
  return { event: existing, created: false }
}

export async function getEventById(eventId: string): Promise<GatewayEvent | null> {
  const row = await db.query.gatewayEvents.findFirst({
    where: eq(gatewayEvents.id, eventId),
  })
  return row ?? null
}

export async function markEventProcessed(
  eventId: string,
  allocationStatus: string,
  allocationIdempotencyKey?: string
): Promise<void> {
  await db
    .update(gatewayEvents)
    .set({
      processedAt: new Date(),
      allocationStatus,
      ...(allocationIdempotencyKey ? { allocationIdempotencyKey } : {}),
    })
    .where(eq(gatewayEvents.id, eventId))
}

export async function enqueueDlq(input: {
  workspaceId: string | null
  provider: string
  rawPayload: unknown
  errorMessage: string
}): Promise<void> {
  await db.insert(gatewayEventsDlq).values({
    workspaceId: input.workspaceId ?? undefined,
    provider: input.provider,
    rawPayload: input.rawPayload as Record<string, unknown>,
    errorMessage: input.errorMessage,
    retryCount: 0,
  })
}

/**
 * Camada extra de dedup global via `processed_webhook_events`. Util para
 * casos onde o mesmo gateway envia o mesmo `event.id` para multiplos
 * connections (evita race entre handlers). Idempotente.
 */
export async function recordProcessedWebhook(
  provider: string,
  eventId: string,
  eventType: string,
  payload?: unknown
): Promise<{ alreadyProcessed: boolean }> {
  const inserted = await db
    .insert(processedWebhookEvents)
    .values({
      provider,
      eventId,
      eventType,
      payload: (payload ?? null) as Record<string, unknown> | null,
    })
    .onConflictDoNothing({
      target: [processedWebhookEvents.provider, processedWebhookEvents.eventId],
    })
    .returning()

  return { alreadyProcessed: inserted.length === 0 }
}
