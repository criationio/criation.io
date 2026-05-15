import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { googleConnections, metaConnections } from '@/lib/db/schema/connections'
import type { GoogleConnection, MetaConnection } from '@/lib/db/schema'
import { decrypt, encrypt } from '@/lib/encryption'
import { authLogger } from '@/lib/logger'

import { GoogleApiError, refreshAccessToken } from './google.service'
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

// ---------------------------------------------------------------------------
// Google (1.4.9.B step 12 — ADR-015)
// ---------------------------------------------------------------------------

export interface GoogleRefreshOutcome {
  refreshed: boolean
  reason: 'success' | 'no_refresh_token' | 'invalid_grant' | 'failed' | 'expired' | 'decrypt_failed'
  failureCount?: number
}

/**
 * Refresh proativo do access_token Google + validacao do refresh_token. Diferente
 * do Meta, Google tokens funcionam assim:
 *
 *  - access_token: TTL 1h (refresh inline em google.service.ts cuida durante
 *    fanout). Cron NAO precisa cuidar disso.
 *  - refresh_token: nao expira por tempo, MAS pode virar invalid se:
 *    (a) user revogou o OAuth grant em myaccount.google.com
 *    (b) password change
 *    (c) refresh nao usado por 6 meses
 *    (d) admin Workspace revogou app
 *
 *  Cron diario chama essa funcao pra detectar invalid_grant cedo + notificar
 *  user (futuro TD). Sempre tenta refresh — se OK, atualiza access; se 400
 *  `invalid_grant`, incrementa failures. Apos MAX_FAILURES marca status=expired.
 */
export async function refreshGoogleAndValidate(
  connection: GoogleConnection
): Promise<GoogleRefreshOutcome> {
  if (!connection.encryptedRefreshToken) {
    return { refreshed: false, reason: 'no_refresh_token' }
  }

  let refreshTokenPlain: string
  try {
    refreshTokenPlain = decrypt(connection.encryptedRefreshToken)
  } catch (err) {
    authLogger.error({ err, connectionId: connection.id }, 'google refresh token decrypt failed')
    await markGoogleFailure(connection)
    return { refreshed: false, reason: 'decrypt_failed' }
  }

  try {
    const refreshed = await refreshAccessToken({ refreshToken: refreshTokenPlain })
    const newExpiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000)
    const newEncrypted = encrypt(refreshed.accessToken)

    await db
      .update(googleConnections)
      .set({
        encryptedAccessToken: newEncrypted,
        tokenExpiresAt: newExpiresAt,
        encryptionKeyVersion: newEncrypted.split(':')[0] ?? 'v1',
        lastTokenRefreshAt: new Date(),
        tokenRefreshFailures: 0,
        refreshTokenInvalidatedAt: null,
        status: 'active',
      })
      .where(eq(googleConnections.id, connection.id))

    return { refreshed: true, reason: 'success' }
  } catch (err) {
    // invalid_grant = refresh_token revogado/expirado/dormente. Bloqueio
    // permanente — user precisa re-conectar OAuth (sem retry vale a pena).
    const isInvalidGrant = err instanceof GoogleApiError && err.errorCode === 'invalid_grant'

    if (isInvalidGrant) {
      authLogger.warn(
        { connectionId: connection.id, workspaceId: connection.workspaceId },
        'google refresh_token invalid (revoked or stale) — marking expired'
      )
      await db
        .update(googleConnections)
        .set({
          status: 'expired',
          refreshTokenInvalidatedAt: new Date(),
          tokenRefreshFailures: connection.tokenRefreshFailures + 1,
        })
        .where(eq(googleConnections.id, connection.id))
      return {
        refreshed: false,
        reason: 'invalid_grant',
        failureCount: connection.tokenRefreshFailures + 1,
      }
    }

    if (err instanceof GoogleApiError) {
      authLogger.warn(
        {
          status: err.status,
          errorCode: err.errorCode,
          connectionId: connection.id,
        },
        'google token refresh rejected by api'
      )
    } else {
      authLogger.error({ err, connectionId: connection.id }, 'google token refresh failed')
    }

    const newCount = await markGoogleFailure(connection)
    if (newCount >= MAX_FAILURES) {
      await db
        .update(googleConnections)
        .set({ status: 'expired' })
        .where(eq(googleConnections.id, connection.id))
      return { refreshed: false, reason: 'expired', failureCount: newCount }
    }
    return { refreshed: false, reason: 'failed', failureCount: newCount }
  }
}

async function markGoogleFailure(connection: GoogleConnection): Promise<number> {
  const newCount = connection.tokenRefreshFailures + 1
  await db
    .update(googleConnections)
    .set({ tokenRefreshFailures: newCount })
    .where(eq(googleConnections.id, connection.id))
  return newCount
}
