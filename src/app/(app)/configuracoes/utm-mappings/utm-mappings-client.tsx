'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Check, Info, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createUtmMappingsBulk,
  deleteUtmMapping,
  type UtmMappingRow,
} from '@/lib/actions/utm-mappings'
import { updateUtmConvention, type UtmConvention } from '@/lib/actions/utm-convention'

interface Props {
  initialMappings: UtmMappingRow[]
  ads: Array<{ id: string; label: string }>
  convention: UtmConvention
}

export function UtmMappingsClient({ initialMappings, ads, convention }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(initialMappings.length === 0)
  const [conv, setConv] = useState(convention)

  function toggleConv(key: keyof UtmConvention) {
    const next = { ...conv, [key]: !conv[key] }
    setConv(next)
    startTransition(async () => {
      const r = await updateUtmConvention(next)
      if (!r.ok) {
        toast.error('Falha ao salvar', { description: r.error.message })
        setConv(conv) // rollback
        return
      }
      toast.success('Convenção atualizada')
    })
  }

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

  return (
    <div className="space-y-8">
      <ConventionCard convention={conv} onToggle={toggleConv} disabled={isPending} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium">Mappings manuais</h2>
            <p className="text-xs text-[var(--color-fg-muted)]">
              {initialMappings.length} mapping{initialMappings.length === 1 ? '' : 's'} ativo
              {initialMappings.length === 1 ? '' : 's'}
            </p>
          </div>
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
          <BulkMappingForm
            ads={ads}
            onCancel={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false)
              router.refresh()
            }}
          />
        )}

        {initialMappings.length === 0 ? (
          !showForm && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
              <p className="text-sm text-[var(--color-fg-muted)]">
                Nenhum mapping criado ainda. Se sua convenção está ativada, o stitcher já resolve a
                maioria dos casos automaticamente.
              </p>
            </div>
          )
        ) : (
          <MappingsTable rows={initialMappings} onDelete={handleDelete} disabled={isPending} />
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Convention card
// ---------------------------------------------------------------------------

function ConventionCard({
  convention,
  onToggle,
  disabled,
}: {
  convention: UtmConvention
  onToggle: (key: keyof UtmConvention) => void
  disabled: boolean
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <div className="mb-3 flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-info)]" />
        <div>
          <h2 className="text-sm font-medium">Convenção do workspace</h2>
          <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
            Declare como você usa UTMs nos seus anúncios. Quando você marca uma convenção, o
            stitcher confia nela e ignora mappings manuais redundantes.{' '}
            <strong>95% dos casos são resolvidos só com convenção</strong> — mappings manuais ficam
            pra UTMs custom.
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-6">
        <ConventionRow
          checked={convention.usesCampaignNamePlaceholder}
          onChange={() => onToggle('usesCampaignNamePlaceholder')}
          disabled={disabled}
          title="Uso {{campaign.name}} no Meta Ads"
          desc={
            <>
              <code className="font-mono">utm_campaign</code> no URL Parameters do Meta Ads
              substitui dinamicamente pelo nome real da campanha. Stitcher faz match perfeito por
              nome (case + acentos + separadores agnostic).
            </>
          }
        />
        <ConventionRow
          checked={convention.usesAdSetNameAsTerm}
          onChange={() => onToggle('usesAdSetNameAsTerm')}
          disabled={disabled}
          title="Uso {{adset.name}} como utm_term"
          desc={
            <>
              Permite refinar a atribuição até o nível de conjunto de anúncios. Sem isso, todas as
              vendas de uma campanha colapsam no nível de campanha.
            </>
          }
        />
        <ConventionRow
          checked={convention.usesAdNameAsContent}
          onChange={() => onToggle('usesAdNameAsContent')}
          disabled={disabled}
          title="Uso {{ad.name}} como utm_content"
          desc={
            <>
              Permite ver qual criativo específico está convertendo. Necessário para análise de Hook
              Rate vs Receita por anúncio.
            </>
          }
        />
      </div>
    </section>
  )
}

function ConventionRow({
  checked,
  onChange,
  disabled,
  title,
  desc,
}: {
  checked: boolean
  onChange: () => void
  disabled: boolean
  title: string
  desc: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-transparent p-2 transition hover:border-[var(--color-border)] hover:bg-[var(--color-bg)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          {desc}
        </span>
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Bulk mapping form
// ---------------------------------------------------------------------------

function BulkMappingForm({
  ads,
  onCancel,
  onCreated,
}: {
  ads: Array<{ id: string; label: string }>
  onCancel: () => void
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedAds, setSelectedAds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const filteredAds = useMemo(() => {
    if (!filter.trim()) return ads
    const q = filter.toLowerCase()
    return ads.filter((a) => a.label.toLowerCase().includes(q))
  }, [ads, filter])

  function toggleAd(id: string) {
    setSelectedAds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedAds(new Set(filteredAds.map((a) => a.id)))
  }

  function clearAll() {
    setSelectedAds(new Set())
  }

  function handleSubmit(formData: FormData) {
    if (selectedAds.size === 0) {
      toast.error('Selecione ao menos 1 anúncio')
      return
    }
    startTransition(async () => {
      const result = await createUtmMappingsBulk({
        adIds: Array.from(selectedAds),
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
      toast.success(
        `${result.data.count} mapping${result.data.count === 1 ? '' : 's'} criado${
          result.data.count === 1 ? '' : 's'
        }`
      )
      onCreated()
    })
  }

  return (
    <form
      action={handleSubmit}
      className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      <h3 className="mb-1 text-sm font-medium">Criar mapping em massa</h3>
      <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
        Defina a combinação de UTMs uma vez e aplique a vários anúncios. Útil quando subiu N
        anúncios com o mesmo padrão de UTM. Vazios são ignorados — só UTMs preenchidas viram a chave
        de match.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="utmSource" label="utm_source" placeholder="ex: meta" />
        <Field name="utmMedium" label="utm_medium" placeholder="ex: cpc" />
        <Field name="utmCampaign" label="utm_campaign" placeholder="ex: BF" />
        <Field name="utmContent" label="utm_content" placeholder="ex: vsl-rosa" />
        <Field name="utmTerm" label="utm_term" placeholder="ex: black-friday" />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">
            Anúncios destino · {selectedAds.size} de {ads.length} selecionados
          </span>
          <div className="flex gap-2 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="text-[var(--color-accent)] hover:underline"
            >
              Selecionar tudo
            </button>
            <span className="text-[var(--color-fg-subtle)]">·</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[var(--color-fg-muted)] hover:underline"
            >
              Limpar
            </button>
          </div>
        </div>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar anúncios…"
          className="mb-2 h-8 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs"
        />

        <div className="max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
          {filteredAds.length === 0 ? (
            <p className="p-3 text-center text-xs text-[var(--color-fg-subtle)]">
              {ads.length === 0
                ? 'Nenhum anúncio ativo. Conecte Meta Ads e sincronize campanhas primeiro.'
                : 'Nenhum anúncio bate com o filtro.'}
            </p>
          ) : (
            filteredAds.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5 last:border-0 hover:bg-[var(--color-bg-hover)]"
              >
                <input
                  type="checkbox"
                  checked={selectedAds.has(a.id)}
                  onChange={() => toggleAd(a.id)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-accent)]"
                />
                <span className="truncate text-xs">{a.label}</span>
                {selectedAds.has(a.id) && (
                  <Check className="ml-auto h-3 w-3 text-[var(--color-accent)]" />
                )}
              </label>
            ))
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || selectedAds.size === 0}
          className="h-8 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-xs font-medium text-[var(--color-fg-on-accent)] disabled:opacity-50"
        >
          {isPending
            ? 'Salvando…'
            : `Criar ${selectedAds.size} mapping${selectedAds.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Mappings table
// ---------------------------------------------------------------------------

function MappingsTable({
  rows,
  onDelete,
  disabled,
}: {
  rows: UtmMappingRow[]
  onDelete: (id: string) => void
  disabled: boolean
}) {
  return (
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
          {rows.map((m) => (
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
                  onClick={() => onDelete(m.id)}
                  disabled={disabled}
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
