import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { metaConnections } from '@/lib/db/schema/connections'
import type { MetaConnection } from '@/lib/db/schema'
import { decrypt, encrypt } from '@/lib/encryption'
import { authLogger } from '@/lib/logger'

import { extendToLongLivedToken, MetaApiError } from './meta.service'

const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias antes
const MAX_FAILURES = 3

export interface RefreshOutcome {
  refreshed: boolean
  reason: 'not_needed' | 'success' | 'no_expiry' | 'system_user_token' | 'failed' | 'expired'
  failureCount?: number
}

/**
 * Refresh do long-lived user token quando expira < 7d. System User
 * Tokens nao expiram — pula. Falhas consecutivas marcam connection
 * como `expired` apos MAX_FAILURES.
 */
export async function refreshIfNeeded(connection: MetaConnection): Promise<RefreshOutcome> {
  if (connection.isSystemUserToken) {
    return { refreshed: false, reason: 'system_user_token' }
  }

  if (!connection.tokenExpiresAt) {
    return { refreshed: false, reason: 'no_expiry' }
  }

  const msUntilExpiry = new Date(connection.tokenExpiresAt).getTime() - Date.now()
  if (msUntilExpiry > REFRESH_THRESHOLD_MS) {
    return { refreshed: false, reason: 'not_needed' }
  }

  let plaintext: string
  try {
    plaintext = decrypt(connection.encryptedAccessToken)
  } catch (err) {
    authLogger.error({ err, connectionId: connection.id }, 'token decrypt failed')
    await markFailure(connection)
    return { refreshed: false, reason: 'failed' }
  }

  try {
    const result = await extendToLongLivedToken({ shortLivedToken: plaintext })
    const newExpiresAt = result.expiresInSeconds
      ? new Date(Date.now() + result.expiresInSeconds * 1000)
      : null

    await db
      .update(metaConnections)
      .set({
        encryptedAccessToken: encrypt(result.accessToken),
        tokenExpiresAt: newExpiresAt,
        lastTokenRefreshAt: new Date(),
        tokenRefreshFailures: 0,
        status: 'active',
      })
      .where(eq(metaConnections.id, connection.id))

    return { refreshed: true, reason: 'success' }
  } catch (err) {
    if (err instanceof MetaApiError) {
      authLogger.warn(
        { code: err.code, subcode: err.subcode, connectionId: connection.id },
        'meta token refresh rejected by api'
      )
    } else {
      authLogger.error({ err, connectionId: connection.id }, 'meta token refresh failed')
    }
    const newFailureCount = await markFailure(connection)
    if (newFailureCount >= MAX_FAILURES) {
      await db
        .update(metaConnections)
        .set({ status: 'expired' })
        .where(eq(metaConnections.id, connection.id))
      return { refreshed: false, reason: 'expired', failureCount: newFailureCount }
    }
    return { refreshed: false, reason: 'failed', failureCount: newFailureCount }
  }
}

async function markFailure(connection: MetaConnection): Promise<number> {
  const newCount = connection.tokenRefreshFailures + 1
  await db
    .update(metaConnections)
    .set({ tokenRefreshFailures: newCount })
    .where(eq(metaConnections.id, connection.id))
  return newCount
}
