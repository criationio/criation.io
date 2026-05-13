import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  googleAdsAccounts,
  googleConnections,
  googleConversionActionMappings,
} from '@/lib/db/schema/connections'
import type {
  GoogleConnection,
  GoogleAdsAccount,
  GoogleConversionActionMapping,
  NewGoogleAdsAccount,
  NewGoogleConversionActionMapping,
} from '@/lib/db/schema'

export async function getActiveGoogleConnectionByWorkspace(
  workspaceId: string
): Promise<GoogleConnection | null> {
  const row = await db.query.googleConnections.findFirst({
    where: and(eq(googleConnections.workspaceId, workspaceId), isNull(googleConnections.deletedAt)),
  })
  return row ?? null
}

export interface UpsertGoogleConnectionInput {
  workspaceId: string
  encryptedAccessToken: string
  encryptedRefreshToken: string | null
  tokenExpiresAt: Date | null
  encryptionKeyVersion: string
  googleUserId: string | null
  googleUserEmail: string | null
  googleUserName: string | null
  grantedScopes: string[]
  grantedDataManagerScope: boolean
  grantedAdsScope: boolean
  managerCustomerId?: string | null
  loginCustomerIdHeader?: string | null
  adsApiVersion?: string
  dataManagerApiVersion?: string
}

/**
 * Cria ou atualiza a google_connection do workspace. UNIQUE em workspace_id
 * + ON CONFLICT DO UPDATE: re-conexao reescreve tokens + scopes + identidade.
 *
 * deletedAt e zerado (re-conectar reativa a connection mesmo se soft-deleted).
 */
export async function upsertGoogleConnection(
  input: UpsertGoogleConnectionInput
): Promise<GoogleConnection> {
  const [row] = await db
    .insert(googleConnections)
    .values({
      workspaceId: input.workspaceId,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      encryptionKeyVersion: input.encryptionKeyVersion,
      googleUserId: input.googleUserId,
      googleUserEmail: input.googleUserEmail,
      googleUserName: input.googleUserName,
      grantedScopes: input.grantedScopes,
      grantedDataManagerScope: input.grantedDataManagerScope,
      grantedAdsScope: input.grantedAdsScope,
      managerCustomerId: input.managerCustomerId ?? null,
      loginCustomerIdHeader: input.loginCustomerIdHeader ?? null,
      adsApiVersion: input.adsApiVersion ?? 'v24',
      dataManagerApiVersion: input.dataManagerApiVersion ?? 'v1',
      status: 'active',
      lastTokenRefreshAt: new Date(),
      tokenRefreshFailures: 0,
      refreshTokenInvalidatedAt: null,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: googleConnections.workspaceId,
      set: {
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        encryptionKeyVersion: input.encryptionKeyVersion,
        googleUserId: input.googleUserId,
        googleUserEmail: input.googleUserEmail,
        googleUserName: input.googleUserName,
        grantedScopes: input.grantedScopes,
        grantedDataManagerScope: input.grantedDataManagerScope,
        grantedAdsScope: input.grantedAdsScope,
        managerCustomerId: input.managerCustomerId ?? null,
        loginCustomerIdHeader: input.loginCustomerIdHeader ?? null,
        adsApiVersion: input.adsApiVersion ?? 'v24',
        dataManagerApiVersion: input.dataManagerApiVersion ?? 'v1',
        status: 'active',
        lastTokenRefreshAt: new Date(),
        tokenRefreshFailures: 0,
        refreshTokenInvalidatedAt: null,
        deletedAt: null,
      },
    })
    .returning()
  if (!row) throw new Error('upsertGoogleConnection: insert/update retornou vazio')
  return row
}

export async function softDeleteGoogleConnection(workspaceId: string): Promise<void> {
  await db
    .update(googleConnections)
    .set({ deletedAt: new Date(), status: 'disconnected' })
    .where(and(eq(googleConnections.workspaceId, workspaceId), isNull(googleConnections.deletedAt)))
}

// ---------------------------------------------------------------------------
// google_ads_accounts (1:N)
// ---------------------------------------------------------------------------

export async function listAdsAccountsByConnection(
  connectionId: string
): Promise<GoogleAdsAccount[]> {
  return db.query.googleAdsAccounts.findMany({
    where: and(
      eq(googleAdsAccounts.connectionId, connectionId),
      isNull(googleAdsAccounts.deletedAt)
    ),
  })
}

export interface ReplaceAdsAccountsInput {
  connectionId: string
  accounts: Omit<
    NewGoogleAdsAccount,
    'id' | 'connectionId' | 'createdAt' | 'updatedAt' | 'deletedAt'
  >[]
  defaultCustomerId?: string
}

/**
 * Soft-delete todas as accounts existentes do connection_id e re-insere
 * a lista nova. Preserva default selecionado se passado em defaultCustomerId.
 * Pattern espelha `replaceAdAccounts` do Meta.
 */
export async function replaceGoogleAdsAccounts(input: ReplaceAdsAccountsInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(googleAdsAccounts)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(googleAdsAccounts.connectionId, input.connectionId),
          isNull(googleAdsAccounts.deletedAt)
        )
      )
    if (input.accounts.length === 0) return
    await tx.insert(googleAdsAccounts).values(
      input.accounts.map((a) => ({
        ...a,
        connectionId: input.connectionId,
        isDefault: input.defaultCustomerId ? a.customerId === input.defaultCustomerId : a.isDefault,
      }))
    )
  })
}

// ---------------------------------------------------------------------------
// google_conversion_action_mappings
// ---------------------------------------------------------------------------

export async function listMappingsByWorkspace(
  workspaceId: string
): Promise<GoogleConversionActionMapping[]> {
  return db.query.googleConversionActionMappings.findMany({
    where: and(
      eq(googleConversionActionMappings.workspaceId, workspaceId),
      isNull(googleConversionActionMappings.deletedAt)
    ),
  })
}

export async function getMappingForEvent(
  workspaceId: string,
  internalEventName: string
): Promise<GoogleConversionActionMapping | null> {
  const row = await db.query.googleConversionActionMappings.findFirst({
    where: and(
      eq(googleConversionActionMappings.workspaceId, workspaceId),
      eq(googleConversionActionMappings.internalEventName, internalEventName),
      eq(googleConversionActionMappings.isEnabled, true),
      isNull(googleConversionActionMappings.deletedAt)
    ),
  })
  return row ?? null
}

export async function upsertMapping(
  input: NewGoogleConversionActionMapping
): Promise<GoogleConversionActionMapping> {
  const [row] = await db
    .insert(googleConversionActionMappings)
    .values(input)
    .onConflictDoUpdate({
      target: [
        googleConversionActionMappings.workspaceId,
        googleConversionActionMappings.googleAdsAccountId,
        googleConversionActionMappings.internalEventName,
      ],
      set: {
        productDestinationId: input.productDestinationId,
        conversionActionName: input.conversionActionName ?? null,
        conversionActionType: input.conversionActionType ?? null,
        isPrimary: input.isPrimary ?? false,
        isEnabled: input.isEnabled ?? true,
        deletedAt: null,
      },
    })
    .returning()
  if (!row) throw new Error('upsertMapping: insert/update retornou vazio')
  return row
}
