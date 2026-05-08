import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users, workspaces } from './auth'

export const alertRules = pgTable(
  'alert_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('alert_rules_workspace_id_idx').on(t.workspaceId),
    index('alert_rules_type_idx').on(t.type),
    index('alert_rules_enabled_idx').on(t.enabled),
  ]
)

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    ruleId: uuid('rule_id').references(() => alertRules.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    severity: text('severity').notNull().default('info'),
    title: text('title').notNull(),
    message: text('message'),
    data: jsonb('data'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('alerts_workspace_id_idx').on(t.workspaceId),
    index('alerts_read_at_idx')
      .on(t.readAt)
      .where(sql`read_at IS NULL`),
    index('alerts_severity_idx').on(t.severity),
    index('alerts_created_at_idx').on(t.createdAt),
  ]
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: jsonb('data'),
    channel: text('channel').notNull().default('in_app'),
    readAt: timestamp('read_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('notifications_workspace_id_idx').on(t.workspaceId),
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_read_at_idx')
      .on(t.readAt)
      .where(sql`read_at IS NULL`),
    index('notifications_created_at_idx').on(t.createdAt),
  ]
)
