import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import {
  getCampaignAdSetsWithAds,
  getCampaignCreatives,
  getCampaignDailySeries,
  getCampaignHeader,
  getCampaignKpis,
} from '@/lib/db/queries/campaign-detail'
import { presetToRange, previousRange } from '@/lib/dashboard/period-range'
import { getUser } from '@/lib/supabase/server'

import { CampaignDetailFiltersBar } from '@/components/campanhas/CampaignDetailFiltersBar'
import { CampaignKpiGrid } from '@/components/campanhas/CampaignKpiGrid'
import { CampaignTimeseriesChart } from '@/components/campanhas/CampaignTimeseriesChart'
import { AdSetsTreeTable } from '@/components/campanhas/AdSetsTreeTable'
import { CreativesGallery } from '@/components/campanhas/CreativesGallery'

interface SearchParams {
  period?: string
}

const STATUS_VARIANTS: Record<string, string> = {
  ACTIVE: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  PAUSED: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  DELETED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
  ARCHIVED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
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

  const { id: campaignId } = await params
  const { period: periodParam } = await searchParams
  const period = periodParam ?? 'last_30d'

  const current = presetToRange(period)
  const previous = previousRange(current)

  const header = await getCampaignHeader({ workspaceId, campaignId })
  if (!header) notFound()

  const [kpisCurrent, kpisPrevious, dailySeries, adSets, creatives] = await Promise.all([
    getCampaignKpis({ workspaceId, campaignId, start: current.start, end: current.end }),
    getCampaignKpis({ workspaceId, campaignId, start: previous.start, end: previous.end }),
    getCampaignDailySeries({ workspaceId, campaignId, start: current.start, end: current.end }),
    getCampaignAdSetsWithAds({ workspaceId, campaignId, start: current.start, end: current.end }),
    getCampaignCreatives({ workspaceId, campaignId, start: current.start, end: current.end }),
  ])

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <Link
        href="/campanhas"
        className="mb-4 inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar para campanhas
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{header.name}</h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_VARIANTS[header.status] ?? 'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]'}`}
            >
              {header.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            {header.provider === 'meta' ? 'Meta Ads' : header.provider}
            {header.objective ? ` · ${header.objective}` : ''}
            {header.dailyBudgetCents
              ? ` · Diário ${formatBRL(header.dailyBudgetCents)}`
              : header.lifetimeBudgetCents
                ? ` · Lifetime ${formatBRL(header.lifetimeBudgetCents)}`
                : ''}
          </p>
        </div>
        <CampaignDetailFiltersBar />
      </header>

      <CampaignKpiGrid current={kpisCurrent} previous={kpisPrevious} dailySeries={dailySeries} />

      <div className="mt-6">
        <CampaignTimeseriesChart data={dailySeries} />
      </div>

      <div className="mt-6">
        <AdSetsTreeTable adSets={adSets} />
      </div>

      <div className="mt-6">
        <CreativesGallery creatives={creatives} />
      </div>
    </main>
  )
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
