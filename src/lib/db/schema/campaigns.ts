import { date, decimal, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { workspaces } from './auth'

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
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
  ],
)

export const adSets = pgTable(
  'ad_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id),
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
    unique('ad_sets_workspace_campaign_provider_unique').on(t.workspaceId, t.campaignId, t.providerId),
    index('ad_sets_status_idx').on(t.status),
  ],
)

export const ads = pgTable(
  'ads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    adSetId: uuid('ad_set_id')
      .notNull()
      .references(() => adSets.id),
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
  ],
)

export const adInsights = pgTable(
  'ad_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    adId: uuid('ad_id')
      .notNull()
      .references(() => ads.id),
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
  ],
)

export const adCreatives = pgTable(
  'ad_creatives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    adId: uuid('ad_id').references(() => ads.id),
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
  ],
)
