import { type NextRequest, NextResponse } from 'next/server'

import { env } from '@/env'

import { encrypt } from '@/lib/encryption'
import { authLogger } from '@/lib/logger'
import { consumeState } from '@/lib/services/oauth-state.service'
import {
  exchangeCodeForToken,
  extendToLongLivedToken,
  getMe,
  listBusinesses,
  listMyAdAccounts,
  listOwnedAdAccounts,
  listOwnedDomains,
  listOwnedPixels,
  listPermissions,
  MetaApiError,
} from '@/lib/services/meta.service'
import { replaceAdAccounts, upsertConnection } from '@/lib/db/queries/meta-connections'

function redirectTo(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const url = new URL(path, env.NEXT_PUBLIC_APP_URL ?? req.url)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return NextResponse.redirect(url)
}

function buildRedirectUri(req: NextRequest): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  return `${base.replace(/\/$/, '')}/api/oauth/meta/callback`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateToken = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')
  const errorReason = url.searchParams.get('error_reason')
  const errorDescription = url.searchParams.get('error_description')

  // User cancelou ou Meta rejeitou
  if (errorParam) {
    authLogger.info({ errorParam, errorReason }, 'oauth meta callback denied')
    return redirectTo(req, '/bem-vindo/meta', {
      status: 'denied',
      reason: errorDescription ?? errorReason ?? errorParam,
    })
  }

  if (!code || !stateToken) {
    return redirectTo(req, '/bem-vindo/meta', { status: 'invalid', reason: 'missing_params' })
  }

  const state = await consumeState('meta', stateToken)
  if (!state) {
    return redirectTo(req, '/bem-vindo/meta', { status: 'invalid', reason: 'expired_state' })
  }

  try {
    // Step 1: code -> short-lived token
    const shortLived = await exchangeCodeForToken({
      code,
      redirectUri: buildRedirectUri(req),
    })

    // Step 2: short-lived -> long-lived (~60d)
    const longLived = await extendToLongLivedToken({
      shortLivedToken: shortLived.accessToken,
    })

    const expiresAt = longLived.expiresInSeconds
      ? new Date(Date.now() + longLived.expiresInSeconds * 1000)
      : null

    // Step 3-5: capturar identidade, permissions, businesses (em paralelo)
    const [me, permissions, businesses] = await Promise.all([
      getMe(longLived.accessToken),
      listPermissions(longLived.accessToken),
      listBusinesses(longLived.accessToken),
    ])

    const grantedScopes = permissions.filter((p) => p.status === 'granted').map((p) => p.permission)

    // Step 6: ad accounts e pixels — preferir do primeiro business; fallback /me/adaccounts
    const primaryBusiness = businesses[0]
    const businessId: string | null = primaryBusiness?.id ?? null
    let pixelId: string | null = null
    let businessVerificationStatus = 'not_started'
    let verifiedDomains: { domain: string; verified: boolean }[] = []

    if (primaryBusiness) {
      businessVerificationStatus = primaryBusiness.verificationStatus ?? 'not_started'
      // Endpoint dedicado a partir de v23+; chamada pode falhar se BM nao tem dominios
      verifiedDomains = await listOwnedDomains({
        accessToken: longLived.accessToken,
        businessId: primaryBusiness.id,
      }).catch((err) => {
        authLogger.warn(
          { err, businessId: primaryBusiness.id },
          'listOwnedDomains falhou; segue sem dominios'
        )
        return []
      })
    }

    // Agrega ad accounts de TODAS as fontes (multi-BM agencias):
    // 1. /me/adaccounts — tudo que user ve direto (cross-BM)
    // 2. /{business_id}/owned_ad_accounts pra cada BM — pega owned mesmo
    //    quando user nao tem role direto na ad account
    // Dedup por accountId.
    const myAccountsPromise = listMyAdAccounts(longLived.accessToken).catch((err) => {
      authLogger.warn({ err }, 'listMyAdAccounts falhou')
      return []
    })

    const ownedPromises = businesses.map((b) =>
      listOwnedAdAccounts({
        accessToken: longLived.accessToken,
        businessId: b.id,
      }).catch((err) => {
        authLogger.warn(
          { err, businessId: b.id },
          'listOwnedAdAccounts falhou para um BM; segue agregando'
        )
        return []
      })
    )

    const [myAccounts, ...ownedResults] = await Promise.all([myAccountsPromise, ...ownedPromises])
    const accountMap = new Map<string, (typeof myAccounts)[number]>()
    for (const list of [myAccounts, ...ownedResults]) {
      for (const a of list) accountMap.set(a.accountId, a)
    }
    const adAccounts = Array.from(accountMap.values())

    if (primaryBusiness) {
      const pixels = await listOwnedPixels({
        accessToken: longLived.accessToken,
        businessId: primaryBusiness.id,
      }).catch(() => [])
      pixelId = pixels[0]?.id ?? null
    }

    // Step 7: persistir connection (encrypt token)
    const encryptedToken = encrypt(longLived.accessToken)

    const connection = await upsertConnection({
      workspaceId: state.workspaceId,
      encryptedAccessToken: encryptedToken,
      tokenExpiresAt: expiresAt,
      encryptionKeyVersion: encryptedToken.split(':')[0] ?? 'v1',
      metaUserId: me.id,
      metaUserName: me.name,
      metaUserEmail: me.email,
      grantedScopes,
      pixelId,
      businessId,
      businessVerificationStatus,
      verifiedDomains,
    })

    // Step 8: persistir ad accounts (1:N)
    if (adAccounts.length === 0) {
      authLogger.warn(
        { workspaceId: state.workspaceId, connectionId: connection.id },
        'oauth meta sucesso porem nenhum ad account encontrado'
      )
      return redirectTo(req, state.returnTo, { meta_status: 'connected_no_accounts' })
    }

    if (adAccounts.length === 1) {
      const acc = adAccounts[0]!
      await replaceAdAccounts({
        connectionId: connection.id,
        accounts: [
          {
            adAccountId: acc.accountId,
            adAccountName: acc.name,
            businessId: acc.businessId,
            currency: acc.currency,
            timezoneName: acc.timezoneName,
            accountStatus: acc.accountStatus,
            isDefault: true,
          },
        ],
        defaultAdAccountId: acc.accountId,
      })
      authLogger.info({ workspaceId: state.workspaceId, accountCount: 1 }, 'oauth meta completed')
      return redirectTo(req, state.returnTo, { meta_status: 'connected' })
    }

    // Multiplos ad accounts: insere todos sem default e manda pro picker
    await replaceAdAccounts({
      connectionId: connection.id,
      accounts: adAccounts.map((a) => ({
        adAccountId: a.accountId,
        adAccountName: a.name,
        businessId: a.businessId,
        currency: a.currency,
        timezoneName: a.timezoneName,
        accountStatus: a.accountStatus,
        isDefault: false,
      })),
    })
    authLogger.info(
      { workspaceId: state.workspaceId, accountCount: adAccounts.length },
      'oauth meta completed; aguardando picker'
    )
    return redirectTo(req, '/bem-vindo/meta/escolher-conta', {
      returnTo: state.returnTo,
    })
  } catch (err) {
    if (err instanceof MetaApiError) {
      authLogger.error(
        { code: err.code, subcode: err.subcode, fbtraceId: err.fbtraceId, message: err.message },
        'oauth meta callback falhou (Meta API error)'
      )
      return redirectTo(req, '/bem-vindo/meta', {
        status: 'failed',
        reason: `meta:${err.code ?? 'unknown'}`,
      })
    }
    authLogger.error({ err }, 'oauth meta callback falhou (inesperado)')
    return redirectTo(req, '/bem-vindo/meta', { status: 'failed', reason: 'internal' })
  }
}
