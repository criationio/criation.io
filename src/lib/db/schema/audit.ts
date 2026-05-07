import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { users, workspaces } from './auth'

/**
 * Audit log generico para eventos de sistema (fraude, alertas de seguranca,
 * acoes admin sem actor admin obrigatorio, etc).
 *
 * Diferente de admin_audit_log: aquele exige admin_user_id NOT NULL e e
 * dedicado a acoes deliberadas de admin no painel. audit_logs e mais amplo:
 * eventos de sistema (signup burst, password reset suspeito) podem nao ter
 * actor admin.
 *
 * RLS: insert via service-role apenas (createServiceClient). Read restrito
 * a service-role — auditoria e investigada via admin tools, nao exposta a
 * users comuns.
 *
 * ADR-012.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload'),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_event_type_idx').on(t.eventType),
    index('audit_logs_workspace_id_idx').on(t.workspaceId),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ]
)
