import { decrypt } from '@/lib/encryption'
import { capiLogger } from '@/lib/logger'
import {
  archiveStaleByAdAccount,
  findAdByProviderId,
  findCampaignByProviderId,
  upsertAd,
  upsertAdInsight,
  upsertAdSet,
  upsertCampaign,
  upsertCreative,
} from '@/lib/db/queries/campaigns'
import {
  listAdAccountsByConnection,
  markConnectionExpired,
  markConnectionSynced,
} from '@/lib/db/queries/meta-connections'
import type { MetaConnection } from '@/lib/db/schema'

import {
  extractCreativeContent,
  getAdInsights,
  listAds,
  listAdSets,
  listCampaigns,
  MetaApiError,
} from './meta.service'
import { refreshIfNeeded } from './token-refresh.service'

const PROVIDER = 'meta'
const MAX_CAMPAIGNS_PER_CONNECTION = 100

export interface SyncOutcome {
  workspaceId: string
  connectionId: string
  status: 'success' | 'token_expired' | 'partial' | 'failed'
  campaignsUpserted: number
  adSetsUpserted: number
  adsUpserted: number
  creativesUpserted: number
  insightsUpserted: number
  errors: string[]
  durationMs: number
}

/**
 * Sincroniza uma meta_connection: lista ad_accounts ativas → para cada,
 * lista campaigns/ad_sets/ads, busca insights 7d e UPSERTA tudo.
 *
 * Tratamento de erros:
 * - Token expirado/revoked (190/102) → markConnectionExpired, retorna 'token_expired'
 * - Rate limit (4/17/32/613) → propaga (Trigger.dev cuida do retry)
 * - Falha em uma ad_account nao bloqueia outras (Promise.allSettled)
 * - Sucessos parciais sao contados; outcome=='partial' se errors > 0
 */
export async function syncConnection(connection: MetaConnection): Promise<SyncOutcome> {
  const start = Date.now()
  const outcome: SyncOutcome = {
    workspaceId: connection.workspaceId,
    connectionId: connection.id,
    status: 'success',
    campaignsUpserted: 0,
    adSetsUpserted: 0,
    adsUpserted: 0,
    creativesUpserted: 0,
    insightsUpserted: 0,
    errors: [],
    durationMs: 0,
  }

  // Refresh token se proximo de expirar (< 7d). Idempotente.
  const refresh = await refreshIfNeeded(connection)
  if (refresh.reason === 'expired') {
    outcome.status = 'token_expired'
    outcome.durationMs = Date.now() - start
    return outcome
  }

  let accessToken: string
  try {
    // Re-fetch connection caso refresh tenha rotacionado o token
    accessToken = decrypt(connection.encryptedAccessToken)
  } catch (err) {
    capiLogger.error({ err, connectionId: connection.id }, 'sync: decrypt failed')
    outcome.status = 'failed'
    outcome.errors.push('decrypt_failed')
    outcome.durationMs = Date.now() - start
    return outcome
  }

  const adAccounts = await listAdAccountsByConnection(connection.id)
  if (adAccounts.length === 0) {
    capiLogger.warn(
      { workspaceId: connection.workspaceId, connectionId: connection.id },
      'sync: nenhum ad account, pulando'
    )
    outcome.durationMs = Date.now() - start
    await markConnectionSynced(connection.id)
    return outcome
  }

  const results = await Promise.allSettled(
    adAccounts.map((acc) =>
      syncAdAccount({
        accessToken,
        workspaceId: connection.workspaceId,
        adAccountId: acc.adAccountId,
        metaAdAccountLocalId: acc.id,
      })
    )
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      outcome.campaignsUpserted += r.value.campaignsUpserted
      outcome.adSetsUpserted += r.value.adSetsUpserted
      outcome.adsUpserted += r.value.adsUpserted
      outcome.creativesUpserted += r.value.creativesUpserted
      outcome.insightsUpserted += r.value.insightsUpserted
      if (r.value.errors.length > 0) {
        outcome.errors.push(...r.value.errors)
        outcome.status = 'partial'
      }
    } else {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
      outcome.errors.push(reason)
      outcome.status = 'partial'
      // Token expirado em qualquer ad_account marca a connection inteira
      if (r.reason instanceof MetaApiError && (r.reason.code === 190 || r.reason.code === 102)) {
        await markConnectionExpired(connection.id)
        outcome.status = 'token_expired'
      }
    }
  }

  if (outcome.status === 'success' || outcome.status === 'partial') {
    await markConnectionSynced(connection.id)
  }

  outcome.durationMs = Date.now() - start
  capiLogger.info(
    {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      status: outcome.status,
      campaignsUpserted: outcome.campaignsUpserted,
      adSetsUpserted: outcome.adSetsUpserted,
      adsUpserted: outcome.adsUpserted,
      creativesUpserted: outcome.creativesUpserted,
      insightsUpserted: outcome.insightsUpserted,
      errorsCount: outcome.errors.length,
      durationMs: outcome.durationMs,
    },
    'sync connection completed'
  )

  return outcome
}

interface AdAccountSyncResult {
  campaignsUpserted: number
  adSetsUpserted: number
  adsUpserted: number
  creativesUpserted: number
  insightsUpserted: number
  errors: string[]
}

async function syncAdAccount(input: {
  accessToken: string
  workspaceId: string
  adAccountId: string
  /** UUID local da meta_ad_accounts row pra essa ad_account. Passado pelo
   * caller pra ligar campaigns/adsets/ads ao ad_account no banco. */
  metaAdAccountLocalId: string
}): Promise<AdAccountSyncResult> {
  const result: AdAccountSyncResult = {
    campaignsUpserted: 0,
    adSetsUpserted: 0,
    adsUpserted: 0,
    creativesUpserted: 0,
    insightsUpserted: 0,
    errors: [],
  }

  // Timestamp pra archive de orfaos no fim. Campaigns/adsets/ads desse ad_account
  // que nao forem tocadas (lastSyncedAt < syncStartedAt) viram ARCHIVED.
  const syncStartedAt = new Date()

  // 1. Campaigns
  const campaigns = await listCampaigns({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    limit: MAX_CAMPAIGNS_PER_CONNECTION,
  })

  for (const c of campaigns) {
    try {
      await upsertCampaign({
        workspaceId: input.workspaceId,
        provider: PROVIDER,
        providerId: c.id,
        metaAdAccountId: input.metaAdAccountLocalId,
        name: c.name,
        status: c.effectiveStatus ?? c.status,
        objective: c.objective,
        dailyBudgetCents: c.dailyBudgetCents,
        lifetimeBudgetCents: c.lifetimeBudgetCents,
        startTime: c.startTime,
        endTime: c.stopTime,
      })
      result.campaignsUpserted += 1
    } catch (err) {
      result.errors.push(`campaign ${c.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 2. Ad Sets (per campaign, sequencial pra evitar rate spike)
  for (const c of campaigns) {
    const local = await findCampaignByProviderId({
      workspaceId: input.workspaceId,
      provider: PROVIDER,
      providerId: c.id,
    })
    if (!local) continue

    let adSets
    try {
      adSets = await listAdSets({ accessToken: input.accessToken, campaignId: c.id })
    } catch (err) {
      result.errors.push(`adsets ${c.id}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }

    for (const s of adSets) {
      try {
        const localAdSet = await upsertAdSet({
          workspaceId: input.workspaceId,
          campaignId: local.id,
          metaAdAccountId: input.metaAdAccountLocalId,
          providerId: s.id,
          name: s.name,
          status: s.effectiveStatus ?? s.status,
          targeting: s.targeting,
        })
        result.adSetsUpserted += 1

        // 3. Ads (per ad_set)
        let adsList
        try {
          adsList = await listAds({ accessToken: input.accessToken, adSetId: s.id })
        } catch (err) {
          result.errors.push(`ads ${s.id}: ${err instanceof Error ? err.message : String(err)}`)
          continue
        }

        for (const a of adsList) {
          try {
            const localAd = await upsertAd({
              workspaceId: input.workspaceId,
              adSetId: localAdSet.id,
              metaAdAccountId: input.metaAdAccountLocalId,
              providerId: a.id,
              name: a.name,
              status: a.effectiveStatus ?? a.status,
              creativeId: a.creativeId,
            })
            result.adsUpserted += 1

            // Criativo (1.7 creative sync): conteudo veio expandido no ad.
            // Erro de 1 criativo nao derruba o sync do ad.
            if (a.creative) {
              try {
                const content = extractCreativeContent(a.creative)
                await upsertCreative({
                  workspaceId: input.workspaceId,
                  adId: localAd.id,
                  providerCreativeId: a.creativeId,
                  type: content.type,
                  title: content.title,
                  body: content.body,
                  thumbnailUrl: content.thumbnailUrl,
                  providerData: a.creative,
                })
                result.creativesUpserted += 1
              } catch (err) {
                result.errors.push(
                  `creative ${a.creativeId}: ${err instanceof Error ? err.message : String(err)}`
                )
              }
            }
          } catch (err) {
            result.errors.push(`ad ${a.id}: ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      } catch (err) {
        result.errors.push(`adset ${s.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // 5. Archive orfaos — campaigns/adsets/ads desse ad_account que nao foram
  // tocados no sync. Sao itens que sumiram do Meta (deletados ou conta trocada).
  try {
    const archived = await archiveStaleByAdAccount({
      workspaceId: input.workspaceId,
      metaAdAccountId: input.metaAdAccountLocalId,
      syncStartedAt,
    })
    if (archived.campaignsArchived + archived.adSetsArchived + archived.adsArchived > 0) {
      capiLogger.info(
        {
          workspaceId: input.workspaceId,
          adAccountId: input.adAccountId,
          ...archived,
        },
        'sync archived stale items'
      )
    }
  } catch (err) {
    result.errors.push(`archive: ${err instanceof Error ? err.message : String(err)}`)
  }

  // 4. Insights (a nivel ad_account, retorna 7d por ad por dia)
  let insights
  try {
    insights = await getAdInsights({
      accessToken: input.accessToken,
      adAccountId: input.adAccountId,
      datePreset: 'last_7d',
    })
  } catch (err) {
    result.errors.push(`insights: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  for (const i of insights) {
    const localAd = await findAdByProviderId({
      workspaceId: input.workspaceId,
      providerId: i.adId,
    })
    if (!localAd) {
      // Ad nao foi sincronizado nesta rodada (talvez rotation cap) — pula insight
      continue
    }

    try {
      await upsertAdInsight({
        workspaceId: input.workspaceId,
        adId: localAd.id,
        date: i.date,
        impressions: i.impressions,
        clicks: i.clicks,
        spendCents: i.spendCents,
        reach: i.reach,
        frequency: i.frequency !== null ? String(i.frequency) : null,
        ctr: i.ctr !== null ? String(i.ctr) : null,
        cpcCents: i.cpcCents,
        cpmCents: i.cpmCents,
        hookRate: i.hookRate !== null ? String(i.hookRate) : null,
        holdRate15s: i.holdRate15s !== null ? String(i.holdRate15s) : null,
        holdRate30s: i.holdRate30s !== null ? String(i.holdRate30s) : null,
        videoViews: i.videoViews,
      })
      result.insightsUpserted += 1
    } catch (err) {
      result.errors.push(
        `insight ${i.adId} ${i.date}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
