'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { disconnectGateway } from '@/lib/actions/gateway-connections'

export function ConnectionActions({ connectionId }: { connectionId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDisconnect() {
    if (!confirm('Tem certeza? Os webhooks vão parar de chegar.')) return
    startTransition(async () => {
      const result = await disconnectGateway({ connectionId })
      if (result.ok) toast.success('Eduzz desconectado')
      else toast.error(`Falha: ${result.error.message}`)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDisconnect}
      disabled={isPending}
      className="h-8 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 text-xs text-[var(--color-danger)] transition hover:border-[var(--color-danger)] disabled:opacity-50"
    >
      Desconectar
    </button>
  )
}
