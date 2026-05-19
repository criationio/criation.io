'use client'

import type { TrackingDetailPayload } from '../types'
import { DetailField, DetailGrid } from './DetailGrid'

export function TrackingDetails({ payload }: { payload: TrackingDetailPayload }) {
  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
        CDP da Criation — substitui Pixel + GTM + Stape com 1 script. Captura visitor_id
        first-party, UTMs, click IDs, page_view automático, scroll, formulários e eventos custom via{' '}
        <code className="font-mono">window.criation(&apos;track&apos;, ...)</code>.
      </p>

      <DetailGrid>
        <DetailField label="Status">
          {payload.installed ? (
            <span className="text-[var(--color-success)]">Recebendo eventos</span>
          ) : payload.configured ? (
            <span className="text-[var(--color-warning)]">Aguardando 1º evento</span>
          ) : (
            <span className="text-[var(--color-fg-muted)]">Não instalado</span>
          )}
        </DetailField>
        <DetailField label="Eventos (24h)">
          <span className="font-medium tabular-nums">
            {payload.totalEvents24h.toLocaleString('pt-BR')}
          </span>
        </DetailField>
        <DetailField label="Último evento">
          {payload.lastEventAt
            ? new Date(payload.lastEventAt).toLocaleString('pt-BR')
            : 'Nenhum ainda'}
        </DetailField>
        <DetailField label="Origens permitidas">
          {payload.originAllowlistCount === 0
            ? 'Qualquer origem (modo onboarding)'
            : `${payload.originAllowlistCount} domínio${payload.originAllowlistCount === 1 ? '' : 's'}`}
        </DetailField>
      </DetailGrid>
    </div>
  )
}
