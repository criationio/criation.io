import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { CheckCircle2 } from 'lucide-react'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getConnectionWithAdAccounts } from '@/lib/db/queries/meta-connections'
import { getUser } from '@/lib/supabase/server'

import { AccountPicker } from './account-picker'

interface PageProps {
  searchParams: Promise<{ returnTo?: string }>
}

export default async function EscolherContaPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const returnTo = sp.returnTo ?? '/configuracoes/conexoes'

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

  const data = await getConnectionWithAdAccounts(workspaceId)
  if (!data) redirect('/bem-vindo/meta')

  if (data.adAccounts.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nenhuma conta de anúncio encontrada
        </h1>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          Sua conexão foi salva, mas não conseguimos listar contas de anúncio do seu Business
          Manager. Verifique se você tem acesso a alguma conta no Meta.
        </p>
        <Link
          href="/bem-vindo/meta"
          className="mt-6 inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)]"
        >
          Tentar de novo
        </Link>
      </div>
    )
  }

  // Se já tem default, manda direto pro returnTo
  const hasDefault = data.adAccounts.some((a) => a.isDefault)
  if (hasDefault && data.adAccounts.length === 1) {
    redirect(returnTo)
  }

  const currentDefault = data.adAccounts.find((a) => a.isDefault)?.adAccountId ?? null

  return (
    <div>
      <span className="text-label text-[10px]">Passo 1 · seleção de conta</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Qual é a conta principal?</h1>
      <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
        Encontramos {data.adAccounts.length} contas de anúncio. Escolha qual será a principal — você
        pode trocar depois em Configurações. Todas ficam sincronizadas; a principal é só o default
        usado em sugestões e dashboards.
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm text-[var(--color-success)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Conexão Meta salva com sucesso · {data.adAccounts.length} contas detectadas
      </div>

      <AccountPicker
        adAccounts={data.adAccounts.map((a) => ({
          adAccountId: a.adAccountId,
          name: a.adAccountName,
          businessId: a.businessId,
          currency: a.currency,
          accountStatus: a.accountStatus,
        }))}
        initialDefault={currentDefault}
        returnTo={returnTo}
      />
    </div>
  )
}
