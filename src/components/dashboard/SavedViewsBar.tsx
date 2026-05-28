'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, ChevronDown, Eye, Plus, Star, Trash2, Users } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  createDashboardLayoutAction,
  deleteDashboardLayoutAction,
  setDefaultDashboardLayoutAction,
} from '@/lib/actions/dashboard-layouts'
import type { DashboardLayoutData } from '@/lib/db/schema/dashboard'

/**
 * Saved views bar — dropdown + ações (PR-12).
 *
 * Mostra a view atual + lista de views salvas no dropdown. Permite:
 *  - Trocar view (URL muda pra ?view=ID)
 *  - Salvar layout atual como nova view (com nome + toggle shared workspace)
 *  - Marcar view como default do user
 *  - Excluir view (soft delete)
 *
 * Layout state real fica em DashboardGrid (persistido por Server Action). Esta
 * barra apenas dispara ações de view-level.
 */

export interface SavedView {
  id: string
  name: string
  isShared: boolean
  isDefault: boolean
}

interface SavedViewsBarProps {
  views: SavedView[]
  currentViewId: string
  currentLayout: DashboardLayoutData
}

export function SavedViewsBar({ views, currentViewId, currentLayout }: SavedViewsBarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [makeShared, setMakeShared] = useState(false)
  const [makeDefault, setMakeDefault] = useState(false)
  const [pending, startTransition] = useTransition()

  const current = views.find((v) => v.id === currentViewId) ?? views[0]

  const switchView = (id: string) => {
    setOpen(false)
    router.push(`/dashboard?view=${id}`)
  }

  const handleSave = () => {
    if (!newName.trim()) return
    startTransition(async () => {
      const result = await createDashboardLayoutAction({
        name: newName.trim(),
        layout: currentLayout,
        shared: makeShared,
        makeDefault,
      })
      if (result.ok) {
        setShowSaveDialog(false)
        setNewName('')
        setMakeShared(false)
        setMakeDefault(false)
        router.push(`/dashboard?view=${result.id}`)
      }
    })
  }

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      await setDefaultDashboardLayoutAction({ id })
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta view? Layout salvo será perdido.')) return
    startTransition(async () => {
      const result = await deleteDashboardLayoutAction({ id })
      if (result.ok) {
        // Se excluiu a atual, redireciona pra primeira disponivel
        if (id === currentViewId) {
          const remaining = views.filter((v) => v.id !== id)
          if (remaining[0]) router.push(`/dashboard?view=${remaining[0].id}`)
          else router.push('/dashboard')
        } else {
          router.refresh()
        }
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <details
        className="group relative"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary
          className={cn(
            'inline-flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-[12px] text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)] [&::-webkit-details-marker]:hidden',
            'group-open:border-[var(--color-accent)] group-open:bg-[var(--color-accent-subtle)]'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="font-medium">{current?.name ?? 'Sem view'}</span>
          {current?.isShared && <Users className="h-3 w-3 text-[var(--color-fg-subtle)]" />}
          {current?.isDefault && (
            <Star className="h-3 w-3 fill-current text-[var(--color-accent)]" />
          )}
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute top-full left-0 z-30 mt-1 min-w-[260px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-lg">
          {views.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-[var(--color-fg-subtle)]">
              Nenhuma view salva ainda.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              {views.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    'group/item flex items-center gap-2 px-3 py-1.5 text-[12px] transition-colors',
                    v.id === currentViewId
                      ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                      : 'text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => switchView(v.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {v.id === currentViewId && <Check className="h-3 w-3" />}
                    <span className="flex-1 truncate">{v.name}</span>
                    {v.isShared && (
                      <Users
                        className="h-3 w-3 text-[var(--color-fg-subtle)]"
                        aria-label="View compartilhada"
                      />
                    )}
                    {v.isDefault && (
                      <Star
                        className="h-3 w-3 fill-current text-[var(--color-accent)]"
                        aria-label="View padrão"
                      />
                    )}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/item:opacity-100">
                    {!v.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(v.id)}
                        disabled={pending}
                        className="rounded-sm p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-accent)]"
                        title="Definir como padrão"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      disabled={pending}
                      className="rounded-sm p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)]"
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-[var(--color-border)] pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setShowSaveDialog(true)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
            >
              <Plus className="h-3 w-3" />
              Salvar layout atual como nova view
            </button>
          </div>
        </div>
      </details>

      {showSaveDialog && (
        <SaveDialog
          name={newName}
          onNameChange={setNewName}
          shared={makeShared}
          onSharedChange={setMakeShared}
          isDefault={makeDefault}
          onDefaultChange={setMakeDefault}
          pending={pending}
          onSave={handleSave}
          onCancel={() => {
            setShowSaveDialog(false)
            setNewName('')
          }}
        />
      )}
    </div>
  )
}

function SaveDialog({
  name,
  onNameChange,
  shared,
  onSharedChange,
  isDefault,
  onDefaultChange,
  pending,
  onSave,
  onCancel,
}: {
  name: string
  onNameChange: (v: string) => void
  shared: boolean
  onSharedChange: (v: boolean) => void
  isDefault: boolean
  onDefaultChange: (v: boolean) => void
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] max-w-[calc(100vw-32px)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold tracking-tight">Salvar como nova view</h2>
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
          Layout atual + filtros viram um preset que você acessa depois.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-label text-[10px]">Nome da view *</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex: Performance criativos, Vendas pagas, Cohort 90d"
              maxLength={80}
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)]/5">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => onSharedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="flex-1">
              <span className="block font-medium text-[var(--color-fg)]">
                Compartilhar com workspace
              </span>
              <span className="block text-[11px] text-[var(--color-fg-muted)]">
                Todos os membros podem usar essa view.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)]/5">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => onDefaultChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span className="flex-1">
              <span className="block font-medium text-[var(--color-fg)]">
                Definir como minha view padrão
              </span>
              <span className="block text-[11px] text-[var(--color-fg-muted)]">
                Aparece automaticamente quando você abrir o dashboard.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-[12px] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !name.trim()}
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-1.5 text-[12px] font-medium text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {pending ? 'Salvando...' : 'Salvar view'}
          </button>
        </div>
      </div>
    </div>
  )
}
