'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { triggerCampaignSync } from '@/lib/actions/campaigns'

export function SyncCampaignsButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      const result = await triggerCampaignSync()
      if (!result.ok) {
        toast.error('Falha ao sincronizar', { description: result.error.message })
        return
      }
      toast.success('Sincronização iniciada', {
        description: 'Roda em background. Atualize em ~30s pra ver os dados.',
      })
      // Wait a moment then refresh para mostrar as campanhas (mesmo que parciais)
      setTimeout(() => router.refresh(), 5_000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isPending}
      className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Agendando…' : 'Sincronizar agora'}
    </button>
  )
}
