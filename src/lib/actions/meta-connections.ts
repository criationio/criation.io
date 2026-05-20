'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import { metaAdAccounts, metaConnections } from '@/lib/db/schema/connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { decrypt } from '@/lib/encryption'
import { authLogger } from '@/lib/logger'
import {
  getActiveConnectionByWorkspace,
  replaceAdAccounts,
  softDeleteConnection,
} from '@/lib/db/queries/meta-connections'
import {
  listBusinesses,
  listMyAdAccounts,
  listOwnedAdAccounts,
  listOwnedDomains,
  listOwnedPixels,
  listPermissions,
  MetaApiError,
} from '@/lib/services/meta.service'
import { getUser } from '@/lib/supabase/server'

export type MetaActionResult =
  | { ok: true }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'TOKEN_EXPIRED' | 'INTERNAL'
        message: string
      }
    }

export type MetaSyncResult =
  | {
      ok: true
      updated: {
        adAccountsCount: number
        verifiedDomainsCount: number
        grantedScopesCount: number
        pixelId: string | null
      }
    }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'TOKEN_EXPIRED' | 'INTERNAL'
        message: string
      }
    }

async function getCurrentWorkspaceId(): Promise<string | null> {
  const user = await getUser()
  if (!user) return null
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (userRow?.defaultWorkspaceId) return userRow.defaultWorkspaceId
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  })
  return membership?.workspaceId ?? null
}

export async function setDefaultAdAccount(adAccountId: string): Promise<MetaActionResult> {
  return withCorrelatedAction(async () => {
    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
    }

    const connection = await db.query.metaConnections.findFirst({
      where: and(eq(metaConnections.workspaceId, workspaceId), isNull(metaConnections.deletedAt)),
    })
    if (!connection) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'conexao Meta nao encontrada' } }
    }

    const target = await db.query.metaAdAccounts.findFirst({
      where: and(
        eq(metaAdAccounts.connectionId, connection.id),
        eq(metaAdAccounts.adAccountId, adAccountId),
        isNull(metaAdAccounts.deletedAt)
      ),
    })
    if (!target) {
      return {
        ok: false,
        error: { code: 'INVALID', message: 'ad account nao encontrada nesta conexao' },
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(metaAdAccounts)
        .set({ isDefault: false })
        .where(eq(metaAdAccounts.connectionId, connection.id))
      await tx
        .update(metaAdAccounts)
        .set({ isDefault: true })
        .where(eq(metaAdAccounts.id, target.id))
    })

    authLogger.info({ workspaceId, adAccountId }, 'meta default ad account changed')
    revalidatePath('/configuracoes/conexoes')
    revalidatePath('/bem-vindo/meta/escolher-conta')
    return { ok: true }
  })
}

export async function disconnectMeta(): Promise<MetaActionResult> {
  return withCorrelatedAction(async () => {
    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
    }

    await softDeleteConnection(workspaceId)
    authLogger.info({ workspaceId }, 'meta connection disconnected')
    revalidatePath('/configuracoes/conexoes')
    return { ok: true }
  })
}

/**
 * Re-busca metadata da conexao (ad accounts, pixels, businesses,
 * dominios, permissions) usando o token JA EXISTENTE — sem re-OAuth.
 *
 * Use quando user adicionou nova ad account no Meta BM e quer que
 * Criation reflita. Mantem default selecionado se ainda existir.
 *
 * Erros de token expirado/revoked sao mapeados para TOKEN_EXPIRED — UI
 * mostra CTA "Reconectar".
 */
export async function syncMetaConnection(): Promise<MetaSyncResult> {
  return withCorrelatedAction(async () => {
    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
    }

    const connection = await getActiveConnectionByWorkspace(workspaceId)
    if (!connection) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'conexao Meta nao encontrada' } }
    }

    let accessToken: string
    try {
      accessToken = decrypt(connection.encryptedAccessToken)
    } catch (err) {
      authLogger.error({ err, connectionId: connection.id }, 'meta sync: decrypt failed')
      return { ok: false, error: { code: 'INTERNAL', message: 'falha ao ler token' } }
    }

    // Marca current default antes de re-buscar (pra preservar selecao)
    const existingAccounts = await db.query.metaAdAccounts.findMany({
      where: and(
        eq(metaAdAccounts.connectionId, connection.id),
        isNull(metaAdAccounts.deletedAt),
        eq(metaAdAccounts.isDefault, true)
      ),
    })
    const previousDefault = existingAccounts[0]?.adAccountId ?? null

    try {
      // Re-buscas em paralelo — o que dominar a chamada permanece
      const [businesses, permissions] = await Promise.all([
        listBusinesses(accessToken),
        listPermissions(accessToken),
      ])

      const primaryBusiness = businesses[0]
      const grantedScopes = permissions
        .filter((p) => p.status === 'granted')
        .map((p) => p.permission)

      let verifiedDomains: { domain: string; verified: boolean }[] = []
      let pixelId: string | null = null

      if (primaryBusiness) {
        const [domainsResult, pixelsResult] = await Promise.all([
          listOwnedDomains({ accessToken, businessId: primaryBusiness.id }).catch(() => []),
          listOwnedPixels({ accessToken, businessId: primaryBusiness.id }).catch(() => []),
        ])
        verifiedDomains = domainsResult
        pixelId = pixelsResult[0]?.id ?? null
      }

      let adAccounts = primaryBusiness
        ? await listOwnedAdAccounts({ accessToken, businessId: primaryBusiness.id }).catch(
            () => null
          )
        : null
      if (!adAccounts || adAccounts.length === 0) {
        adAccounts = await listMyAdAccounts(accessToken).catch(() => [])
      }

      // Atualiza connection metadata
      await db
        .update(metaConnections)
        .set({
          grantedScopes,
          pixelId,
          businessId: primaryBusiness?.id ?? connection.businessId,
          businessVerificationStatus: primaryBusiness?.verificationStatus ?? 'not_started',
          verifiedDomains,
          lastSyncAt: new Date(),
          marketingApiVersion: connection.marketingApiVersion, // mantem
        })
        .where(eq(metaConnections.id, connection.id))

      // Replace ad accounts. Preserva default se ainda existir, senao
      // pega o primeiro como default.
      const defaultStillExists = previousDefault
        ? adAccounts.some((a) => a.accountId === previousDefault)
        : false
      const newDefault = defaultStillExists
        ? previousDefault!
        : (adAccounts[0]?.accountId ?? undefined)

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
        ...(newDefault ? { defaultAdAccountId: newDefault } : {}),
      })

      authLogger.info(
        {
          workspaceId,
          adAccountsCount: adAccounts.length,
          verifiedDomainsCount: verifiedDomains.filter((d) => d.verified).length,
          grantedScopesCount: grantedScopes.length,
        },
        'meta sync completed'
      )

      revalidatePath('/configuracoes/conexoes')

      return {
        ok: true,
        updated: {
          adAccountsCount: adAccounts.length,
          verifiedDomainsCount: verifiedDomains.filter((d) => d.verified).length,
          grantedScopesCount: grantedScopes.length,
          pixelId,
        },
      }
    } catch (err) {
      if (err instanceof MetaApiError) {
        // Codigos OAuth de token invalidado (190 = invalid token, 102 = session expired)
        if (err.code === 190 || err.code === 102) {
          await db
            .update(metaConnections)
            .set({ status: 'expired' })
            .where(eq(metaConnections.id, connection.id))
          authLogger.warn(
            { code: err.code, connectionId: connection.id },
            'meta sync: token revoked/expired'
          )
          return {
            ok: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'token expirou ou foi revogado — reconecte pra continuar',
            },
          }
        }
        authLogger.error(
          { code: err.code, subcode: err.subcode, fbtraceId: err.fbtraceId, message: err.message },
          'meta sync failed (Meta API error)'
        )
        return {
          ok: false,
          error: { code: 'INVALID', message: `Meta retornou erro ${err.code ?? 'desconhecido'}` },
        }
      }
      authLogger.error({ err }, 'meta sync failed (inesperado)')
      return { ok: false, error: { code: 'INTERNAL', message: 'falha inesperada' } }
    }
  })
}
