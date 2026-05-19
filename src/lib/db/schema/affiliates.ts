import {
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

import { users, workspaces } from './auth'

export const affiliates = pgTable(
  'affiliates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    referralCode: text('referral_code').notNull(),
    status: text('status').notNull().default('active'),
    commissionRate: decimal('commission_rate', { precision: 5, scale: 4 })
      .notNull()
      .default('0.20'),
    totalEarnedCents: integer('total_earned_cents').notNull().default(0),
    totalPaidCents: integer('total_paid_cents').notNull().default(0),
    payoutMethod: text('payout_method'),
    payoutDetails: jsonb('payout_details'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('affiliates_user_id_idx').on(t.userId),
    unique('affiliates_referral_code_unique').on(t.referralCode),
    index('affiliates_status_idx').on(t.status),
  ]
)

export const affiliateReferrals = pgTable(
  'affiliate_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    referredWorkspaceId: uuid('referred_workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    referralCode: text('referral_code').notNull(),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    firstPaymentAt: timestamp('first_payment_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('affiliate_referrals_affiliate_id_idx').on(t.affiliateId),
    index('affiliate_referrals_referred_workspace_id_idx').on(t.referredWorkspaceId),
  ]
)

export const affiliateCommissions = pgTable(
  'affiliate_commissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => affiliateReferrals.id, { onDelete: 'cascade' }),
    subscriptionPaymentId: text('subscription_payment_id'),
    amountCents: integer('amount_cents').notNull(),
    status: text('status').notNull().default('pending'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('affiliate_commissions_affiliate_id_idx').on(t.affiliateId),
    index('affiliate_commissions_status_idx').on(t.status),
    index('affiliate_commissions_created_at_idx').on(t.createdAt),
  ]
)
