import { tasks } from '@trigger.dev/sdk/v3'

import { getCorrelationId } from '@/lib/correlation'

import type { syncCampaignsTask } from './tasks/sync-campaigns'
import type { metaTokenRefreshTask } from './tasks/meta-token-refresh'
import type { processGatewayEventTask } from './tasks/process-gateway-event'
import type { stitchGatewayEventTask } from './tasks/stitch-gateway-event'
import type { processTrackingEventTask } from './tasks/process-tracking-event'

/**
 * Helpers tipados pra disparar tasks de Server Actions / Route Handlers.
 *
 * Uso:
 *   import { triggerSyncCampaigns } from '@/lib/trigger/client'
 *   const handle = await triggerSyncCampaigns({ workspaceId: 'xxx' })
 *
 * Retorna o RunHandle com runId — util pra mostrar UI de progresso ou
 * fazer polling de status via SDK.
 *
 * **Correlation ID (TD-021b):** todos os helpers leem o correlationId atual
 * do `correlationStorage` (AsyncLocalStorage) e injetam no payload. Caller
 * em route handler / Server Action envelopado em `withCorrelation` propaga
 * automaticamente. Sem envelope, `getCorrelationId()` retorna UUID novo.
 */

export async function triggerSyncCampaigns(payload: { workspaceId?: string }) {
  return tasks.trigger<typeof syncCampaignsTask>('sync-campaigns', {
    ...payload,
    correlationId: getCorrelationId(),
  })
}

export async function triggerMetaTokenRefresh() {
  return tasks.trigger<typeof metaTokenRefreshTask>('meta-token-refresh', {
    correlationId: getCorrelationId(),
  })
}

export async function triggerProcessGatewayEvent(payload: {
  eventId: string
  workspaceId: string
  connectionId: string
}) {
  return tasks.trigger<typeof processGatewayEventTask>('process-gateway-event', {
    ...payload,
    correlationId: getCorrelationId(),
  })
}

export async function triggerStitchGatewayEvent(payload: { eventId: string; workspaceId: string }) {
  return tasks.trigger<typeof stitchGatewayEventTask>('stitch-gateway-event', {
    ...payload,
    correlationId: getCorrelationId(),
  })
}

export async function triggerProcessTrackingEvent(payload: {
  eventDbId: string
  /** ISO 8601 — necessario pra partition pruning na busca em tracking_events. */
  eventTs: string
  workspaceId: string
  visitorId: string
  eventName: string
}) {
  return tasks.trigger<typeof processTrackingEventTask>('process-tracking-event', {
    ...payload,
    correlationId: getCorrelationId(),
  })
}
