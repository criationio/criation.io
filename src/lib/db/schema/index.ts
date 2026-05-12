export * from './auth'
export * from './billing'
export * from './connections'
export * from './campaigns'
export * from './gateway'
export * from './analyses'
export * from './tracking'
export * from './alerts'
export * from './learning'
export * from './admin'
export * from './affiliates'
export * from './audit'

import type { users, workspaces, workspaceMembers, workspaceInvites } from './auth'
import type {
  subscriptions,
  creditBalances,
  creditTransactions,
  creditPackages,
  packPurchases,
  pipelineCosts,
} from './billing'
import type {
  metaConnections,
  metaAdAccounts,
  metaDataDeletionRequests,
  googleConnections,
  connections,
} from './connections'
import type { campaigns, adSets, ads, adInsights, adCreatives } from './campaigns'
import type { gatewayEvents, gatewayProducts, gatewaySubscriptions } from './gateway'
import type { analyses, analysisResults, referencesLib } from './analyses'
import type {
  capiEventLog,
  capiEvents,
  clickIdStore,
  trackingEvents,
  trackingVisitors,
} from './tracking'
import type { alertRules, alerts, notifications } from './alerts'
import type { learningSignals, matchedCopyPatterns, measureOutcomes } from './learning'
import type { promptVersions, claudeRequestLogs, adminAuditLog, featureFlags } from './admin'
import type { affiliates, affiliateReferrals, affiliateCommissions } from './affiliates'
import type { auditLogs } from './audit'

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type CreditBalance = typeof creditBalances.$inferSelect
export type CreditTransaction = typeof creditTransactions.$inferSelect
export type NewCreditTransaction = typeof creditTransactions.$inferInsert
export type CreditPackage = typeof creditPackages.$inferSelect
export type PackPurchase = typeof packPurchases.$inferSelect
export type PipelineCost = typeof pipelineCosts.$inferSelect
export type FeatureFlag = typeof featureFlags.$inferSelect

export type MetaConnection = typeof metaConnections.$inferSelect
export type NewMetaConnection = typeof metaConnections.$inferInsert
export type MetaAdAccount = typeof metaAdAccounts.$inferSelect
export type NewMetaAdAccount = typeof metaAdAccounts.$inferInsert
export type MetaDataDeletionRequest = typeof metaDataDeletionRequests.$inferSelect
export type NewMetaDataDeletionRequest = typeof metaDataDeletionRequests.$inferInsert
export type GoogleConnection = typeof googleConnections.$inferSelect
export type Connection = typeof connections.$inferSelect
/** @deprecated use `Connection` */
export type GatewayConnection = Connection

export type Campaign = typeof campaigns.$inferSelect
export type NewCampaign = typeof campaigns.$inferInsert
export type AdSet = typeof adSets.$inferSelect
export type NewAdSet = typeof adSets.$inferInsert
export type Ad = typeof ads.$inferSelect
export type AdInsight = typeof adInsights.$inferSelect
export type AdCreative = typeof adCreatives.$inferSelect

export type GatewayEvent = typeof gatewayEvents.$inferSelect
export type NewGatewayEvent = typeof gatewayEvents.$inferInsert
export type GatewayProduct = typeof gatewayProducts.$inferSelect
export type NewGatewayProduct = typeof gatewayProducts.$inferInsert
export type GatewaySubscription = typeof gatewaySubscriptions.$inferSelect
export type NewGatewaySubscription = typeof gatewaySubscriptions.$inferInsert
export type NewConnection = typeof connections.$inferInsert
/** @deprecated use `NewConnection` */
export type NewGatewayConnection = NewConnection

export type Analysis = typeof analyses.$inferSelect
export type NewAnalysis = typeof analyses.$inferInsert
export type AnalysisResult = typeof analysisResults.$inferSelect
export type ReferenceLib = typeof referencesLib.$inferSelect

export type CapiEvent = typeof capiEvents.$inferSelect
export type NewCapiEvent = typeof capiEvents.$inferInsert
export type CapiEventLog = typeof capiEventLog.$inferSelect
export type NewCapiEventLog = typeof capiEventLog.$inferInsert
export type ClickId = typeof clickIdStore.$inferSelect
export type TrackingEvent = typeof trackingEvents.$inferSelect
export type NewTrackingEvent = typeof trackingEvents.$inferInsert
export type TrackingVisitor = typeof trackingVisitors.$inferSelect
export type NewTrackingVisitor = typeof trackingVisitors.$inferInsert

export type AlertRule = typeof alertRules.$inferSelect
export type Alert = typeof alerts.$inferSelect
export type Notification = typeof notifications.$inferSelect

export type LearningSignal = typeof learningSignals.$inferSelect
export type MatchedCopyPattern = typeof matchedCopyPatterns.$inferSelect
export type MeasureOutcome = typeof measureOutcomes.$inferSelect

export type PromptVersion = typeof promptVersions.$inferSelect
export type ClaudeRequestLog = typeof claudeRequestLogs.$inferSelect
export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect

export type Affiliate = typeof affiliates.$inferSelect
export type AffiliateReferral = typeof affiliateReferrals.$inferSelect
export type AffiliateCommission = typeof affiliateCommissions.$inferSelect

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
