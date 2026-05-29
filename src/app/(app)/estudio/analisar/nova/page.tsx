import { redirect } from 'next/navigation'

import { resolveCurrentWorkspaceId } from '@/lib/auth/workspace'
import { getBalanceForWorkspace } from '@/lib/db/queries/credits'
import { listCampaignsWithMetrics } from '@/lib/db/queries/campaigns'
import { getPipelineCost } from '@/lib/db/queries/pipeline-costs'
import { presetToRange } from '@/lib/dashboard/period-range'

import { NovaAnaliseForm, type CampaignOption } from './NovaAnaliseForm'

const PIPELINE_ID = 'analisar.video_ad'

export const revalidate = 0

export default async function EstudioAnalisarNovaPage() {
  const workspaceId = await resolveCurrentWorkspaceId()
  if (!workspaceId) redirect('/login')

  const { start, end } = presetToRange('last_30d')

  const [campaignsResult, balanceRow, cost] = await Promise.all([
    listCampaignsWithMetrics({ workspaceId, start, end, status: 'ACTIVE', limit: 500 }),
    getBalanceForWorkspace(workspaceId),
    getPipelineCost(PIPELINE_ID),
  ])

  const campaigns: CampaignOption[] = campaignsResult.rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
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

      <NovaAnaliseForm campaigns={campaigns} balance={balanceRow?.balance ?? 0} cost={cost ?? 1} />
    </main>
  )
}
