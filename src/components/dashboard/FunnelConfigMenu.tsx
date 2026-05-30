'use client'

import { Check, Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  ALL_FUNNEL_STAGES,
  FUNNEL_PRESETS,
  type FunnelPresetId,
  type FunnelStageKey,
} from '@/lib/dashboard/funnel-presets'

/**
 * Menu de configuração do funil (PR-13a).
 *
 * Aberto via gear icon no header do widget. Permite:
 *  - Trocar preset (VSL / Webinar / Lead magnet / WhatsApp / Trial / Custom)
 *  - Toggle individual por etapa (visível só em preset Custom OU explícito)
 *
 * Estado controlado pelo parent (FunnelPyramid). Persistência em localStorage
 * por agora — PR-13c migra pra dashboard_layouts.
 */

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  impressions: 'Impressões',
  clicks: 'Cliques',
  pageViews: 'Page Views',
  leads: 'Leads',
  initiateCheckout: 'Início de checkout',
  purchasesApproved: 'Compras aprovadas',
  paymentConfirmed: 'Pagamento confirmado',
  activeSubscriptions: 'Assinaturas ativas',
}

interface FunnelConfigMenuProps {
  presetId: FunnelPresetId
  onPresetChange: (id: FunnelPresetId) => void
  visibleStages: ReadonlySet<FunnelStageKey>
  onStagesChange: (next: Set<FunnelStageKey>) => void
}

export function FunnelConfigMenu({
  presetId,
  onPresetChange,
  visibleStages,
  onStagesChange,
}: FunnelConfigMenuProps) {
  const toggleStage = (stage: FunnelStageKey) => {
    const next = new Set(visibleStages)
    if (next.has(stage)) {
      next.delete(stage)
    } else {
      next.add(stage)
    }
    // Trocar pra custom automaticamente quando user mexe individual.
    onPresetChange('custom')
    onStagesChange(next)
  }

  return (
    <details className="group relative">
      <summary
        className={cn(
          'inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] [&::-webkit-details-marker]:hidden',
          'group-open:border-[var(--color-accent)] group-open:text-[var(--color-accent)]'
        )}
      >
        <Settings2 className="h-3 w-3" />
        Configurar
      </summary>
      <div className="absolute top-full right-0 z-30 mt-1 w-[300px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-lg">
        <div className="mb-3">
          <span className="text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
            Tipo de funil
          </span>
          <ul className="mt-1.5 space-y-0.5">
            {FUNNEL_PRESETS.map((preset) => {
              const active = preset.id === presetId
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPresetChange(preset.id)
                      onStagesChange(new Set(preset.stages))
                    }}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                      active
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                        : 'text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {active && <Check className="h-3 w-3" />}
                      <span className="font-medium">{preset.name}</span>
                    </div>
                    <span className="text-[10px] text-[var(--color-fg-muted)]">
                      {preset.description}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-[var(--color-border)] pt-2">
          <span className="text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
            Etapas visíveis
          </span>
          <ul className="mt-1.5 space-y-0.5">
            {ALL_FUNNEL_STAGES.map((stage) => (
              <li key={stage}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-[var(--color-bg-subtle)]">
                  <input
                    type="checkbox"
                    checked={visibleStages.has(stage)}
                    onChange={() => toggleStage(stage)}
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                  <span
                    className={cn(
                      visibleStages.has(stage)
                        ? 'text-[var(--color-fg)]'
                        : 'text-[var(--color-fg-subtle)] line-through'
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}
