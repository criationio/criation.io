'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { disconnectGoogle } from '@/lib/actions/google-connections'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GoogleDetailPayload } from '../types'
import { DetailField, DetailGrid } from './DetailGrid'

export function GoogleDetails({ payload }: { payload: GoogleDetailPayload | null }) {
  if (!payload) {
    return <NotConnectedDetails />
  }
  return <ConnectedDetails payload={payload} />
}

// ---------------------------------------------------------------------------

function NotConnectedDetails() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-fg)]">
        Conecte sua conta Google Ads pra enviar conversões server-side via a Data Manager API
        (Enhanced Conversions for Web / Leads).
      </p>

      <div>
        <p className="mb-2 text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Escopos solicitados no consentimento
        </p>
        <ul className="space-y-1.5 text-xs text-[var(--color-fg-muted)]">
          <li>
            <code className="font-mono text-[11px] text-[var(--color-fg)]">auth/adwords</code> —
            leitura da lista de contas Google Ads acessíveis e das conversion actions da conta
            selecionada (somente metadata, sem editar campanhas).
          </li>
          <li>
            <code className="font-mono text-[11px] text-[var(--color-fg)]">auth/datamanager</code> —
            envio server-side de conversões (com PII hasheada em SHA-256) pras conversion actions
            que você mapear no wizard.
          </li>
          <li>
            <code className="font-mono text-[11px] text-[var(--color-fg)]">
              auth/cloud-platform
            </code>{' '}
            — exigido pela Data Manager API para autenticação, conforme o guia oficial do Google.
            Não acessamos nenhum outro recurso GCP.
          </li>
        </ul>
      </div>

      <p className="text-xs text-[var(--color-fg-subtle)]">
        Tokens são armazenados criptografados (AES-256-GCM). Você pode revogar o acesso a qualquer
        momento aqui ou na conta Google.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ConnectedDetails({ payload }: { payload: GoogleDetailPayload }) {
  return (
    <div className="space-y-5">
      {(payload.googleUserName || payload.googleUserEmail) && (
        <div>
          <p className="text-sm font-medium text-[var(--color-fg)]">
            {payload.googleUserName ?? payload.googleUserEmail}
          </p>
          {payload.googleUserName && payload.googleUserEmail && (
            <p className="text-xs text-[var(--color-fg-muted)]">{payload.googleUserEmail}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ScopeBadge ok={payload.grantedAdsScope} label="adwords" />
            <ScopeBadge ok={payload.grantedDataManagerScope} label="datamanager" />
            <ScopeBadge ok={payload.grantedCloudPlatformScope} label="cloud-platform" />
            {payload.testMode && (
              <span className="inline-flex items-center rounded-full border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-warning)]">
                Modo teste
              </span>
            )}
          </div>
        </div>
      )}

      <DetailGrid>
        <DetailField label="Token expira em">
          {payload.tokenExpiresInDays !== null
            ? `${payload.tokenExpiresInDays} dia${payload.tokenExpiresInDays === 1 ? '' : 's'}`
            : '—'}
        </DetailField>
        <DetailField label="Ads API" mono>
          {payload.adsApiVersion}
        </DetailField>
        <DetailField label="Data Manager API" mono>
          {payload.dataManagerApiVersion}
        </DetailField>
        <DetailField label="Contas Google Ads">{payload.accountsCount}</DetailField>
        <DetailField label="Conta default" mono>
          {payload.defaultCustomerId ?? '—'}
        </DetailField>
      </DetailGrid>

      <div className="flex items-center justify-end border-t border-[var(--color-border)] pt-4">
        <GoogleConnectionActions />
      </div>
    </div>
  )
}

function ScopeBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${
        ok
          ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
          : 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
      }`}
    >
      {ok ? '✓' : '×'} {label}
    </span>
  )
}

function GoogleConnectionActions() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  function handleDisconnect() {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 4000)
      return
    }
    startTransition(async () => {
      const result = await disconnectGoogle()
      if (!result.ok) {
        toast.error('Falha ao desconectar', { description: result.error.message })
        return
      }
      toast.success('Google desconectado')
      router.refresh()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        aria-label="Ações da conexão Google"
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={handleDisconnect}
          disabled={isPending}
          className="text-[var(--color-danger)] focus:bg-[var(--color-danger-bg)] focus:text-[var(--color-danger)]"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {confirming ? 'Clique pra confirmar' : isPending ? 'Desconectando…' : 'Desconectar'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
