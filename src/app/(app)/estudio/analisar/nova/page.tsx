import { redirect } from 'next/navigation'

import { resolveCurrentWorkspaceId } from '@/lib/auth/workspace'
import { getBalanceForWorkspace } from '@/lib/db/queries/credits'
import { listAdAccountsByWorkspace } from '@/lib/db/queries/meta-connections'
import { getPipelineCost } from '@/lib/db/queries/pipeline-costs'

import { NovaAnaliseForm, type AdAccountOption } from './NovaAnaliseForm'

const PIPELINE_ID = 'analisar.video_ad'

export const revalidate = 0

export default async function EstudioAnalisarNovaPage() {
  const workspaceId = await resolveCurrentWorkspaceId()
  if (!workspaceId) redirect('/login')

  const [adAccountRows, balanceRow, cost] = await Promise.all([
    listAdAccountsByWorkspace(workspaceId),
    getBalanceForWorkspace(workspaceId),
    getPipelineCost(PIPELINE_ID),
  ])

  // value = provider ad_account_id (filtro de listCampaignsWithMetrics); label = nome da conta.
  const adAccounts: AdAccountOption[] = adAccountRows.map((a) => ({
    id: a.adAccountId,
    name: a.adAccountName?.trim() || a.adAccountId,
  }))

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">
          Nova análise
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Analise um criativo de campanha conectada com IA. O diagnóstico usa as métricas reais do
          funil (Meta + gateway).
        </p>
      </header>

      <NovaAnaliseForm
        adAccounts={adAccounts}
        balance={balanceRow?.balance ?? 0}
        cost={cost ?? 1}
      />
    </main>
  )
}
