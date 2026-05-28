'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  EVENTS,
  type EventData,
  Joyride,
  STATUS,
  type Step,
  type TooltipRenderProps,
} from 'react-joyride'

import { markDashboardTourDone } from '@/lib/actions/tour'

/**
 * Tour interativo no dashboard (Sessao 1.5 restruct 2026-05-28).
 *
 * Dispara automaticamente quando user tem tour_completed_at = NULL no DB.
 * 12 stops cobrindo features principais (sidebar nav + topbar icones).
 *
 * UX/Design:
 *  - Tooltip custom via `tooltipComponent` (Tailwind + design tokens) ao
 *    inves do Joyride defaults — garante consistencia com sistema visual
 *    do produto e auto-adaptacao light/dark via CSS vars.
 *  - Glassmorphism: `--color-glass-bg` (defined em globals.css por tema)
 *    + backdrop-blur + borda sutil + sombra ampla.
 *  - Botoes em layout vertical organizado (sem overlap com titulo/conteudo).
 *
 * No finish/skip persiste tour_completed_at via Server Action + cache
 * localStorage. DB e fonte de verdade — cache so evita flicker.
 */

const STORAGE_KEY = 'criation_dashboard_tour_done'

const STEPS: Step[] = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo à Criation',
    content:
      'Em 1 minuto vou te mostrar onde tudo vive na plataforma. Você pode pular a qualquer momento.',
  },
  {
    target: '[data-tour="dashboard"]',
    placement: 'right',
    title: 'Dashboard',
    content:
      'Seu funil de vendas em tempo real: impressões → checkout → pagamento. Onde você vai bater olho todo dia.',
  },
  {
    target: '[data-tour="produtos"]',
    placement: 'right',
    title: 'Produtos',
    content:
      'Mapeie produtos do seu gateway pra dentro da plataforma. Benchmarks por nicho. (Em breve)',
  },
  {
    target: '[data-tour="estudio"]',
    placement: 'right',
    title: 'Estúdio',
    content:
      'Análises com IA dos seus criativos. Modelar, variar, comparar — todos os pipelines aqui. (Em breve)',
  },
  {
    target: '[data-tour="tracking-overview"]',
    placement: 'right',
    title: 'Visão geral do tracking',
    content:
      'Sua camada CDP. Eventos do site, fanout pra Meta/Google, match rate — tudo em um lugar.',
  },
  {
    target: '[data-tour="tracking-script"]',
    placement: 'right',
    title: 'Script de rastreio',
    content:
      'Snippet único que substitui Pixel + GTM + Stape. Cole no <head> do seu site e está pronto.',
  },
  {
    target: '[data-tour="atribuicao"]',
    placement: 'right',
    title: 'Atribuição UTM',
    content:
      'O cérebro da atribuição. Mapeie UTMs pra campanhas e cruze cada venda com a campanha que gerou.',
  },
  {
    target: '[data-tour="capi"]',
    placement: 'right',
    title: 'CAPI',
    content:
      'Configure eventos de conversão server-side pra Meta CAPI e Google EC. EMQ alto, dedup automático.',
  },
  {
    target: '[data-tour="conexoes"]',
    placement: 'right',
    title: 'Conexões',
    content: 'Plug Hotmart, Kiwify, Eduzz, Meta Ads, Google Ads. Sem essas integrações nada flui.',
  },
  {
    target: '[data-tour="api"]',
    placement: 'right',
    title: 'API & MCP',
    content: 'Acesso programático via API REST + servidor MCP pra automações com IA. (Em breve)',
  },
  {
    target: '[data-tour="notifications-bell"]',
    placement: 'bottom',
    title: 'Notificações',
    content:
      'Alertas de queda de CTR, créditos baixos, conexões expiradas e tudo que pede sua atenção.',
  },
  {
    target: '[data-tour="user-menu"]',
    placement: 'bottom-end',
    title: 'Seu perfil',
    content: 'Trocar tema, gerenciar workspace, fazer logout. Tudo que é seu fica aqui.',
  },
]

// Custom tooltip — Tailwind + CSS vars do design system (auto light/dark).
function TourTooltip({
  index,
  size,
  isLastStep,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      style={{
        background: 'var(--color-glass-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--color-glass-border)',
        boxShadow: 'var(--color-glass-shadow)',
      }}
      className="relative w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl text-[var(--color-fg)]"
    >
      {/* Close button absoluto, fora do flow do conteudo */}
      <button
        {...closeProps}
        type="button"
        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
        aria-label="Fechar tour"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Conteudo principal — padding reservado pro close button */}
      <div className="p-5 pr-12">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[var(--color-accent)] uppercase">
            {index + 1} de {size}
          </span>
        </div>

        {step.title && (
          <h3 className="text-base leading-tight font-semibold tracking-tight text-[var(--color-fg)]">
            {step.title}
          </h3>
        )}

        {step.content && (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
            {step.content as React.ReactNode}
          </p>
        )}
      </div>

      {/* Footer com botoes — barra horizontal separada, sem overlap */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-5 py-3">
        <button
          {...skipProps}
          type="button"
          className="text-[12px] text-[var(--color-fg-subtle)] transition hover:text-[var(--color-fg-muted)]"
        >
          Pular tour
        </button>

        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              type="button"
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
            >
              Voltar
            </button>
          )}
          <button
            {...primaryProps}
            type="button"
            className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--color-fg-on-accent)] shadow-sm transition hover:bg-[var(--color-accent-hover)]"
          >
            {isLastStep ? 'Finalizar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}

const JOYRIDE_OPTIONS = {
  // primaryColor usado pelo Joyride internamente (beacon, spotlight glow).
  // Resolvido em runtime via CSS var read se possivel, ou fallback hex.
  primaryColor: '#8b5cf6',
  overlayColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 10_000,
  showProgress: false, // renderizado dentro do custom tooltip
  skipBeacon: true,
  spotlightRadius: 12,
}

interface DashboardTourProps {
  shouldRun: boolean
}

export function DashboardTour({ shouldRun }: DashboardTourProps) {
  const [run, setRun] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!shouldRun) {
      window.localStorage.setItem(STORAGE_KEY, '1')
      return
    }
    window.localStorage.removeItem(STORAGE_KEY)
    const t = setTimeout(() => setRun(true), 500)
    return () => clearTimeout(t)
  }, [shouldRun])

  const handleEvent = useCallback((data: EventData) => {
    const { status, type } = data
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
    if (finishedStatuses.includes(status)) {
      setRun(false)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, '1')
      }
      void markDashboardTourDone().catch(() => {
        // swallow — log fica no Server Action
      })
      return
    }
    if (type === EVENTS.TARGET_NOT_FOUND) {
      // Joyride v3 pula automaticamente quando target nao existe.
      return
    }
  }, [])

  if (!run) return null

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      onEvent={handleEvent}
      options={JOYRIDE_OPTIONS}
      tooltipComponent={TourTooltip}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        skip: 'Pular tour',
      }}
    />
  )
}
