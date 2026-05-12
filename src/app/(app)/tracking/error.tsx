'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export default function TrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[tracking] page error', error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Erro ao carregar Tracking</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Não conseguimos carregar o status do CDP. Pode ser uma instabilidade temporária do banco
          ou rede. Tente novamente em alguns segundos.
        </p>
        {error.digest && (
          <code className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-fg-subtle)]">
            digest: {error.digest}
          </code>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    </main>
  )
}
