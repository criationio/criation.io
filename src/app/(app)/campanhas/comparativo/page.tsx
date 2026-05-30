import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import {
  getCampaignHeader,
  getCampaignKpis,
  listCampaignsForCompare,
} from '@/lib/db/queries/campaign-detail'
import { presetToRange } from '@/lib/dashboard/period-range'
import { getUser } from '@/lib/supabase/server'

import { ComparativoPickers } from '@/components/campanhas/ComparativoPickers'
import { ComparativoTable } from '@/components/campanhas/ComparativoTable'

interface SearchParams {
  a?: string
  b?: string
  period?: string
}

export default async function CampanhasComparativoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
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

  const { a: aId, b: bId, period: periodParam } = await searchParams
  const period = periodParam ?? 'last_30d'
  const range = presetToRange(period)

  const allCampaigns = await listCampaignsForCompare(workspaceId)

  const [aHeader, bHeader, aKpis, bKpis] = await Promise.all([
    aId ? getCampaignHeader({ workspaceId, campaignId: aId }) : Promise.resolve(null),
    bId ? getCampaignHeader({ workspaceId, campaignId: bId }) : Promise.resolve(null),
    aId
      ? getCampaignKpis({ workspaceId, campaignId: aId, start: range.start, end: range.end })
      : Promise.resolve(null),
    bId
      ? getCampaignKpis({ workspaceId, campaignId: bId, start: range.start, end: range.end })
      : Promise.resolve(null),
  ])

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Comparativo A×B</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Compare duas campanhas lado a lado no mesmo período.
        </p>
      </header>

      <ComparativoPickers
        campaigns={allCampaigns}
        selectedA={aId ?? ''}
        selectedB={bId ?? ''}
        period={period}
      />

      <div className="mt-6">
        {!aId || !bId ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Selecione duas campanhas acima pra ver o comparativo.
            </p>
          </div>
        ) : !aHeader || !bHeader || !aKpis || !bKpis ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Campanha não encontrada. Selecione novamente.
            </p>
          </div>
        ) : (
          <ComparativoTable
            a={{ header: aHeader, kpis: aKpis }}
            b={{ header: bHeader, kpis: bKpis }}
          />
        )}
      </div>
    </main>
  )
}
