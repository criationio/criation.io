'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface PlanUsageData {
  planId: string
  /** Créditos consumidos no ciclo atual (creditsPerCycle - currentCycleCreditsRemaining). */
  used: number
  /** Créditos contratados por ciclo (0 quando trial-only). */
  total: number
  /** Saldo total combinado entre buckets — usado quando o ciclo não existe (trial). */
  balance: number
  daysUntilRenewal: number | null
  /** Breakdown por bucket para o tooltip. */
  buckets: {
    subscription: number
    pack: number
    signup: number
    admin: number
  }
  /** Mostrar CTA de upgrade. */
  showUpgrade: boolean
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Trial',
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

export function PlanUsageCard({ data }: { data: PlanUsageData }) {
  const planLabel = PLAN_LABELS[data.planId] ?? data.planId
  const isTrial = data.planId === 'free' || data.planId === 'trial' || data.total === 0

  const headline = isTrial
    ? `${data.balance} créditos disponíveis`
    : `${data.used} de ${data.total} créditos usados`

  const sub = isTrial
    ? data.daysUntilRenewal !== null
      ? `Trial — expira em ${data.daysUntilRenewal}d`
      : 'Trial'
    : data.daysUntilRenewal !== null
      ? `Renova em ${data.daysUntilRenewal}d`
      : 'Ciclo ativo'

  const pct = isTrial ? 0 : data.total > 0 ? Math.min(100, (data.used / data.total) * 100) : 0

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2.5"
            role="group"
            aria-label="Uso de créditos"
          >
            <div className="flex items-center justify-between text-[10px] font-medium text-[var(--color-fg-muted)]">
              <span className="text-label text-[10px]">{planLabel}</span>
              {data.showUpgrade && (
                <Link
                  href="/configuracoes/faturamento"
                  className="flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
                >
                  <Sparkles className="h-3 w-3" />
                  Upgrade
                </Link>
              )}
            </div>

            <div>
              <div className="text-xs font-medium text-[var(--color-fg)]" data-tabular>
                {headline}
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--color-fg-subtle)]">{sub}</div>
            </div>

            {!isTrial && (
              <div
                className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <div className="space-y-1 text-xs">
            <div className="font-medium">Saldo por origem</div>
            <BucketRow label="Assinatura" value={data.buckets.subscription} />
            <BucketRow label="Pack" value={data.buckets.pack} />
            <BucketRow label="Trial" value={data.buckets.signup} />
            {data.buckets.admin > 0 && <BucketRow label="Cortesia" value={data.buckets.admin} />}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function BucketRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3" data-tabular>
      <span className="text-[var(--color-fg-muted)]">{label}</span>
      <span>{value}</span>
    </div>
  )
}
