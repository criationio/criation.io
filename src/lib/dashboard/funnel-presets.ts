/**
 * Funnel presets (PR-13a).
 *
 * Cada preset define quais etapas do funil canonico aparecem por modelo de
 * negocio. User troca o preset no widget config menu; "Customizado" desativa
 * o preset e libera toggle manual por etapa.
 *
 * Persistencia: por agora localStorage por widget. PR-13c migra pra
 * dashboard_layouts.layout.widgets[N].config.
 */

import type { FunnelData } from '@/lib/dashboard/mock-data'

export type FunnelStageKey = keyof FunnelData

export type FunnelPresetId =
  | 'vsl-direto'
  | 'webinar'
  | 'lead-magnet'
  | 'whatsapp'
  | 'trial-saas'
  | 'custom'

export interface FunnelPreset {
  id: FunnelPresetId
  name: string
  description: string
  stages: FunnelStageKey[]
}

export const FUNNEL_PRESETS: FunnelPreset[] = [
  {
    id: 'vsl-direto',
    name: 'VSL direto pra checkout',
    description: 'Sem captura de lead. Tráfego pago → carta de vendas → compra.',
    stages: [
      'impressions',
      'clicks',
      'pageViews',
      'initiateCheckout',
      'purchasesApproved',
      'paymentConfirmed',
    ],
  },
  {
    id: 'webinar',
    name: 'Webinar / Live launch',
    description: 'Lead opt-in pro webinar, oferta no fim, checkout.',
    stages: [
      'impressions',
      'clicks',
      'pageViews',
      'leads',
      'initiateCheckout',
      'purchasesApproved',
      'paymentConfirmed',
    ],
  },
  {
    id: 'lead-magnet',
    name: 'Lead magnet + email',
    description: 'Email capturado → nutrição → venda via campanha de email.',
    stages: [
      'impressions',
      'clicks',
      'pageViews',
      'leads',
      'initiateCheckout',
      'purchasesApproved',
      'paymentConfirmed',
    ],
  },
  {
    id: 'whatsapp',
    name: 'Click-to-WhatsApp',
    description: 'Ad → WhatsApp → conversão por atendimento humano.',
    stages: ['impressions', 'clicks', 'leads', 'purchasesApproved', 'paymentConfirmed'],
  },
  {
    id: 'trial-saas',
    name: 'Trial / SaaS',
    description: 'Free trial ou freemium com upgrade pago + retenção.',
    stages: [
      'impressions',
      'clicks',
      'pageViews',
      'leads',
      'purchasesApproved',
      'paymentConfirmed',
      'activeSubscriptions',
    ],
  },
  {
    id: 'custom',
    name: 'Customizado',
    description: 'Escolha exatamente quais etapas aparecem.',
    stages: [
      'impressions',
      'clicks',
      'pageViews',
      'leads',
      'initiateCheckout',
      'purchasesApproved',
      'paymentConfirmed',
      'activeSubscriptions',
    ],
  },
]

export const ALL_FUNNEL_STAGES: FunnelStageKey[] = [
  'impressions',
  'clicks',
  'pageViews',
  'leads',
  'initiateCheckout',
  'purchasesApproved',
  'paymentConfirmed',
  'activeSubscriptions',
]

export function getPreset(id: FunnelPresetId): FunnelPreset {
  return FUNNEL_PRESETS.find((p) => p.id === id) ?? FUNNEL_PRESETS[0]!
}
