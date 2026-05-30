'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Folder, FolderPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react'

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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createFolder, deleteFolder, renameFolder } from '@/lib/actions/analysis'

export interface FolderOption {
  id: string
  name: string
}

const CHIP_BASE = 'rounded-full border px-3 py-1.5 text-sm transition-colors whitespace-nowrap'
const CHIP_ON = 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-fg)]'
const CHIP_OFF =
  'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)]'

export function FoldersBar({
  folders,
  active,
}: {
  folders: FolderOption[]
  active: string | undefined
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const [renameTarget, setRenameTarget] = useState<FolderOption | null>(null)
  const [renameName, setRenameName] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<FolderOption | null>(null)

  function submitNew() {
    setError(null)
    startTransition(async () => {
      const res = await createFolder({ name: newName })
      if (!res.ok) return setError(res.error.message)
      setNewOpen(false)
      setNewName('')
      router.refresh()
    })
  }

  function submitRename() {
    if (!renameTarget) return
    setError(null)
    startTransition(async () => {
      const res = await renameFolder({ id: renameTarget.id, name: renameName })
      if (!res.ok) return setError(res.error.message)
      setRenameTarget(null)
      router.refresh()
    })
  }

  function submitDelete() {
    if (!deleteTarget) return
    setError(null)
    startTransition(async () => {
      const res = await deleteFolder(deleteTarget.id)
      if (!res.ok) return setError(res.error.message)
      const wasActive = active === deleteTarget.id
      setDeleteTarget(null)
      if (wasActive) router.push('/estudio/analisar')
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/estudio/analisar" className={`${CHIP_BASE} ${!active ? CHIP_ON : CHIP_OFF}`}>
        Todas
      </Link>
      <Link
        href="/estudio/analisar?folder=none"
        className={`${CHIP_BASE} ${active === 'none' ? CHIP_ON : CHIP_OFF}`}
      >
        Sem pasta
      </Link>

      {folders.map((f) => {
        const on = active === f.id
        return (
          <div
            key={f.id}
            className={`flex items-center gap-1 ${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
          >
            <Link href={`/estudio/analisar?folder=${f.id}`} className="flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5" />
              {f.name}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Opções da pasta"
                className="opacity-60 hover:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameName(f.name)
                    setRenameTarget(f)
                  }}
                >
                  <Pencil className="h-4 w-4" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setDeleteTarget(f)}
                  className="text-[var(--color-danger)]"
                >
                  <Trash2 className="h-4 w-4" /> Apagar pasta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}

      <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
        <FolderPlus className="h-4 w-4" /> Nova pasta
      </Button>

      {/* Nova pasta */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            placeholder="Nome da pasta"
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
          />
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitNew} disabled={pending || !newName.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renomear pasta */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear pasta</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            maxLength={60}
            onKeyDown={(e) => e.key === 'Enter' && submitRename()}
          />
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submitRename} disabled={pending || !renameName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apagar pasta */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar pasta</DialogTitle>
            <DialogDescription>
              A pasta &quot;{deleteTarget?.name}&quot; será apagada. As análises dentro dela não são
              excluídas — voltam para &quot;Sem pasta&quot;.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              onClick={submitDelete}
              disabled={pending}
              className="bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90"
            >
              Apagar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
