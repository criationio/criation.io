'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { BottleneckType } from './BottleneckBadge'
import { BottleneckBadge } from './BottleneckBadge'
import { Skeleton } from '@/components/ui/skeleton'

export interface FunnelStage {
  id: string
  label: string
  value: number
  format?: 'currency' | 'count' | 'default'
  conversionFromPrevious?: number
  delta?: number
  bottleneckType?: BottleneckType
  inlineMetric?: { label: string; value: string }
}

interface FunnelPyramidProps {
  stages: FunnelStage[]
  selectedStageId?: string
  onSelectStage?: (id: string) => void
  loading?: boolean
  bottleneckDiagnosis?: string
  onAnalyzeBottleneck?: () => void
}

function formatValue(value: number, format: FunnelStage['format']): string {
  if (format === 'currency') {
    return `R$ ${value.toLocaleString('pt-BR')}`
  }
  return value.toLocaleString('pt-BR')
}

function formatLost(value: number, format: FunnelStage['format']): string {
  const formatted = value.toLocaleString('pt-BR')
  if (format === 'currency') return `−R$ ${formatted}`
  return `−${formatted}`
}

export function FunnelPyramid({
  stages,
  selectedStageId,
  onSelectStage,
  loading,
  bottleneckDiagnosis,
  onAnalyzeBottleneck,
}: FunnelPyramidProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[52px] rounded-lg"
            style={{ width: `${100 - i * 9}%`, minWidth: '320px' }}
          />
        ))}
      </div>
    )
  }

  if (!stages || stages.length === 0) return null

  const maxValue = stages[0]!.value
  const bottleneckStage = stages.find((s) => s.bottleneckType)

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div
            className="mb-1.5 font-medium tracking-widest uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-fg-subtle)' }}
          >
            Funil de aquisição
          </div>
          <div className="text-md font-medium text-[var(--color-fg)]">{stages.length} etapas</div>
        </div>
      </div>

      <div className="flex flex-col">
        {stages.map((stage, i) => {
          const widthPercent = Math.max(19, (stage.value / maxValue) * 100)
          const isSelected = selectedStageId === stage.id
          const isBottleneck = !!stage.bottleneckType
          const previousValue = i > 0 ? stages[i - 1]!.value : null
          const lostUsers = previousValue !== null ? previousValue - stage.value : 0

          const isLightStage = i < 2
          const textColor = isLightStage ? '#2e1065' : '#ffffff'
          const subtextColor = isLightStage ? 'rgba(46, 16, 101, 0.65)' : 'rgba(255, 255, 255, 0.7)'
          const numberColor = isLightStage ? 'rgba(46, 16, 101, 0.5)' : 'rgba(255, 255, 255, 0.5)'

          const funnelColor = `var(--color-funnel-${i + 1})`
          const gradient = `linear-gradient(135deg, ${funnelColor} 0%, ${funnelColor} 100%)`

          let outlineStyle: React.CSSProperties = {}
          if (isSelected) {
            outlineStyle = {
              outline: '2px solid var(--color-accent)',
              outlineOffset: '2px',
            }
          } else if (isBottleneck) {
            outlineStyle = {
              outline: `1px solid var(--color-bottleneck-${stage.bottleneckType})`,
            }
          }

          const deltaColor =
            stage.delta === undefined
              ? undefined
              : stage.delta > 0
                ? 'var(--color-success)'
                : stage.delta < 0
                  ? 'var(--color-danger)'
                  : 'var(--color-fg-muted)'

          const DeltaIcon =
            stage.delta === undefined
              ? null
              : stage.delta > 0
                ? TrendingUp
                : stage.delta < 0
                  ? TrendingDown
                  : Minus

          return (
            <div key={stage.id}>
              {i > 0 && lostUsers > 0 && (
                <div
                  className="flex items-center gap-2 py-1.5 pl-3.5"
                  style={{
                    fontSize: '10px',
                    color: isBottleneck ? 'var(--color-bottleneck-page)' : 'var(--color-fg-subtle)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <TrendingDown size={10} />
                  <span
                    style={{
                      color: isBottleneck ? 'inherit' : 'var(--color-fg-muted)',
                      fontWeight: isBottleneck ? 500 : 400,
                    }}
                  >
                    {formatLost(lostUsers, stage.format)} caíram
                  </span>
                  {stage.conversionFromPrevious !== undefined && (
                    <span style={{ color: 'var(--color-fg-disabled)' }}>
                      · {stage.conversionFromPrevious.toFixed(1)}% conversão
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={() => onSelectStage?.(stage.id)}
                disabled={!onSelectStage}
                className="group flex w-full items-center gap-3.5 py-1 transition-transform duration-200 hover:translate-x-0.5 enabled:cursor-pointer disabled:cursor-default disabled:hover:translate-x-0"
              >
                <div
                  className="relative flex items-center justify-between px-5 transition-all"
                  style={{
                    width: `${widthPercent}%`,
                    minWidth: '320px',
                    height: '52px',
                    borderRadius: '8px',
                    background: gradient,
                    ...outlineStyle,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span
                      className="flex-shrink-0 font-mono font-medium"
                      style={{ fontSize: '10px', color: numberColor }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="truncate font-medium"
                      style={{ fontSize: '14px', color: textColor }}
                    >
                      {stage.label}
                    </span>
                  </div>

                  <div
                    className="ml-3 flex-shrink-0 text-right"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    <div className="font-medium" style={{ fontSize: '14px', color: textColor }}>
                      {formatValue(stage.value, stage.format)}
                    </div>
                    {(stage.inlineMetric ||
                      (stage.conversionFromPrevious !== undefined && i > 0)) && (
                      <div style={{ fontSize: '10px', color: subtextColor, marginTop: '2px' }}>
                        {stage.inlineMetric ? (
                          <>
                            {stage.inlineMetric.label} {stage.inlineMetric.value}
                          </>
                        ) : (
                          <>{stage.conversionFromPrevious!.toFixed(1)}%</>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2" style={{ minWidth: '96px' }}>
                  {stage.bottleneckType && (
                    <BottleneckBadge type={stage.bottleneckType} size="sm" />
                  )}
                  {DeltaIcon && stage.delta !== undefined && (
                    <div
                      className="flex items-center gap-0.5"
                      style={{
                        fontSize: '11px',
                        color: deltaColor,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <DeltaIcon size={11} />
                      <span>{Math.abs(stage.delta).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {bottleneckStage && (
        <div
          className="mt-6 flex items-center gap-3 rounded-lg px-3.5 py-3"
          style={{
            backgroundColor: `var(--color-bottleneck-${bottleneckStage.bottleneckType}-bg)`,
            border: `1px solid var(--color-bottleneck-${bottleneckStage.bottleneckType}-border)`,
          }}
        >
          <BottleneckPulseDot type={bottleneckStage.bottleneckType!} />
          <div className="flex-1 text-xs">
            <span
              className="font-medium"
              style={{ color: `var(--color-bottleneck-${bottleneckStage.bottleneckType})` }}
            >
              Gargalo detectado em {bottleneckStage.label}.
            </span>
            {bottleneckDiagnosis && (
              <span className="ml-1.5 text-[var(--color-fg-muted)]">{bottleneckDiagnosis}</span>
            )}
          </div>
          {onAnalyzeBottleneck && (
            <button
              onClick={onAnalyzeBottleneck}
              className="cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors"
              style={{
                color: `var(--color-bottleneck-${bottleneckStage.bottleneckType})`,
                border: `0.5px solid var(--color-bottleneck-${bottleneckStage.bottleneckType}-border)`,
                backgroundColor: 'transparent',
              }}
            >
              Analisar →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function BottleneckPulseDot({ type }: { type: BottleneckType }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: '8px', height: '8px' }}>
      <span
        className="absolute inset-0 animate-ping rounded-full"
        style={{
          backgroundColor: `var(--color-bottleneck-${type})`,
          opacity: 0.4,
        }}
      />
      <span
        className="relative block rounded-full"
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: `var(--color-bottleneck-${type})`,
          boxShadow: `0 0 0 3px var(--color-bottleneck-${type}-bg)`,
        }}
      />
    </div>
  )
}
