import { ShieldAlert, ShieldCheck } from 'lucide-react'

import { ConexoesActions } from '@/app/(app)/configuracoes/conexoes/conexoes-actions'

import type { MetaDetailPayload } from '../types'
import { DetailField, DetailGrid } from './DetailGrid'

const VERIFICATION_LABELS: Record<string, string> = {
  not_started: 'Não iniciada',
  pending: 'Pendente',
  verified: 'Verificado',
  rejected: 'Rejeitado',
}

export function MetaDetails({ payload }: { payload: MetaDetailPayload }) {
  return (
    <div className="space-y-5">
      {(payload.metaUserName || payload.metaUserEmail) && (
        <div>
          <p className="text-sm font-medium">{payload.metaUserName ?? payload.metaUserEmail}</p>
          {payload.metaUserName && payload.metaUserEmail && (
            <p className="text-xs text-[var(--color-fg-muted)]">{payload.metaUserEmail}</p>
          )}
          {payload.isSystemUserToken && (
            <span className="mt-1 inline-flex rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-info)]">
              System User Token (não expira)
            </span>
          )}
        </div>
      )}

      <DetailGrid>
        <DetailField label="Token expira em">
          {payload.isSystemUserToken
            ? 'Não expira'
            : payload.tokenExpiresInDays !== null
              ? `${payload.tokenExpiresInDays} dia${payload.tokenExpiresInDays === 1 ? '' : 's'}`
              : '—'}
        </DetailField>
        <DetailField label="API version" mono>
          {payload.marketingApiVersion}
        </DetailField>
        <DetailField label="Pixel default" mono>
          {payload.pixelId ?? '—'}
        </DetailField>
        <DetailField label="Business Verification">
          <span className="inline-flex items-center gap-1">
            {payload.businessVerificationStatus === 'verified' ? (
              <ShieldCheck className="h-3 w-3 text-[var(--color-success)]" />
            ) : (
              <ShieldAlert className="h-3 w-3 text-[var(--color-warning)]" />
            )}
            {VERIFICATION_LABELS[payload.businessVerificationStatus] ??
              payload.businessVerificationStatus}
          </span>
        </DetailField>
        <DetailField label="Domínios verificados">
          {payload.verifiedDomainsCount} de {payload.totalDomainsCount}
        </DetailField>
        <DetailField label="Scopes concedidos">{payload.scopesCount}</DetailField>
        <DetailField label="Contas de anúncio">{payload.adAccountsCount}</DetailField>
        <DetailField label="Conta principal" mono>
          {payload.defaultAdAccountId ?? '—'}
        </DetailField>
      </DetailGrid>

      <div className="flex items-center justify-end border-t border-[var(--color-border)] pt-4">
        <ConexoesActions />
      </div>
    </div>
  )
}
