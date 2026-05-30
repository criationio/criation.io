import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users, workspaces } from './auth'

/**
 * Dashboard layouts customizaveis (Sessao 1.6).
 *
 * Cada row = uma "view" salva. `user_id IS NULL` -> shared workspace
 * (qualquer membro acessa). `user_id = X` -> privada do user. `is_default`
 * = true marca qual view abre por padrao pra esse user (max 1 per
 * workspace+user combo, enforced por unique index parcial em SQL).
 *
 * layout jsonb: estrutura de widgets (id, type, posicao no grid, config).
 * filters jsonb: defaults de periodo/comparacao/atribuicao/canais por view.
 */
export const dashboardLayouts = pgTable(
  'dashboard_layouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** NULL = view shared workspace; set = view privada do user. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    /** { widgets: [{id, type, gridArea:{x,y,w,h}, config?}], gridCols: number } */
    layout: jsonb('layout')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** { period, comparison, attribution, channels?, campaigns? } */
    filters: jsonb('filters')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('dashboard_layouts_workspace_id_idx')
      .on(t.workspaceId)
      .where(sql`deleted_at IS NULL`),
    index('dashboard_layouts_user_id_idx')
      .on(t.userId)
      .where(sql`deleted_at IS NULL`),
    // Unique parcial — apenas 1 default por (workspace, user). COALESCE
    // trata NULL user_id (view shared) como sentinel consistente.
    uniqueIndex('dashboard_layouts_default_unique')
      .on(t.workspaceId, sql`COALESCE(${t.userId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  ]
)

// ============================================================================
// Tipos shape do `layout` e `filters` jsonb (validados via Zod nas actions)
// ============================================================================

/** Conjunto canonico de tipos de widget conhecidos hoje. Schema do jsonb
 *  aceita string livre pra evolucao incremental — DashboardWidgetType serve
 *  como union pra autocomplete em codigo novo, sem quebrar persistencia
 *  quando widget novo for adicionado. */
export type DashboardWidgetType =
  | 'kpi-cards'
  | 'funnel-pyramid'
  | 'sales-vs-investment'
  | 'top-creatives'
  | 'channel-mix'
  | 'utm-source-table'
  | 'cohort-heatmap'
  | 'roas-trend'
  | 'cac-trend'
  | 'refund-rate'
  | 'day-hour-heatmap'
  | (string & {})

export interface DashboardWidget {
  id: string
  type: DashboardWidgetType
  gridArea: { x: number; y: number; w: number; h: number }
  config?: Record<string, unknown>
}

export interface DashboardLayoutData {
  widgets: DashboardWidget[]
  gridCols: number
}

export type DashboardPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_30d'
  | 'last_90d'
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'last_month'
  | 'last_quarter'
  | 'custom'

export type DashboardComparison = 'previous_period' | 'same_period_last_year' | 'custom' | 'none'

export type DashboardAttribution =
  | 'last_click'
  | 'first_click'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'data_driven'

export interface DashboardFiltersData {
  period?: { preset?: DashboardPeriodPreset; start?: string; end?: string }
  comparison?: DashboardComparison
  attribution?: DashboardAttribution
  channels?: string[]
  campaigns?: string[]
  segments?: string[]
}

// ============================================================================
// Funis nomeados (PR-13c)
// ============================================================================

export const dashboardFunnels = pgTable(
  'dashboard_funnels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    /** Glob/regex de URL — landing pages do funil. Ex: "promo.dominio.com/*". */
    landingUrlPattern: text('landing_url_pattern'),
    /** Glob/regex de utm_campaign. Ex: "vsl-emag-*". */
    utmCampaignPattern: text('utm_campaign_pattern'),
    /** Array de gateway_products.id que pertencem a esse funil. */
    productIds: jsonb('product_ids')
      .notNull()
      .default(sql`'[]'::jsonb`),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('dashboard_funnels_workspace_id_idx')
      .on(t.workspaceId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('dashboard_funnels_default_unique')
      .on(t.workspaceId)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  ]
)
