import { tasks } from '@trigger.dev/sdk/v3'

import type { syncCampaignsTask } from './tasks/sync-campaigns'
import type { metaTokenRefreshTask } from './tasks/meta-token-refresh'

/**
 * Helpers tipados pra disparar tasks de Server Actions / Route Handlers.
 *
 * Uso:
 *   import { triggerSyncCampaigns } from '@/lib/trigger/client'
 *   const handle = await triggerSyncCampaigns({ workspaceId: 'xxx' })
 *
 * Retorna o RunHandle com runId — util pra mostrar UI de progresso ou
 * fazer polling de status via SDK.
 */

export async function triggerSyncCampaigns(payload: { workspaceId?: string }) {
  return tasks.trigger<typeof syncCampaignsTask>('sync-campaigns', payload)
}

export async function triggerMetaTokenRefresh() {
  return tasks.trigger<typeof metaTokenRefreshTask>('meta-token-refresh', undefined)
}
