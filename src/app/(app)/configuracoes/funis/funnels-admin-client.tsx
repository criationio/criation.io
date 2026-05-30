'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Filter, Plus, Star, Trash2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  createDashboardFunnelAction,
  deleteDashboardFunnelAction,
  setDefaultDashboardFunnelAction,
  updateDashboardFunnelAction,
} from '@/lib/actions/dashboard-funnels'

export interface AdminFunnel {
  id: string
  name: string
  description: string | null
  landingUrlPattern: string | null
  utmCampaignPattern: string | null
  productIds: string[]
  isDefault: boolean
}

interface AdminFunnelsClientProps {
  funnels: AdminFunnel[]
  products: { id: string; name: string }[]
}

/**
 * Tabela + dialog de CRUD pros funis nomeados (PR-13c).
 *
 * Server Component pai lista funis + produtos do workspace; este componente
 * mostra tabela + abre dialog pra criar/editar. Server Actions persistem.
 */
export function FunnelsAdminClient({ funnels, products }: AdminFunnelsClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<AdminFunnel | null>(null)
  const [creating, setCreating] = useState(false)

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este funil? Views/dashboards que dependem dele perdem o filtro.')) return
    startTransition(async () => {
      await deleteDashboardFunnelAction({ id })
      router.refresh()
    })
  }

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      await setDefaultDashboardFunnelAction({ id })
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo funil
        </button>
      </div>

      {funnels.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
              <tr className="text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">UTM pattern</th>
                <th className="px-4 py-3">Landing pattern</th>
                <th className="px-4 py-3">Produtos</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funnels.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-subtle)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {f.isDefault && (
                        <Star className="h-3.5 w-3.5 fill-current text-[var(--color-accent)]" />
                      )}
                      <div>
                        <div className="font-medium text-[var(--color-fg)]">{f.name}</div>
                        {f.description && (
                          <div className="text-[11px] text-[var(--color-fg-muted)]">
                            {f.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="font-tabular px-4 py-3 text-xs text-[var(--color-fg-muted)]">
                    {f.utmCampaignPattern || '—'}
                  </td>
                  <td className="font-tabular px-4 py-3 text-xs text-[var(--color-fg-muted)]">
                    {f.landingUrlPattern || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--color-fg-muted)]">
                      {f.productIds.length} produto{f.productIds.length === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!f.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(f.id)}
                          disabled={pending}
                          className="rounded-sm p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-accent)]"
                          title="Definir como padrão"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(f)}
                        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        disabled={pending}
                        className="rounded-sm p-1 text-[var(--color-fg-subtle)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-danger)]"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <FunnelDialog
          funnel={editing}
          products={products}
          pending={pending}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={(values) => {
            startTransition(async () => {
              const result = editing
                ? await updateDashboardFunnelAction({ id: editing.id, ...values })
                : await createDashboardFunnelAction(values)
              if (result.ok) {
                setCreating(false)
                setEditing(null)
                router.refresh()
              }
            })
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
        <Filter className="h-5 w-5" />
      </div>
      <div className="max-w-md">
        <h3 className="text-base font-semibold tracking-tight">Nenhum funil nomeado ainda</h3>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Crie funis nomeados pra agrupar produtos + UTMs + landing pages que pertencem a uma mesma
          jornada. Vira filtro no dashboard de 1 clique.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)]"
      >
        <Plus className="h-3.5 w-3.5" />
        Criar primeiro funil
      </button>
    </div>
  )
}

interface FunnelDialogProps {
  funnel: AdminFunnel | null
  products: { id: string; name: string }[]
  pending: boolean
  onClose: () => void
  onSubmit: (values: {
    name: string
    description: string
    landingUrlPattern: string
    utmCampaignPattern: string
    productIds: string[]
    makeDefault?: boolean
  }) => void
}

function FunnelDialog({ funnel, products, pending, onClose, onSubmit }: FunnelDialogProps) {
  const [name, setName] = useState(funnel?.name ?? '')
  const [description, setDescription] = useState(funnel?.description ?? '')
  const [landingUrlPattern, setLandingUrlPattern] = useState(funnel?.landingUrlPattern ?? '')
  const [utmCampaignPattern, setUtmCampaignPattern] = useState(funnel?.utmCampaignPattern ?? '')
  const [productIds, setProductIds] = useState<string[]>(funnel?.productIds ?? [])
  const [makeDefault, setMakeDefault] = useState(funnel?.isDefault ?? false)

  const toggleProduct = (id: string) => {
    setProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[560px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {funnel ? 'Editar funil' : 'Novo funil'}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Defina critérios — qualquer evento que bater nos patterns vira parte desse funil.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-label text-[10px]">Nome *</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: VSL Emagrecimento"
              maxLength={120}
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-label text-[10px]">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Tráfego pago Meta + Google → landing carta de vendas → checkout Hotmart"
              maxLength={500}
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-label text-[10px]">UTM campaign pattern</label>
              <input
                type="text"
                value={utmCampaignPattern}
                onChange={(e) => setUtmCampaignPattern(e.target.value)}
                placeholder="vsl-emag-*"
                className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-xs text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                Use <code>*</code> como wildcard. Vazio = aceita qualquer.
              </p>
            </div>
            <div>
              <label className="text-label text-[10px]">Landing URL pattern</label>
              <input
                type="text"
                value={landingUrlPattern}
                onChange={(e) => setLandingUrlPattern(e.target.value)}
                placeholder="emagrecimento.dominio.com/*"
                className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-xs text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">
                Pattern de página de origem do evento.
              </p>
            </div>
          </div>

          <div>
            <label className="text-label text-[10px]">Produtos do funil</label>
            {products.length === 0 ? (
              <p className="mt-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3 text-xs text-[var(--color-fg-muted)]">
                Nenhum produto mapeado no workspace. Conecte um gateway pra popular.
              </p>
            ) : (
              <div className="mt-1 max-h-[200px] space-y-1 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg-subtle)]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {!funnel && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)]/5">
              <input
                type="checkbox"
                checked={makeDefault}
                onChange={(e) => setMakeDefault(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span className="flex-1">
                <span className="block font-medium text-[var(--color-fg)]">
                  Definir como padrão
                </span>
                <span className="block text-[11px] text-[var(--color-fg-muted)]">
                  Aparece pré-selecionado no dropdown do dashboard.
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() =>
              onSubmit({
                name,
                description,
                landingUrlPattern,
                utmCampaignPattern,
                productIds,
                makeDefault,
              })
            }
            className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {pending ? 'Salvando...' : funnel ? 'Salvar alterações' : 'Criar funil'}
          </button>
        </div>
      </div>
    </div>
  )
}
