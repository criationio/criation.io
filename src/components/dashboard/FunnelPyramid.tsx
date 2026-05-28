'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, TrendingDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { FunnelData } from '@/lib/dashboard/mock-data'
import {
  FUNNEL_PRESETS,
  getPreset,
  type FunnelPresetId,
  type FunnelStageKey,
} from '@/lib/dashboard/funnel-presets'

import { FunnelConfigMenu } from './FunnelConfigMenu'

/**
 * Funil pirâmide configurável (PR-5 + PR-13a).
 *
 * Visual: pirâmide invertida com largura proporcional à POSIÇÃO (não ao
 * valor) — garante shape piramidal mesmo com magnitudes muito diferentes.
 * Drop-off entre etapas mostra taxa nomeada (CTR / Page Load / Lead Rate /
 * etc) com cor por severidade.
 *
 * Configuração: 5 presets (VSL direto / Webinar / Lead magnet / WhatsApp /
 * Trial SaaS) + Custom. Toggle por etapa via menu Configurar. Persistência
 * localStorage por workspace.
 */

interface FunnelStageDef {
  key: FunnelStageKey
  label: string
  hint: string
  rateLabel?: string
}

const STAGE_DEFS: Record<FunnelStageKey, FunnelStageDef> = {
  impressions: {
    key: 'impressions',
    label: 'Impressões',
    hint: 'Topo do funil — Meta + Google + Direct',
  },
  clicks: {
    key: 'clicks',
    label: 'Cliques',
    hint: 'Interesse — cliente clicou no ad',
    rateLabel: 'CTR',
  },
  pageViews: {
    key: 'pageViews',
    label: 'Page Views',
    hint: 'Landing page carregou (via tracking script)',
    rateLabel: 'Page Load',
  },
  leads: {
    key: 'leads',
    label: 'Leads',
    hint: 'Email capturado ou identificado',
    rateLabel: 'Lead Rate',
  },
  initiateCheckout: {
    key: 'initiateCheckout',
    label: 'Início de checkout',
    hint: 'Carrinho ou checkout iniciado',
    rateLabel: 'Checkout Rate',
  },
  purchasesApproved: {
    key: 'purchasesApproved',
    label: 'Compras aprovadas',
    hint: 'Gateway aprovou a transação',
    rateLabel: 'Aprovação',
  },
  paymentConfirmed: {
    key: 'paymentConfirmed',
    label: 'Pagamento confirmado',
    hint: 'PIX/cartão confirmado e não estornado',
    rateLabel: 'Confirmação',
  },
  activeSubscriptions: {
    key: 'activeSubscriptions',
    label: 'Assinaturas ativas',
    hint: 'Subscribers ativos (recorrência)',
    rateLabel: 'Retenção',
  },
}

const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR')
const COMPACT_FORMATTER = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function format(value: number): string {
  return value >= 10_000 ? COMPACT_FORMATTER.format(value) : NUMBER_FORMATTER.format(value)
}

const STORAGE_KEY_PRESET = 'criation_funnel_preset_v1'
const STORAGE_KEY_STAGES = 'criation_funnel_stages_v1'
const DEFAULT_PRESET: FunnelPresetId = 'vsl-direto'

interface FunnelConfig {
  presetId: FunnelPresetId
  visibleStages: Set<FunnelStageKey>
}

const FALLBACK_CONFIG: FunnelConfig = {
  presetId: DEFAULT_PRESET,
  visibleStages: new Set(getPreset(DEFAULT_PRESET).stages),
}

function loadFromLocalStorage(): FunnelConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const presetRaw = window.localStorage.getItem(STORAGE_KEY_PRESET)
    const stagesRaw = window.localStorage.getItem(STORAGE_KEY_STAGES)
    if (!presetRaw && !stagesRaw) return null // sem nada salvo, usa fallback
    const presetId = (presetRaw as FunnelPresetId | null) ?? DEFAULT_PRESET
    const validPreset = FUNNEL_PRESETS.find((p) => p.id === presetId)
    if (!validPreset) return null
    let stages: Set<FunnelStageKey>
    if (stagesRaw) {
      const parsed = JSON.parse(stagesRaw)
      stages = Array.isArray(parsed)
        ? new Set(parsed as FunnelStageKey[])
        : new Set(validPreset.stages)
    } else {
      stages = new Set(validPreset.stages)
    }
    return { presetId: validPreset.id, visibleStages: stages }
  } catch {
    return null
  }
}

interface FunnelPyramidProps {
  data: FunnelData
  isExample?: boolean
}

export function FunnelPyramid({ data, isExample = false }: FunnelPyramidProps) {
  const [activeStage, setActiveStage] = useState<FunnelStageKey | null>(null)
  // Server-safe: comecar com fallback. Hidratar localStorage depois de mount
  // pra evitar mismatch SSR/CSR. Pattern oficial pra client-only persistence —
  // setState-in-effect e o uso prescrito aqui.
  const [{ presetId, visibleStages }, setConfig] = useState<FunnelConfig>(FALLBACK_CONFIG)

  useEffect(() => {
    const stored = loadFromLocalStorage()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setConfig(stored)
  }, [])

  const setPreset = (id: FunnelPresetId) => {
    setConfig((prev) => ({ ...prev, presetId: id }))
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY_PRESET, id)
      } catch {
        // ignore
      }
    }
  }

  const setStages = (next: Set<FunnelStageKey>) => {
    setConfig((prev) => ({ ...prev, visibleStages: next }))
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY_STAGES, JSON.stringify([...next]))
      } catch {
        // ignore
      }
    }
  }

  const rows = useMemo(() => {
    // Filtra apenas etapas visíveis preservando a ordem canônica
    const orderedKeys = Object.keys(STAGE_DEFS) as FunnelStageKey[]
    const activeStages = orderedKeys.filter((k) => visibleStages.has(k))

    // Pirâmide invertida: largura proporcional à POSIÇÃO. Top=100%, base=20%.
    const TOP_WIDTH = 100
    const BOTTOM_WIDTH = 20
    const stepCount = Math.max(1, activeStages.length - 1)

    return activeStages.map((key, idx) => {
      const stage = STAGE_DEFS[key]
      const value = (data[key] as number) ?? 0
      // dropRate é relativo ao stage VISÍVEL anterior (não o canonical),
      // porque escondemos etapas (ex: sem Leads, dropRate de Checkout
      // vem direto de Page Views).
      const prevKey = idx === 0 ? null : activeStages[idx - 1]
      const prevValue = prevKey ? ((data[prevKey] as number) ?? 0) : null
      const dropRate = prevValue && prevValue > 0 ? value / prevValue : null
      const widthPercent = TOP_WIDTH - ((TOP_WIDTH - BOTTOM_WIDTH) / stepCount) * idx
      return { ...stage, value, dropRate, widthPercent, idx }
    })
  }, [data, visibleStages])

  return (
    <section
      aria-label="Funil de conversão"
      className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6"
    >
      {isExample && (
        <span className="absolute top-4 right-4 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Funil de conversão</h2>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            {getPreset(presetId).description}
          </p>
        </div>
        <FunnelConfigMenu
          presetId={presetId}
          onPresetChange={setPreset}
          visibleStages={visibleStages}
          onStagesChange={setStages}
        />
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
          Nenhuma etapa selecionada. Abra <strong>Configurar</strong> e marque ao menos uma.
        </div>
      ) : rows.every((r) => r.value === 0) ? (
        <div className="space-y-2 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Nenhum evento de funil no período
          </p>
          <p className="text-xs text-[var(--color-fg-muted)]">
            Conecte Meta Ads + gateway de vendas pra começar a registrar impressões → cliques →
            compras.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          {rows.map((row, idx) => (
            <div key={row.key} className="flex w-full flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveStage((curr) => (curr === row.key ? null : row.key))}
                className={cn(
                  'group relative flex items-center justify-between gap-3 rounded-[var(--radius-md)] border bg-gradient-to-r px-4 py-2.5 text-left transition-all',
                  'border-[var(--color-accent-subtle)] from-[var(--color-accent-subtle)] to-[var(--color-accent-muted)]',
                  'hover:border-[var(--color-accent)] hover:from-[var(--color-accent-muted)] hover:to-[var(--color-accent-subtle)]',
                  activeStage === row.key &&
                    'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
                )}
                style={{ width: `${row.widthPercent}%`, minWidth: '160px' }}
                aria-expanded={activeStage === row.key}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[11px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                    {row.label}
                  </span>
                  <span className="font-tabular text-base font-semibold text-[var(--color-fg)]">
                    {format(row.value)}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-[var(--color-fg-subtle)] transition-transform',
                    activeStage === row.key && 'rotate-180 text-[var(--color-accent)]'
                  )}
                />
              </button>

              {idx < rows.length - 1 && (
                <DropoffPill
                  rate={rows[idx + 1]!.dropRate ?? 0}
                  {...(rows[idx + 1]!.rateLabel ? { label: rows[idx + 1]!.rateLabel } : {})}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {activeStage && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-xs text-[var(--color-fg-muted)]">
          <p>
            <strong className="text-[var(--color-fg)]">{STAGE_DEFS[activeStage].label}</strong> —{' '}
            {STAGE_DEFS[activeStage].hint}
          </p>
          <p className="mt-2 text-[var(--color-fg-subtle)]">
            Breakdown por campanha + alertas vêm no próximo commit (side-panel).
          </p>
        </div>
      )}
    </section>
  )
}

function DropoffPill({ rate, label }: { rate: number; label?: string }) {
  const isCritical = rate < 0.2
  const isWarn = rate >= 0.2 && rate < 0.5
  const tone = isCritical
    ? 'text-[var(--color-danger)]'
    : isWarn
      ? 'text-[var(--color-warning)]'
      : 'text-[var(--color-fg-muted)]'
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wide',
        tone
      )}
    >
      <TrendingDown className="h-2.5 w-2.5" />
      {label && (
        <span className="tracking-wider text-[var(--color-fg-muted)] uppercase">{label}</span>
      )}
      <span className="font-tabular">{(rate * 100).toFixed(rate < 0.1 ? 2 : 1)}%</span>
    </div>
  )
}
