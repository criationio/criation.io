import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { ConnectionsHub } from '@/components/connections/ConnectionsHub'
import { deriveConnectionHealth } from '@/components/gateways/connection-health'
import type { ConnectionDescriptor } from '@/components/connections/types'
import { db } from '@/lib/db'
import { listActiveConnections } from '@/lib/db/queries/connections'
import { getConnectionWithAdAccounts } from '@/lib/db/queries/meta-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'
import { env } from '@/env'

const GATEWAY_PROVIDERS = [
  { id: 'hotmart' as const, name: 'Hotmart' },
  { id: 'kiwify' as const, name: 'Kiwify' },
  { id: 'eduzz' as const, name: 'Eduzz' },
  { id: 'generic' as const, name: 'Outras plataformas (Make/n8n)' },
]

export default async function ConexoesPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  const meta = await getConnectionWithAdAccounts(workspaceId)
  const myConnections = await listActiveConnections({ workspaceId })

  const adsItems: ConnectionDescriptor[] = [buildMetaDescriptor(meta), buildGoogleDescriptor()]

  const gatewayItems: ConnectionDescriptor[] = GATEWAY_PROVIDERS.map((p) => {
    const conn = myConnections.find((c) => c.type === 'gateway' && c.provider === p.id) ?? null
    return buildGatewayDescriptor(p.id, p.name, conn)
  })

  const othersItems: ConnectionDescriptor[] = [
    {
      key: 'others-placeholder',
      kind: 'others',
      brand: 'others',
      name: 'CRM, Email, Analytics…',
      shortLabel: 'Em breve',
      status: 'unset',
      subtitle: 'HubSpot, RD Station, Mailchimp, PostHog…',
      details: { kind: 'others', payload: null },
    },
  ]

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conexões</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Hub central de integrações. Plataformas de anúncios, gateways de pagamento e (em breve)
          CRM, email marketing, analytics. Clique em qualquer card para ver detalhes.
        </p>
      </header>

      <ConnectionsHub
        groups={[
          { id: 'ads', label: 'Plataformas de anúncios', items: adsItems },
          { id: 'gateways', label: 'Gateways de pagamento', items: gatewayItems },
          { id: 'others', label: 'Outras integrações', items: othersItems },
        ]}
      />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Builders — Server Component lê banco e empacota em descriptors serializaveis

function buildMetaDescriptor(
  meta: Awaited<ReturnType<typeof getConnectionWithAdAccounts>>
): ConnectionDescriptor {
  if (!meta) {
    return {
      key: 'meta',
      kind: 'meta',
      brand: 'meta',
      name: 'Meta Ads',
      shortLabel: 'Meta',
      status: 'unset',
      subtitle: 'Facebook + Instagram Ads',
      connectHref: '/bem-vindo/meta?returnTo=/configuracoes/conexoes',
    }
  }
  const c = meta.connection
  const ads = meta.adAccounts
  const verifiedDomains = Array.isArray(c.verifiedDomains)
    ? (c.verifiedDomains as { domain: string; verified: boolean }[])
    : []
  const grantedScopes = Array.isArray(c.grantedScopes) ? (c.grantedScopes as string[]) : []
  const tokenExpiresInDays = c.tokenExpiresAt
    ? Math.max(0, Math.ceil((new Date(c.tokenExpiresAt).getTime() - Date.now()) / 86_400_000))
    : null
  const defaultAd = ads.find((a) => a.isDefault) ?? ads[0] ?? null

  const status: ConnectionDescriptor['status'] =
    c.status === 'active' ? 'active' : c.status === 'expired' ? 'expired' : 'disconnected'

  return {
    key: 'meta',
    kind: 'meta',
    brand: 'meta',
    name: 'Meta Ads',
    shortLabel: 'Meta',
    status,
    subtitle: c.metaUserName ?? c.metaUserEmail ?? `${ads.length} contas de anúncio`,
    manageHref: '/bem-vindo/meta?returnTo=/configuracoes/conexoes',
    details: {
      kind: 'meta',
      payload: {
        metaUserName: c.metaUserName,
        metaUserEmail: c.metaUserEmail,
        isSystemUserToken: c.isSystemUserToken,
        tokenExpiresInDays,
        marketingApiVersion: c.marketingApiVersion,
        pixelId: c.pixelId,
        businessVerificationStatus: c.businessVerificationStatus,
        verifiedDomainsCount: verifiedDomains.filter((d) => d.verified).length,
        totalDomainsCount: verifiedDomains.length,
        scopesCount: grantedScopes.length,
        adAccountsCount: ads.length,
        defaultAdAccountId: defaultAd?.adAccountId ?? null,
      },
    },
  }
}

function buildGoogleDescriptor(): ConnectionDescriptor {
  return {
    key: 'google',
    kind: 'google',
    brand: 'google',
    name: 'Google Ads',
    shortLabel: 'Google',
    status: 'unset',
    subtitle: 'Em breve (Sessão 2.10)',
    details: { kind: 'google', payload: null },
  }
}

type GatewayConn = NonNullable<Awaited<ReturnType<typeof listActiveConnections>>[number]>

function buildGatewayDescriptor(
  provider: 'hotmart' | 'kiwify' | 'eduzz' | 'generic',
  name: string,
  conn: GatewayConn | null
): ConnectionDescriptor {
  const baseKey = `gateway:${provider}`
  if (!conn) {
    return {
      key: baseKey,
      kind: 'gateway',
      brand: provider,
      name,
      shortLabel: name,
      status: 'unset',
      connectHref: `/configuracoes/gateways/${provider}/connect`,
      details: {
        kind: 'gateway',
        payload: {
          provider,
          webhookUrl: null,
          webhookVersion: null,
          lastWebhookEventAt: null,
          lastWebhookEventId: null,
          webhookFailures24h: 0,
          createdAt: new Date().toISOString(),
        },
      },
    }
  }

  const health = deriveConnectionHealth(conn)
  const status: ConnectionDescriptor['status'] =
    health === 'pending'
      ? 'pending'
      : health === 'failing'
        ? 'failing'
        : health === 'stale'
          ? 'stale'
          : 'active'

  const baseUrl = (env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const webhookUrl =
    provider === 'generic'
      ? `${baseUrl}/api/webhooks/generic/${conn.id}`
      : `${baseUrl}/api/webhooks/gateway/${provider}/${conn.id}`

  return {
    key: baseKey,
    kind: 'gateway',
    brand: provider,
    name,
    shortLabel: name,
    status,
    subtitle: conn.lastWebhookEventAt
      ? `Último evento: ${new Date(conn.lastWebhookEventAt).toLocaleDateString('pt-BR')}`
      : 'Aguardando 1º evento',
    manageHref: `/configuracoes/gateways/${provider}`,
    details: {
      kind: 'gateway',
      payload: {
        provider,
        webhookUrl,
        webhookVersion: conn.webhookVersion,
        lastWebhookEventAt: conn.lastWebhookEventAt ? conn.lastWebhookEventAt.toISOString() : null,
        lastWebhookEventId: conn.lastWebhookEventId,
        webhookFailures24h: conn.webhookFailures24h,
        createdAt: conn.createdAt.toISOString(),
      },
    },
  }
}
