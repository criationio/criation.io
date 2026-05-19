import { decimal, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { workspaces } from './auth'
import { analyses } from './analyses'

export const learningSignals = pgTable(
  'learning_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }),
    signalType: text('signal_type').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('learning_signals_workspace_id_idx').on(t.workspaceId),
    index('learning_signals_analysis_id_idx').on(t.analysisId),
    index('learning_signals_signal_type_idx').on(t.signalType),
  ]
)

export const matchedCopyPatterns = pgTable(
  'matched_copy_patterns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    niche: text('niche'),
    patternType: text('pattern_type').notNull(),
    patternData: jsonb('pattern_data').notNull(),
    performanceScore: decimal('performance_score', { precision: 5, scale: 4 }),
    sampleSize: integer('sample_size').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('matched_copy_patterns_workspace_id_idx').on(t.workspaceId),
    index('matched_copy_patterns_niche_idx').on(t.niche),
    index('matched_copy_patterns_pattern_type_idx').on(t.patternType),
  ]
)

export const measureOutcomes = pgTable(
  'measure_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    metricType: text('metric_type').notNull(),
    valueBefore: decimal('value_before', { precision: 10, scale: 4 }),
    valueAfter: decimal('value_after', { precision: 10, scale: 4 }),
    improvementPct: decimal('improvement_pct', { precision: 10, scale: 4 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('measure_outcomes_workspace_id_idx').on(t.workspaceId),
    index('measure_outcomes_analysis_id_idx').on(t.analysisId),
    index('measure_outcomes_metric_type_idx').on(t.metricType),
    index('measure_outcomes_measured_at_idx').on(t.measuredAt),
  ]
)
