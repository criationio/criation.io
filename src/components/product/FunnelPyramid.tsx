'use client'

import type { BottleneckType } from './BottleneckBadge'
import { BottleneckBadge } from './BottleneckBadge'
import { Skeleton } from '@/components/ui/skeleton'

export interface FunnelStage {
  id: string
  label: string
  value: number
  conversionFromPrevious?: number
  bottleneckType?: BottleneckType
}

interface FunnelPyramidProps {
  stages: FunnelStage[]
  selectedStageId?: string
  onSelectStage?: (id: string) => void
  loading?: boolean
}

export function FunnelPyramid({
  stages,
  selectedStageId,
  onSelectStage,
  loading,
}: FunnelPyramidProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" style={{ width: `${100 - i * 10}%` }} />
        ))}
      </div>
    )
  }

  if (!stages || stages.length === 0) return null
  const maxValue = Math.max(...stages.map((s) => s.value))

  return (
    <div className="space-y-1.5">
      {stages.map((stage, i) => {
        const widthPercent = (stage.value / maxValue) * 100
        const isSelected = selectedStageId === stage.id
        const funnelVar = `var(--color-funnel-${i + 1})`

        return (
          <button
            key={stage.id}
            onClick={() => onSelectStage?.(stage.id)}
            className={`group flex w-full items-center gap-4 transition-all ${onSelectStage ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className={`relative flex h-12 items-center rounded-lg px-4 transition-all ${isSelected ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg)]' : ''}`}
              style={{
                width: `${widthPercent}%`,
                backgroundColor: funnelVar,
                minWidth: '180px',
              }}
            >
              <span className="truncate text-sm font-medium text-white">{stage.label}</span>
            </div>

            <div className="font-tabular flex-shrink-0 text-right">
              <div className="text-sm font-semibold text-[var(--color-fg)]">
                {stage.value.toLocaleString('pt-BR')}
              </div>
              {stage.conversionFromPrevious !== undefined && i > 0 && (
                <div className="text-xs text-[var(--color-fg-muted)]">
                  {stage.conversionFromPrevious.toFixed(1)}%
                </div>
              )}
            </div>

            {stage.bottleneckType && (
              <div className="flex-shrink-0">
                <BottleneckBadge type={stage.bottleneckType} size="sm" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
