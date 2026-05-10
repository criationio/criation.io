import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Check, ChevronRight, Clock } from 'lucide-react'

import { db } from '@/lib/db'
import { listActiveConnections } from '@/lib/db/queries/connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

interface ProviderEntry {
  id: 'hotmart' | 'kiwify' | 'eduzz' | 'monetizze' | 'ticto' | 'generic'
  name: string
  description: string
  status: 'available' | 'soon'
}

const PROVIDERS: ProviderEntry[] = [
  {
    id: 'hotmart',
    name: 'Hotmart',
    description: 'Postback v2 + REST API. Vendas, assinaturas e renovações.',
    status: 'available',
  },
  {
    id: 'kiwify',
    name: 'Kiwify',
    description: 'Webhook v1. Vendas, refunds, chargebacks, assinaturas e renovações.',
    status: 'available',
  },
  {
    id: 'eduzz',
    name: 'Eduzz',
    description: 'Webhook v3 com HMAC-SHA256. Faturas, contratos, comissões.',
    status: 'available',
  },
  {
    id: 'generic',
    name: 'Outras plataformas (via n8n / Make / Zapier)',
    description:
      'Monetizze, Ticto, Cakto, Greenn, Yampi, Perfect Pay, Braip e outras. Conecte via flow Make/n8n.',
    status: 'available',
  },
]

export default async function GatewaysPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const m = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = m?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  const connections = await listActiveConnections()
  const connected = new Set(
    connections.filter((c) => c.workspaceId === workspaceId).map((c) => c.provider)
  )

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Gateways de pagamento</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Conecte plataformas de venda para que os webhooks alimentem seu dashboard de receita,
          créditos e atribuição automaticamente.
        </p>
      </header>

      <div className="grid gap-3">
        {PROVIDERS.map((p) => {
          const isConnected = connected.has(p.id)
          const isAvailable = p.status === 'available'

          if (!isAvailable) {
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 opacity-60"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-fg)]">{p.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-subtle)]">
                      <Clock className="h-2.5 w-2.5" />
                      Em breve
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-fg-muted)]">{p.description}</p>
                </div>
              </div>
            )
          }

          return (
            <Link
              key={p.id}
              href={`/configuracoes/gateways/${p.id}`}
              className="flex cursor-pointer items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-hover)]"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-fg)]">{p.name}</span>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                      <Check className="h-2.5 w-2.5" />
                      Conectado
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-fg-muted)]">{p.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--color-fg-subtle)]" />
            </Link>
          )
        })}
      </div>
    </main>
  )
}
