'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createUtmMapping, deleteUtmMapping, type UtmMappingRow } from '@/lib/actions/utm-mappings'

interface Props {
  initialMappings: UtmMappingRow[]
  ads: Array<{ id: string; label: string }>
}

export function UtmMappingsClient({ initialMappings, ads }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(initialMappings.length === 0)

  function handleDelete(id: string) {
    if (
      !confirm(
        'Remover este mapeamento? Vendas futuras com essa UTM voltam a ser stitched automaticamente.'
      )
    )
      return
    startTransition(async () => {
      const result = await deleteUtmMapping(id)
      if (!result.ok) {
        toast.error('Falha ao remover', { description: result.error.message })
        return
      }
      toast.success('Mapping removido')
      router.refresh()
    })
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const adId = formData.get('adId') as string
      const result = await createUtmMapping({
        adId,
        utmSource: (formData.get('utmSource') as string) || null,
        utmMedium: (formData.get('utmMedium') as string) || null,
        utmCampaign: (formData.get('utmCampaign') as string) || null,
        utmContent: (formData.get('utmContent') as string) || null,
        utmTerm: (formData.get('utmTerm') as string) || null,
        confidenceScore: 1,
      })
      if (!result.ok) {
        toast.error('Falha ao criar', { description: result.error.message })
        return
      }
      toast.success('Mapping criado')
      setShowForm(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-fg-muted)]">
          {initialMappings.length} mapping{initialMappings.length === 1 ? '' : 's'} ativo
          {initialMappings.length === 1 ? '' : 's'}
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-xs font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-3 w-3" />
            Novo mapping
          </button>
        )}
      </div>

      {showForm && (
        <form
          action={handleCreate}
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
        >
          <h3 className="mb-3 text-sm font-medium">Criar mapping manual</h3>
          <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
            Preencha apenas os campos UTM que você usa. Combinação de UTMs preenchidos vira a chave
            de match. Vazios são ignorados.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="utmSource" label="utm_source" placeholder="ex: meta" />
            <Field name="utmMedium" label="utm_medium" placeholder="ex: cpc" />
            <Field name="utmCampaign" label="utm_campaign" placeholder="ex: BF" />
            <Field name="utmContent" label="utm_content" placeholder="ex: vsl-rosa" />
            <Field name="utmTerm" label="utm_term" placeholder="ex: black-friday" />
          </div>

          <label className="mt-4 block text-xs">
            <span className="mb-1 block text-[var(--color-fg-muted)]">Anúncio destino</span>
            <select
              name="adId"
              required
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs"
            >
              <option value="">Selecione…</option>
              {ads.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-xs font-medium text-[var(--color-fg-on-accent)] disabled:opacity-50"
            >
              {isPending ? 'Salvando…' : 'Criar mapping'}
            </button>
          </div>
        </form>
      )}

      {initialMappings.length === 0 ? (
        !showForm && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Nenhum mapping criado ainda. O stitcher tenta match automático por nome de campanha.
            </p>
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-elevated)]">
              <tr className="border-b border-[var(--color-border)]">
                <Th>UTM source/medium</Th>
                <Th>UTM campaign</Th>
                <Th>UTM content/term</Th>
                <Th>Anúncio</Th>
                <Th>Conf.</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {initialMappings.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elevated)]"
                >
                  <Td mono>{[m.utmSource, m.utmMedium].filter(Boolean).join(' / ') || '—'}</Td>
                  <Td mono>{m.utmCampaign ?? '—'}</Td>
                  <Td mono>{[m.utmContent, m.utmTerm].filter(Boolean).join(' / ') || '—'}</Td>
                  <Td>
                    {m.campaignName} → {m.adName}
                  </Td>
                  <Td>{m.confidenceScore ?? '1.0'}</Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => handleDelete(m.id)}
                      disabled={isPending}
                      className="text-[var(--color-danger)] hover:text-[var(--color-danger-strong)] disabled:opacity-50"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-mono text-[var(--color-fg-muted)]">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 font-mono text-xs"
      />
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
      {children}
    </th>
  )
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 ${mono ? 'font-mono' : ''}`}>{children}</td>
}
