import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

import { users, workspaces } from './auth'
import { creditTransactions } from './billing'

export const analysisFolders = pgTable(
  'analysis_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('analysis_folders_workspace_id_idx').on(t.workspaceId)]
)

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    pipelineId: text('pipeline_id').notNull(),
    name: text('name'),
    folderId: uuid('folder_id').references(() => analysisFolders.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('queued'),
    inputType: text('input_type').notNull(),
    inputUrl: text('input_url'),
    inputText: text('input_text'),
    videoDurationSeconds: integer('video_duration_seconds'),
    creditsConsumed: integer('credits_consumed').notNull().default(0),
    creditTransactionId: uuid('credit_transaction_id').references(() => creditTransactions.id, {
      onDelete: 'set null',
    }),
    triggerJobId: text('trigger_job_id'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('analyses_workspace_id_idx').on(t.workspaceId),
    index('analyses_user_id_idx').on(t.userId),
    index('analyses_status_idx').on(t.status),
    index('analyses_pipeline_id_idx').on(t.pipelineId),
    index('analyses_created_at_idx').on(t.createdAt),
    index('analyses_folder_id_idx').on(t.folderId),
  ]
)

export const analysisResults = pgTable(
  'analysis_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    pipelineId: text('pipeline_id').notNull(),
    resultData: jsonb('result_data').notNull(),
    /** Snapshot imutável do BLOCO DE TRANSIÇÃO que a IA viu (baseline, 1.11). */
    inputSnapshot: jsonb('input_snapshot'),
    modelUsed: text('model_used'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    processingTimeMs: integer('processing_time_ms'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('analysis_results_analysis_id_unique').on(t.analysisId),
    index('analysis_results_workspace_id_idx').on(t.workspaceId),
  ]
)

export const referencesLib = pgTable(
  'references_lib',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    thumbnailUrl: text('thumbnail_url'),
    notes: text('notes'),
    tags: text('tags').array(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('references_lib_workspace_id_idx').on(t.workspaceId),
    index('references_lib_type_idx').on(t.type),
    index('references_lib_created_by_idx').on(t.createdBy),
  ]
)
