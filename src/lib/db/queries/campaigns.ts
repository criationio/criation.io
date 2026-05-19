import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adInsights, adSets, ads, campaigns } from '@/lib/db/schema/campaigns'
import type { AdInsight, Campaign, NewCampaign } from '@/lib/db/schema'

/**
 * UPSERT idempotente de campaign. Conflito em
 * (workspace_id, provider, provider_id) atualiza nome/status/budgets.
 */
export async function upsertCampaign(input: NewCampaign): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values(input)
    .onConflictDoUpdate({
      target: [campaigns.workspaceId, campaigns.provider, campaigns.providerId],
      set: {
        name: input.name,
        status: input.status,
        objective: input.objective ?? null,
        dailyBudgetCents: input.dailyBudgetCents ?? null,
        lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertCampaign nao retornou row')
  return row
}

export async function upsertAdSet(input: typeof adSets.$inferInsert) {
  const [row] = await db
    .insert(adSets)
    .values(input)
    .onConflictDoUpdate({
      target: [adSets.workspaceId, adSets.campaignId, adSets.providerId],
      set: {
        name: input.name,
        status: input.status,
        targeting: input.targeting ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAdSet nao retornou row')
  return row
}

export async function upsertAd(input: typeof ads.$inferInsert) {
  const [row] = await db
    .insert(ads)
    .values(input)
    .onConflictDoUpdate({
      target: [ads.workspaceId, ads.adSetId, ads.providerId],
      set: {
        name: input.name,
        status: input.status,
        creativeId: input.creativeId ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAd nao retornou row')
  return row
}

export async function upsertAdInsight(input: typeof adInsights.$inferInsert): Promise<AdInsight> {
  const [row] = await db
    .insert(adInsights)
    .values(input)
    .onConflictDoUpdate({
      target: [adInsights.workspaceId, adInsights.adId, adInsights.date],
      set: {
        impressions: input.impressions ?? 0,
        clicks: input.clicks ?? 0,
        spendCents: input.spendCents ?? 0,
        reach: input.reach ?? 0,
        frequency: input.frequency ?? null,
        ctr: input.ctr ?? null,
        cpcCents: input.cpcCents ?? null,
        cpmCents: input.cpmCents ?? null,
        hookRate: input.hookRate ?? null,
        holdRate15s: input.holdRate15s ?? null,
        holdRate30s: input.holdRate30s ?? null,
        videoViews: input.videoViews ?? 0,
        providerData: input.providerData ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAdInsight nao retornou row')
  return row
}

/**
 * Marca como ARCHIVED toda campaign/ad_set/ad de um ad_account especifico que
 * NAO foi tocada apos `syncStartedAt` — ou seja, sumiu da resposta Meta API
 * (foi deletada na conta ou nao pertence mais a essa conta).
 *
 * Chamado pelo sync apos upsert completo de uma ad_account, com timestamp do
 * inicio do sync. CASCADE manual via JOIN porque archived flag e por nivel.
 */
export async function archiveStaleByAdAccount(input: {
  workspaceId: string
  metaAdAccountId: string
  syncStartedAt: Date
}): Promise<{ campaignsArchived: number; adSetsArchived: number; adsArchived: number }> {
  const { workspaceId, metaAdAccountId, syncStartedAt } = input

  const ar = await db
    .update(campaigns)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.workspaceId, workspaceId),
        eq(campaigns.metaAdAccountId, metaAdAccountId),
        sql`(${campaigns.lastSyncedAt} IS NULL OR ${campaigns.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${campaigns.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: campaigns.id })

  const asr = await db
    .update(adSets)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(adSets.workspaceId, workspaceId),
        eq(adSets.metaAdAccountId, metaAdAccountId),
        sql`(${adSets.lastSyncedAt} IS NULL OR ${adSets.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${adSets.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: adSets.id })

  const adr = await db
    .update(ads)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        eq(ads.metaAdAccountId, metaAdAccountId),
        sql`(${ads.lastSyncedAt} IS NULL OR ${ads.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${ads.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: ads.id })

  return {
    campaignsArchived: ar.length,
    adSetsArchived: asr.length,
    adsArchived: adr.length,
  }
}

/**
 * Lookup helpers — usados pelo sync pra mapear provider_id -> uuid local.
 */
export async function findCampaignByProviderId(input: {
  workspaceId: string
  provider: string
  providerId: string
}): Promise<Campaign | null> {
  const row = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.workspaceId, input.workspaceId),
      eq(campaigns.provider, input.provider),
      eq(campaigns.providerId, input.providerId)
    ),
  })
  return row ?? null
}

export async function findAdByProviderId(input: { workspaceId: string; providerId: string }) {
  const row = await db.query.ads.findFirst({
    where: and(eq(ads.workspaceId, input.workspaceId), eq(ads.providerId, input.providerId)),
  })
  return row ?? null
}

/**
 * Lista campanhas do workspace ordenado por gasto (7d) desc, com
 * agregados de insights pra UI da Sessao 1.4 (versao basica de /campanhas).
 */
export async function listCampaignsWithMetrics(workspaceId: string, limit = 50) {
  // SQL raw porque agregacao envolve insights ↔ ads ↔ ad_sets ↔ campaigns
  // e Drizzle relational query nao expressa isso de forma elegante.
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.provider,
      c.provider_id,
      c.name,
      c.status,
      c.objective,
      c.last_synced_at,
      COALESCE(SUM(i.spend_cents), 0)::int AS spend_7d_cents,
      COALESCE(SUM(i.impressions), 0)::int AS impressions_7d,
      COALESCE(SUM(i.clicks), 0)::int AS clicks_7d,
      CASE
        WHEN COALESCE(SUM(i.impressions), 0) > 0
        THEN ROUND((SUM(i.clicks)::numeric / SUM(i.impressions)) * 100, 4)
        ELSE NULL
      END AS ctr_7d_pct
    FROM campaigns c
    LEFT JOIN ad_sets s ON s.campaign_id = c.id
    LEFT JOIN ads a ON a.ad_set_id = s.id
    LEFT JOIN ad_insights i ON i.ad_id = a.id
      AND i.date >= CURRENT_DATE - INTERVAL '7 days'
    WHERE c.workspace_id = ${workspaceId}
    GROUP BY c.id
    ORDER BY spend_7d_cents DESC, c.last_synced_at DESC NULLS LAST
    LIMIT ${limit}
  `)

  return rows as unknown as Array<{
    id: string
    provider: string
    provider_id: string
    name: string
    status: string
    objective: string | null
    last_synced_at: Date | null
    spend_7d_cents: number
    impressions_7d: number
    clicks_7d: number
    ctr_7d_pct: string | null
  }>
}
