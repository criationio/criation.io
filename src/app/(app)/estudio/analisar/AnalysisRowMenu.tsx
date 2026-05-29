'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FolderInput, MoreVertical, Pencil, Trash2 } from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteAnalysis, moveAnalysisToFolder, renameAnalysis } from '@/lib/actions/analysis'

import type { FolderOption } from './FoldersBar'

export function AnalysisRowMenu({
  analysisId,
  currentName,
  currentFolderId,
  folders,
}: {
  analysisId: string
  currentName: string
  currentFolderId: string | null
  folders: FolderOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function submitRename() {
    setError(null)
    startTransition(async () => {
      const res = await renameAnalysis({ id: analysisId, name: name.trim() })
      if (!res.ok) return setError(res.error.message)
      setRenameOpen(false)
      router.refresh()
    })
  }

  function move(folderId: string | null) {
    startTransition(async () => {
      const res = await moveAnalysisToFolder({ analysisId, folderId })
      if (res.ok) router.refresh()
    })
  }

  function submitDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteAnalysis(analysisId)
      if (!res.ok) return setError(res.error.message)
      setDeleteOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opções da análise"
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setName(currentName)
              setRenameOpen(true)
            }}
          >
            <Pencil className="h-4 w-4" /> Renomear
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="h-4 w-4" /> Mover para
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => move(null)}>
                {currentFolderId === null && <Check className="h-4 w-4" />} Sem pasta
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onSelect={() => move(f.id)}>
                  {currentFolderId === f.id && <Check className="h-4 w-4" />} {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-[var(--color-danger)]"
          >
            <Trash2 className="h-4 w-4" /> Apagar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear análise</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
          />
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitRename} disabled={pending || !name.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={submitDelete}
              disabled={pending}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              Excluir permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
