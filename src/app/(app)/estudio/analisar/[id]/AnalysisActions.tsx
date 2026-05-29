'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteAnalysis, renameAnalysis } from '@/lib/actions/analysis'

/**
 * Título editável + apagar (Commit B). Renomeia inline e apaga com diálogo de
 * confirmação ("excluído permanentemente"). Workspace-scoped nas actions.
 */
export function AnalysisActions({
  analysisId,
  initialName,
  fallbackName,
}: {
  analysisId: string
  initialName: string | null
  fallbackName: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName ?? '')
  const [pending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = initialName?.trim() || fallbackName

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Nome obrigatório')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await renameAnalysis({ id: analysisId, name: trimmed })
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function confirmDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteAnalysis(analysisId)
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      router.push('/estudio/analisar')
    })
  }

  if (editing) {
    return (
      <div className="flex w-full items-center gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="h-9"
        />
        <Button size="icon" variant="ghost" onClick={save} disabled={pending} aria-label="Salvar">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setEditing(false)
            setName(initialName ?? '')
            setError(null)
          }}
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">{displayName}</h1>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          setName(initialName ?? displayName)
          setEditing(true)
        }}
        aria-label="Renomear"
      >
        <Pencil className="h-4 w-4 text-[var(--color-fg-muted)]" />
      </Button>
      <Button size="icon" variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Apagar">
        <Trash2 className="h-4 w-4 text-[var(--color-fg-muted)]" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar análise</DialogTitle>
            <DialogDescription>
              Esta análise será excluída permanentemente, junto com o resultado. Esta ação não pode
              ser desfeita e o crédito consumido não será devolvido.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={pending}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Excluindo...
                </>
              ) : (
                'Excluir permanentemente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
