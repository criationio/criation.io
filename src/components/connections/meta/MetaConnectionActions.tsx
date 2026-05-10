'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState } from 'react'
import { MoreVertical, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { disconnectMeta, syncMetaConnection } from '@/lib/actions/meta-connections'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function MetaConnectionActions() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [syncError, setSyncError] = useState<string | null>(null)

  function handleSync() {
    setSyncError(null)
    startTransition(async () => {
      const result = await syncMetaConnection()
      if (!result.ok) {
        if (result.error.code === 'TOKEN_EXPIRED') {
          toast.error('Token expirou', {
            description: result.error.message,
            action: {
              label: 'Reconectar',
              onClick: () => router.push('/bem-vindo/meta?returnTo=/configuracoes/conexoes'),
            },
          })
        } else {
          toast.error('Falha ao sincronizar', { description: result.error.message })
        }
        setSyncError(result.error.message)
        return
      }
      toast.success('Conexão sincronizada', {
        description: `${result.updated.adAccountsCount} contas · ${result.updated.verifiedDomainsCount} domínios verificados`,
      })
      router.refresh()
    })
  }

  function handleDisconnect() {
    if (!confirm('Tem certeza que deseja desconectar? Análises e sync vão parar.')) return
    startTransition(async () => {
      const result = await disconnectMeta()
      if (!result.ok) {
        toast.error('Falha ao desconectar', { description: result.error.message })
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Sincronizando…' : 'Sincronizar'}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Ações"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleDisconnect()
            }}
            disabled={isPending}
            className="flex items-center gap-2 text-[var(--color-danger)] focus:text-[var(--color-danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Desconectar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {syncError && <span className="sr-only">{syncError}</span>}
    </div>
  )
}
