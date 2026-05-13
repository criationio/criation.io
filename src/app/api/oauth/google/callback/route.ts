import { type NextRequest, NextResponse } from 'next/server'

import { env } from '@/env'
import { encrypt } from '@/lib/encryption'
import { authLogger } from '@/lib/logger'
import {
  replaceGoogleAdsAccounts,
  upsertGoogleConnection,
} from '@/lib/db/queries/google-connections'
import { consumeState } from '@/lib/services/oauth-state.service'
import { discoverAllMetadata } from '@/lib/services/google-ads-metadata.service'
import {
  exchangeCodeForToken,
  getUserInfo,
  GoogleApiError,
  parseGrantedScopes,
} from '@/lib/services/google.service'

/**
 * Callback handler do OAuth Google (1.4.9.B / ADR-015).
 *
 * Flow:
 *  1. Valida state (CSRF + extrai workspaceId + codeVerifier do Upstash, one-shot)
 *  2. Troca code por tokens (com codeVerifier PKCE)
 *  3. Captura identidade Google (sub + email + name) via /userinfo
 *  4. Parse granted scopes (datamanager / adwords / cloud-platform)
 *  5. Persiste google_connection (encrypt access + refresh)
 *  6. Redirect pra returnTo (wizard /configuracoes/google/conversoes)
 *
 * Step 4 da 1.4.9.B vai estender este handler pra buscar metadata
 * (listAccessibleCustomers + conversion_actions) e popular google_ads_accounts.
 */

function redirectTo(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const url = new URL(path, env.NEXT_PUBLIC_APP_URL ?? req.url)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return NextResponse.redirect(url)
}

function buildRedirectUri(req: NextRequest): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  return `${base.replace(/\/$/, '')}/api/oauth/google/callback`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateToken = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  // User cancelou ou Google rejeitou
  if (errorParam) {
    authLogger.info({ errorParam }, 'oauth google callback denied')
    return redirectTo(req, '/configuracoes/google/conversoes', {
      google_status: 'denied',
      reason: errorParam,
    })
  }

  if (!code || !stateToken) {
    return redirectTo(req, '/configuracoes/google/conversoes', {
      google_status: 'invalid',
      reason: 'missing_params',
    })
  }

  const state = await consumeState('google', stateToken)
  if (!state) {
    return redirectTo(req, '/configuracoes/google/conversoes', {
      google_status: 'invalid',
      reason: 'expired_state',
    })
  }

  if (!state.codeVerifier) {
    authLogger.error(
      { workspaceId: state.workspaceId },
      'oauth google: codeVerifier ausente no state'
    )
    return redirectTo(req, '/configuracoes/google/conversoes', {
      google_status: 'failed',
      reason: 'missing_verifier',
    })
  }

  try {
    // Step 1: code -> tokens
    const tokens = await exchangeCodeForToken({
      code,
      codeVerifier: state.codeVerifier,
      redirectUri: buildRedirectUri(req),
    })

    if (!tokens.refreshToken) {
      // Sem refresh_token = nao podera refresh quando access expirar (1h).
      // Quase sempre culpa de access_type/prompt — config nossa. Log + segue.
      authLogger.warn(
        { workspaceId: state.workspaceId },
        'oauth google: refresh_token ausente — proximo access expirado require re-OAuth'
      )
    }

    // Step 2: scopes granted
    const { scopes, flags } = parseGrantedScopes(tokens.scope)
    if (!flags.dataManager || !flags.adwords) {
      authLogger.warn(
        { workspaceId: state.workspaceId, flags },
        'oauth google: scopes essenciais nao concedidos — fanout vai falhar'
      )
    }

    // Step 3: identidade Google
    const userInfo = await getUserInfo(tokens.accessToken)

    // Step 4: persiste
    const expiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000)
    const encryptedAccess = encrypt(tokens.accessToken)
    const encryptedRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken) : null

    const connection = await upsertGoogleConnection({
      workspaceId: state.workspaceId,
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      encryptionKeyVersion: encryptedAccess.split(':')[0] ?? 'v1',
      googleUserId: userInfo.sub,
      googleUserEmail: userInfo.email,
      googleUserName: userInfo.name,
      grantedScopes: scopes,
      grantedDataManagerScope: flags.dataManager,
      grantedAdsScope: flags.adwords,
    })

    authLogger.info(
      {
        workspaceId: state.workspaceId,
        connectionId: connection.id,
        scopes: scopes.length,
        hasRefresh: !!tokens.refreshToken,
      },
      'oauth google completed'
    )

    // Step 5: descoberta de metadata (customers + conversion actions).
    // Degradacao graceful — falhas viram log + wizard mostra "Atualizar" pra retry.
    let metadataPersisted = 0
    let metadataErrors = 0
    if (flags.adwords) {
      try {
        const metadata = await discoverAllMetadata({ accessToken: tokens.accessToken })
        metadataErrors = metadata.errors.length
        if (metadata.customers.length > 0) {
          // Persist em google_ads_accounts. Primeiro como default.
          await replaceGoogleAdsAccounts({
            connectionId: connection.id,
            accounts: metadata.customers.map((c, idx) => ({
              customerId: c.customerId,
              customerDescriptiveName: c.descriptiveName,
              managerCustomerId: c.managerCustomerId,
              loginCustomerId: c.managerCustomerId ?? c.customerId,
              currencyCode: c.currencyCode,
              timeZone: c.timeZone,
              status: c.status,
              isTestAccount: c.isTestAccount,
              isManager: c.isManager,
              isDefault: idx === 0,
              conversionActions: c.conversionActions,
              lastSyncAt: new Date(),
            })),
            ...(metadata.customers[0]?.customerId
              ? { defaultCustomerId: metadata.customers[0].customerId }
              : {}),
          })
          metadataPersisted = metadata.customers.length
        }
        authLogger.info(
          {
            workspaceId: state.workspaceId,
            connectionId: connection.id,
            customers: metadata.customers.length,
            managers: metadata.managers.length,
            errors: metadataErrors,
          },
          'google metadata discovery + persist completed'
        )
      } catch (err) {
        authLogger.warn(
          { workspaceId: state.workspaceId, err },
          'google metadata discovery falhou — wizard pode oferecer retry'
        )
      }
    } else {
      authLogger.warn(
        { workspaceId: state.workspaceId },
        'google metadata discovery skipped — auth/adwords scope nao concedido'
      )
    }

    return redirectTo(req, state.returnTo || '/configuracoes/google/conversoes', {
      google_status: 'connected',
      accounts: String(metadataPersisted),
      ...(metadataErrors > 0 ? { metadata_errors: String(metadataErrors) } : {}),
    })
  } catch (err) {
    if (err instanceof GoogleApiError) {
      authLogger.error(
        {
          status: err.status,
          errorCode: err.errorCode,
          errorDescription: err.errorDescription,
          message: err.message,
        },
        'oauth google callback falhou (Google API error)'
      )
      return redirectTo(req, '/configuracoes/google/conversoes', {
        google_status: 'failed',
        reason: `google:${err.errorCode ?? err.status ?? 'unknown'}`,
      })
    }
    authLogger.error({ err }, 'oauth google callback falhou (inesperado)')
    return redirectTo(req, '/configuracoes/google/conversoes', {
      google_status: 'failed',
      reason: 'internal',
    })
  }
}
