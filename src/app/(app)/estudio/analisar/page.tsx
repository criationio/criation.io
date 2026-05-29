import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveCurrentWorkspaceId } from '@/lib/auth/workspace'
import { listAnalysesByWorkspace } from '@/lib/db/queries/analyses'
import { listFoldersByWorkspace } from '@/lib/db/queries/analysis-folders'

import { FoldersBar } from './FoldersBar'
import { AnalysisRowMenu } from './AnalysisRowMenu'

export const revalidate = 0

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: {
    label: 'Concluída',
    cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  },
  failed: { label: 'Falhou', cls: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' },
  running: { label: 'Executando', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  queued: { label: 'Na fila', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default async function EstudioAnalisarPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>
}) {
  const workspaceId = await resolveCurrentWorkspaceId()
  if (!workspaceId) redirect('/login')

  const { folder } = await searchParams
  // undefined = todas; 'none' = sem pasta; else id da pasta.
  const folderId = folder === undefined ? undefined : folder === 'none' ? null : folder

  const [folders, analyses] = await Promise.all([
    listFoldersByWorkspace(workspaceId),
    listAnalysesByWorkspace(workspaceId, { folderId, limit: 100 }),
  ])
  const folderOptions = folders.map((f) => ({ id: f.id, name: f.name }))

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">Análises</h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Diagnósticos de criativos gerados por IA.
          </p>
        </div>
        <Button asChild>
          <Link href="/estudio/analisar/nova">
            <Plus className="h-4 w-4" /> Nova análise
          </Link>
        </Button>
      </header>

      <FoldersBar folders={folderOptions} active={folder} />

      {analyses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] px-6 py-16 text-center">
          <Sparkles className="h-6 w-6 text-[var(--color-fg-subtle)]" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            {folder
              ? 'Nenhuma análise nesta visualização.'
              : 'Nenhuma análise ainda. Crie a primeira.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          {analyses.map((a) => {
            const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.queued
            const displayName = a.name?.trim() || 'Anúncio em vídeo · Quick'
            return (
              <li key={a.id} className="flex items-center gap-2 pr-2">
                <Link
                  href={`/estudio/analisar/${a.id}`}
                  className="flex flex-1 items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--color-bg-elevated)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--color-fg)]">
                      {displayName}
                    </span>
                    <span className="text-xs text-[var(--color-fg-subtle)]">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                  <Badge className={badge!.cls}>{badge!.label}</Badge>
                </Link>
                <AnalysisRowMenu
                  analysisId={a.id}
                  currentName={displayName}
                  currentFolderId={a.folderId}
                  folders={folderOptions}
                />
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
