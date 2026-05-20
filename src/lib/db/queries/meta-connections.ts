import { and, eq, isNull, lt } from 'drizzle-orm'

import { db } from '@/lib/db'
import { metaAdAccounts, metaConnections } from '@/lib/db/schema/connections'
import type { MetaConnection, MetaAdAccount, NewMetaAdAccount } from '@/lib/db/schema'

export async function getActiveConnectionByWorkspace(
  workspaceId: string
): Promise<MetaConnection | null> {
  const row = await db.query.metaConnections.findFirst({
    where: and(eq(metaConnections.workspaceId, workspaceId), isNull(metaConnections.deletedAt)),
  })
  return row ?? null
}

export async function getConnectionWithAdAccounts(workspaceId: string): Promise<{
  connection: MetaConnection
  adAccounts: MetaAdAccount[]
} | null> {
  const connection = await getActiveConnectionByWorkspace(workspaceId)
  if (!connection) return null

  const adAccounts = await db.query.metaAdAccounts.findMany({
    where: and(eq(metaAdAccounts.connectionId, connection.id), isNull(metaAdAccounts.deletedAt)),
  })

  return { connection, adAccounts }
}

export interface UpsertConnectionInput {
  workspaceId: string
  encryptedAccessToken: string
  tokenExpiresAt: Date | null
  encryptionKeyVersion: string
  metaUserId: string | null
  metaUserName: string | null
  metaUserEmail: string | null
  grantedScopes: string[]
  pixelId: string | null
  businessId: string | null
  businessVerificationStatus: string
  verifiedDomains: { domain: string; verified: boolean }[]
}

/**
 * Cria ou atualiza a meta_connection do workspace. Como temos UNIQUE
 * em workspace_id, ON CONFLICT atualiza tudo (re-conexao = re-encrypt).
 */
export async function upsertConnection(input: UpsertConnectionInput): Promise<MetaConnection> {
  const [row] = await db
    .insert(metaConnections)
    .values({
      workspaceId: input.workspaceId,
      encryptedAccessToken: input.encryptedAccessToken,
      tokenExpiresAt: input.tokenExpiresAt,
      encryptionKeyVersion: input.encryptionKeyVersion,
      metaUserId: input.metaUserId,
      metaUserName: input.metaUserName,
      metaUserEmail: input.metaUserEmail,
      grantedScopes: input.grantedScopes,
      pixelId: input.pixelId,
      businessId: input.businessId,
      businessVerificationStatus: input.businessVerificationStatus,
      verifiedDomains: input.verifiedDomains,
      status: 'active',
      lastTokenRefreshAt: new Date(),
      tokenRefreshFailures: 0,
    })
    .onConflictDoUpdate({
      target: metaConnections.workspaceId,
      set: {
        encryptedAccessToken: input.encryptedAccessToken,
        tokenExpiresAt: input.tokenExpiresAt,
        encryptionKeyVersion: input.encryptionKeyVersion,
        metaUserId: input.metaUserId,
        metaUserName: input.metaUserName,
        metaUserEmail: input.metaUserEmail,
        grantedScopes: input.grantedScopes,
        pixelId: input.pixelId,
        businessId: input.businessId,
        businessVerificationStatus: input.businessVerificationStatus,
        verifiedDomains: input.verifiedDomains,
        status: 'active',
        deletedAt: null,
        lastTokenRefreshAt: new Date(),
        tokenRefreshFailures: 0,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) {
    throw new Error('upsertConnection nao retornou row')
  }
  return row
}

export async function softDeleteConnection(workspaceId: string): Promise<void> {
  await db
    .update(metaConnections)
    .set({ status: 'disconnected', deletedAt: new Date() })
    .where(eq(metaConnections.workspaceId, workspaceId))
}

export async function markConnectionExpired(connectionId: string): Promise<void> {
  await db
    .update(metaConnections)
    .set({ status: 'expired' })
    .where(eq(metaConnections.id, connectionId))
}

// ============================================================
// Ad accounts
// ============================================================

export async function replaceAdAccounts(input: {
  connectionId: string
  accounts: Array<Omit<NewMetaAdAccount, 'connectionId' | 'id' | 'createdAt' | 'updatedAt'>>
  defaultAdAccountId?: string
}): Promise<MetaAdAccount[]> {
  return db.transaction(async (tx) => {
    // Soft delete dos antigos (mantem historico)
    await tx
      .update(metaAdAccounts)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(metaAdAccounts.connectionId, input.connectionId), isNull(metaAdAccounts.deletedAt))
      )

    if (input.accounts.length === 0) return []

    const inserted = await tx
      .insert(metaAdAccounts)
      .values(
        input.accounts.map((a) => ({
          ...a,
          connectionId: input.connectionId,
          isDefault: input.defaultAdAccountId ? a.adAccountId === input.defaultAdAccountId : false,
        }))
      )
      .onConflictDoUpdate({
        target: [metaAdAccounts.connectionId, metaAdAccounts.adAccountId],
        set: {
          adAccountName: input.accounts[0]?.adAccountName ?? null,
          deletedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning()

    // Garante exatamente 1 default
    if (input.defaultAdAccountId) {
      await tx
        .update(metaAdAccounts)
        .set({ isDefault: false })
        .where(
          and(eq(metaAdAccounts.connectionId, input.connectionId), isNull(metaAdAccounts.deletedAt))
        )
      await tx
        .update(metaAdAccounts)
        .set({ isDefault: true })
        .where(
          and(
            eq(metaAdAccounts.connectionId, input.connectionId),
            eq(metaAdAccounts.adAccountId, input.defaultAdAccountId)
          )
        )
    } else if (inserted.length > 0 && inserted[0]) {
      // Se nao especificou, primeira vira default
      await tx
        .update(metaAdAccounts)
        .set({ isDefault: true })
        .where(eq(metaAdAccounts.id, inserted[0].id))
    }

    return inserted
  })
}

export async function listAdAccountsByConnection(connectionId: string): Promise<MetaAdAccount[]> {
  return db.query.metaAdAccounts.findMany({
    where: and(eq(metaAdAccounts.connectionId, connectionId), isNull(metaAdAccounts.deletedAt)),
  })
}

/**
 * Lista todas as conexoes ativas (status='active', deleted_at IS NULL).
 * Usado pelos cron tasks (sync-campaigns, meta-token-refresh).
 */
export async function listAllActiveConnections(): Promise<MetaConnection[]> {
  return db.query.metaConnections.findMany({
    where: and(eq(metaConnections.status, 'active'), isNull(metaConnections.deletedAt)),
  })
}

/**
 * Lista conexoes user-token com expiracao proxima (< 7d) para refresh job.
 * System User tokens nao expiram — exclui via filter.
 */
export async function listConnectionsNeedingRefresh(thresholdDays = 7): Promise<MetaConnection[]> {
  const threshold = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000)
  // Audit 2026-05-20: Drizzle `sql\`${col} < ${date}\`` serializa Date com
  // toString() (formato JS "Wed May 27 2026 GMT+0000"), nao ISO. Postgres
  // pooler rejeita parse, retorna erro generico que drizzle wrappa em
  // "Failed query". Causou meta-token-refresh-cron failures de 18-20/05.
  // Usar operador `lt` deixa drizzle serializar via column type (timestamptz).
  return db.query.metaConnections.findMany({
    where: and(
      eq(metaConnections.status, 'active'),
      isNull(metaConnections.deletedAt),
      eq(metaConnections.isSystemUserToken, false),
      lt(metaConnections.tokenExpiresAt, threshold)
    ),
  })
}

export async function markConnectionSynced(connectionId: string): Promise<void> {
  await db
    .update(metaConnections)
    .set({ lastSyncAt: new Date() })
    .where(eq(metaConnections.id, connectionId))
}
