import { boolean, decimal, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { users, workspaces } from './auth'

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: text('pipeline_id').notNull(),
    version: text('version').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    userPromptTemplate: text('user_prompt_template'),
    model: text('model').notNull(),
    maxTokens: integer('max_tokens'),
    temperature: decimal('temperature', { precision: 3, scale: 2 }),
    status: text('status').notNull().default('draft'),
    canaryPercentage: integer('canary_percentage').default(0),
    deployedBy: uuid('deployed_by').references(() => users.id),
    deployedAt: timestamp('deployed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('prompt_versions_pipeline_id_idx').on(t.pipelineId),
    index('prompt_versions_status_idx').on(t.status),
    unique('prompt_versions_pipeline_version_unique').on(t.pipelineId, t.version),
  ],
)

export const claudeRequestLogs = pgTable(
  'claude_request_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    analysisId: uuid('analysis_id'),
    pipelineId: text('pipeline_id'),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    latencyMs: integer('latency_ms'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 6 }),
    promptVersionId: uuid('prompt_version_id').references(() => promptVersions.id),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('claude_request_logs_workspace_id_idx').on(t.workspaceId),
    index('claude_request_logs_pipeline_id_idx').on(t.pipelineId),
    index('claude_request_logs_created_at_idx').on(t.createdAt),
    index('claude_request_logs_model_idx').on(t.model),
  ],
)

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    payload: jsonb('payload'),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_log_admin_user_id_idx').on(t.adminUserId),
    index('admin_audit_log_action_idx').on(t.action),
    index('admin_audit_log_target_type_idx').on(t.targetType),
    index('admin_audit_log_created_at_idx').on(t.createdAt),
  ],
)

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    rolloutPercentage: integer('rollout_percentage').default(0),
    config: jsonb('config'),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique('feature_flags_key_unique').on(t.key)],
)
