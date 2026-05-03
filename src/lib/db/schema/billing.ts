import {
  boolean,
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
import { sql } from 'drizzle-orm'

import { users, workspaces } from './auth'

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    planId: text('plan_id').notNull(),
    status: text('status').notNull().default('pending'),
    paymentProvider: text('payment_provider').notNull(),
    providerSubscriptionId: text('provider_subscription_id'),
    providerCustomerId: text('provider_customer_id'),
    creditsPerCycle: integer('credits_per_cycle').notNull().default(0),
    currentCycleCreditsRemaining: integer('current_cycle_credits_remaining').notNull().default(0),
    currentCycleStartedAt: timestamp('current_cycle_started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    currentCycleEndsAt: timestamp('current_cycle_ends_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancellationScheduledAt: timestamp('cancellation_scheduled_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('subscriptions_workspace_id_unique').on(t.workspaceId),
    index('subscriptions_status_idx').on(t.status),
    index('subscriptions_provider_sub_id_idx').on(t.providerSubscriptionId),
  ],
)

export const creditBalances = pgTable(
  'credit_balances',
  {
    workspaceId: uuid('workspace_id')
      .primaryKey()
      .references(() => workspaces.id),
    balance: integer('balance').notNull().default(0),
    signupBalance: integer('signup_balance').notNull().default(0),
    signupExpiresAt: timestamp('signup_expires_at', { withTimezone: true }),
    subscriptionBalance: integer('subscription_balance').notNull().default(0),
    subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
    packBalance: integer('pack_balance').notNull().default(0),
    adminBalance: integer('admin_balance').notNull().default(0),
    adminExpiresAt: timestamp('admin_expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('credit_balances_expiry_idx')
      .on(t.signupExpiresAt, t.subscriptionExpiresAt, t.adminExpiresAt)
      .where(sql`balance > 0`),
  ],
)

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: uuid('user_id').references(() => users.id),
    type: text('type').notNull(),
    source: text('source').notNull(),
    amount: integer('amount').notNull(),
    analysisId: text('analysis_id'),
    pipelineId: text('pipeline_id'),
    packPurchaseId: uuid('pack_purchase_id'),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    idempotencyKey: text('idempotency_key'),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('credit_transactions_workspace_created_idx').on(t.workspaceId, t.createdAt),
    index('credit_transactions_analysis_id_idx')
      .on(t.analysisId)
      .where(sql`analysis_id IS NOT NULL`),
    unique('credit_transactions_idempotency_key_unique').on(t.idempotencyKey),
  ],
)

export const creditPackages = pgTable(
  'credit_packages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    credits: integer('credits').notNull(),
    priceBrlCents: integer('price_brl_cents').notNull(),
    priceUsdCents: integer('price_usd_cents'),
    validityDays: integer('validity_days').notNull().default(60),
    active: boolean('active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('credit_packages_sku_unique').on(t.sku),
    index('credit_packages_active_idx').on(t.active).where(sql`active = true`),
  ],
)

export const packPurchases = pgTable(
  'pack_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    packageId: uuid('package_id')
      .notNull()
      .references(() => creditPackages.id),
    creditsGranted: integer('credits_granted').notNull(),
    creditsRemaining: integer('credits_remaining').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paymentProvider: text('payment_provider').notNull(),
    paymentId: text('payment_id').notNull(),
    amountPaidCents: integer('amount_paid_cents').notNull(),
    currency: text('currency').notNull().default('BRL'),
    status: text('status').notNull().default('pending'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('pack_purchases_workspace_active_idx')
      .on(t.workspaceId, t.expiresAt)
      .where(sql`status = 'active' AND credits_remaining > 0`),
  ],
)

export const pipelineCosts = pgTable('pipeline_costs', {
  pipelineId: text('pipeline_id').primaryKey(),
  costCredits: integer('cost_credits').notNull(),
  estimatedRealCostBrl: decimal('estimated_real_cost_brl', { precision: 10, scale: 2 }),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id),
})

export const pipelineCostsHistory = pgTable(
  'pipeline_costs_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: text('pipeline_id').notNull(),
    costCredits: integer('cost_credits').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('pipeline_costs_history_pipeline_id_idx').on(t.pipelineId)],
)

export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('processed_webhook_events_provider_event_unique').on(t.provider, t.eventId)],
)
