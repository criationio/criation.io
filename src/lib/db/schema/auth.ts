import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('user'),
    defaultWorkspaceId: uuid('default_workspace_id').references((): AnyPgColumn => workspaces.id, {
      onDelete: 'set null',
    }),
    onboardingStep: text('onboarding_step').notNull().default('perfil'),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    signupIpHash: text('signup_ip_hash'),
    signupUserAgentHash: text('signup_user_agent_hash'),
    signupFingerprint: text('signup_fingerprint'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('users_email_idx').on(t.email),
    unique('users_email_unique').on(t.email),
    check('users_role_check', sql`${t.role} IN ('user', 'admin', 'super_admin')`),
    check(
      'users_onboarding_step_check',
      sql`${t.onboardingStep} IN ('perfil', 'gateway', 'meta', 'utm_check', 'google', 'primeira_analise', 'tour', 'completed')`
    ),
  ]
)

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    planId: text('plan_id').notNull().default('free'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [unique('workspaces_slug_unique').on(t.slug)]
)

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('workspace_members_workspace_id_idx').on(t.workspaceId),
    index('workspace_members_user_id_idx').on(t.userId),
    index('workspace_members_user_active_idx')
      .on(t.userId, t.isActive)
      .where(sql`is_active = true`),
    unique('workspace_members_workspace_user_unique').on(t.workspaceId, t.userId),
    check('workspace_members_role_check', sql`${t.role} IN ('owner', 'admin', 'editor', 'viewer')`),
  ]
)

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    token: text('token').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('workspace_invites_token_unique').on(t.token),
    index('workspace_invites_workspace_id_idx').on(t.workspaceId),
    index('workspace_invites_email_idx').on(t.email),
    check('workspace_invites_role_check', sql`${t.role} IN ('owner', 'admin', 'editor', 'viewer')`),
  ]
)
