import {
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { workspaces } from './auth'
import { metaAdAccounts } from './connections'

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Liga a campanha a ad_account especifico (Meta). NULL pra provider!=meta.
     * Critico pra cliente Agency com multiplas contas, e pra cleanup quando
     * cliente troca a conta vinculada (sync marca archived as orfas). */
    metaAdAccountId: uuid('meta_ad_account_id').references(() => metaAdAccounts.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    objective: text('objective'),
    dailyBudgetCents: integer('daily_budget_cents'),
    lifetimeBudgetCents: integer('lifetime_budget_cents'),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    providerData: jsonb('provider_data'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    // Aggregates de receita atribuida via UTM Stitcher (1.4.8). UPDATE inline
    // apos cada match perfect/manual. Quando volume escalar, migrar pra job
    // dedicado (TD-081).
    revenueGrossCents30d: integer('revenue_gross_cents_30d').notNull().default(0),
    revenueGrossCentsTotal: integer('revenue_gross_cents_total').notNull().default(0),
    attributedOrdersCount: integer('attributed_orders_count').notNull().default(0),
    /** ROAS = revenue / spend. Calculado on-write quando ad_insights e revenue
     * existem ambos. Null quando spend=0 ou nao ha insights ainda. */
    roasReal: decimal('roas_real', { precision: 10, scale: 4 }),
    lastStitchedAt: timestamp('last_stitched_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('campaigns_workspace_id_idx').on(t.workspaceId),
    unique('campaigns_workspace_provider_id_unique').on(t.workspaceId, t.provider, t.providerId),
    index('campaigns_status_idx').on(t.status),
    index('campaigns_last_synced_at_idx').on(t.lastSyncedAt),
    index('campaigns_meta_ad_account_idx').on(t.metaAdAccountId),
  ]
)

export const adSets = pgTable(
  'ad_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    metaAdAccountId: uuid('meta_ad_account_id').references(() => metaAdAccounts.id, {
      onDelete: 'set null',
    }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    targeting: jsonb('targeting'),
    providerData: jsonb('provider_data'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('ad_sets_workspace_id_idx').on(t.workspaceId),
    index('ad_sets_campaign_id_idx').on(t.campaignId),
    unique('ad_sets_workspace_campaign_provider_unique').on(
      t.workspaceId,
      t.campaignId,
      t.providerId
    ),
    index('ad_sets_status_idx').on(t.status),
    index('ad_sets_meta_ad_account_idx').on(t.metaAdAccountId),
  ]
)

export const ads = pgTable(
  'ads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    metaAdAccountId: uuid('meta_ad_account_id').references(() => metaAdAccounts.id, {
      onDelete: 'set null',
    }),
    adSetId: uuid('ad_set_id')
      .notNull()
      .references(() => adSets.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    creativeId: text('creative_id'),
    providerData: jsonb('provider_data'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('ads_workspace_id_idx').on(t.workspaceId),
    index('ads_ad_set_id_idx').on(t.adSetId),
    unique('ads_workspace_adset_provider_unique').on(t.workspaceId, t.adSetId, t.providerId),
    index('ads_status_idx').on(t.status),
    index('ads_meta_ad_account_idx').on(t.metaAdAccountId),
  ]
)

export const adInsights = pgTable(
  'ad_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    spendCents: integer('spend_cents').notNull().default(0),
    reach: integer('reach').default(0),
    frequency: decimal('frequency', { precision: 10, scale: 4 }),
    ctr: decimal('ctr', { precision: 10, scale: 6 }),
    cpcCents: integer('cpc_cents'),
    cpmCents: integer('cpm_cents'),
    hookRate: decimal('hook_rate', { precision: 10, scale: 4 }),
    holdRate15s: decimal('hold_rate_15s', { precision: 10, scale: 4 }),
    holdRate30s: decimal('hold_rate_30s', { precision: 10, scale: 4 }),
    videoViews: integer('video_views').default(0),
    providerData: jsonb('provider_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('ad_insights_workspace_id_idx').on(t.workspaceId),
    index('ad_insights_ad_id_idx').on(t.adId),
    index('ad_insights_date_idx').on(t.date),
    unique('ad_insights_workspace_ad_date_unique').on(t.workspaceId, t.adId, t.date),
  ]
)

export const adCreatives = pgTable(
  'ad_creatives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    adId: uuid('ad_id').references(() => ads.id, { onDelete: 'cascade' }),
    providerCreativeId: text('provider_creative_id'),
    type: text('type'),
    title: text('title'),
    body: text('body'),
    videoUrl: text('video_url'),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: integer('duration_seconds'),
    providerData: jsonb('provider_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('ad_creatives_workspace_id_idx').on(t.workspaceId),
    index('ad_creatives_ad_id_idx').on(t.adId),
  ]
)
