'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createUtmMappingsBulk,
  deleteUtmMapping,
  type UtmMappingRow,
} from '@/lib/actions/utm-mappings'
import { updateUtmConvention, type UtmConvention } from '@/lib/actions/utm-convention'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  initialMappings: UtmMappingRow[]
  ads: Array<{ id: string; label: string }>
  convention: UtmConvention
}

/** Snippet ouro Meta Ads — pacote universal recomendado por Stape/Hyros/Triple Whale. */
const META_URL_PARAMS =
  'utm_source=meta&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}'

export function UtmMappingsClient({ initialMappings, ads, convention }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(initialMappings.length === 0)
  const [conv, setConv] = useState(convention)
  const [showSnippetDialog, setShowSnippetDialog] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Estado simplificado: auto-rastreamento ligado = campaign + content
  // (utm_term/adset fica em avançado pra quem quer granularidade extra)
  const autoTrackingOn = conv.usesCampaignNamePlaceholder && conv.usesAdNameAsContent

  function persistConvention(next: UtmConvention) {
    setConv(next)
    startTransition(async () => {
      const r = await updateUtmConvention(next)
      if (!r.ok) {
        toast.error('Falha ao salvar', { description: r.error.message })
        setConv(conv)
        return
      }
    })
  }

  function toggleAutoTracking() {
    const turningOn = !autoTrackingOn
    const next = {
      ...conv,
      usesCampaignNamePlaceholder: turningOn,
      usesAdNameAsContent: turningOn,
    }
    persistConvention(next)
    toast.success(turningOn ? 'Auto-rastreamento ativado' : 'Auto-rastreamento desativado')
  }

  function toggleAdvanced(key: keyof UtmConvention) {
    persistConvention({ ...conv, [key]: !conv[key] })
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
      <ConventionCard
        autoTrackingOn={autoTrackingOn}
        onToggleAuto={toggleAutoTracking}
        onOpenSnippet={() => setShowSnippetDialog(true)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((s) => !s)}
        convention={conv}
        onToggleAdvancedField={toggleAdvanced}
        disabled={isPending}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium">Mappings manuais</h2>
            <p className="text-xs text-[var(--color-fg-muted)]">
              {initialMappings.length === 0
                ? 'Crie mapping só quando suas UTMs não seguem a convenção padrão.'
                : `${initialMappings.length} mapping${initialMappings.length === 1 ? '' : 's'} ativo${initialMappings.length === 1 ? '' : 's'}`}
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
                Nenhum mapping criado. Com auto-rastreamento ativado, o sistema resolve a maioria
                das atribuições sozinho.
              </p>
            </div>
          )
        ) : (
          <MappingsTable rows={initialMappings} onDelete={handleDelete} disabled={isPending} />
        )}
      </section>

      <SnippetDialog
        open={showSnippetDialog}
        onClose={() => setShowSnippetDialog(false)}
        snippet={META_URL_PARAMS}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Convention card — UX simplificada (1 toggle primário + avançado opcional)
// ---------------------------------------------------------------------------

function ConventionCard({
  autoTrackingOn,
  onToggleAuto,
  onOpenSnippet,
  showAdvanced,
  onToggleAdvanced,
  convention,
  onToggleAdvancedField,
  disabled,
}: {
  autoTrackingOn: boolean
  onToggleAuto: () => void
  onOpenSnippet: () => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
  convention: UtmConvention
  onToggleAdvancedField: (key: keyof UtmConvention) => void
  disabled: boolean
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border bg-[var(--color-bg-elevated)] p-5 ${
        autoTrackingOn
          ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]/10'
          : 'border-[var(--color-border)]'
      }`}
    >
      <div className="flex items-start gap-4">
        <Toggle checked={autoTrackingOn} onChange={onToggleAuto} disabled={disabled} />

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Auto-rastreamento Meta Ads</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-muted)]">
            {autoTrackingOn
              ? 'Suas vendas Meta são atribuídas automaticamente a campanha + criativo. Resolve 95% dos casos sem mapping manual.'
              : 'Ative para atribuir automaticamente cada venda à campanha e criativo Meta correspondentes.'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenSnippet}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-xs font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
            >
              <Copy className="h-3 w-3" />
              Copiar configuração pra Meta
            </button>
            <button
              type="button"
              onClick={onToggleAdvanced}
              className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-3 text-xs text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              Avançado
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {showAdvanced && (
            <div className="mt-5 space-y-2 border-t border-[var(--color-border)] pt-4">
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                Ajuste fino do que o stitcher reconhece. Só mude se você tem setup customizado de
                UTMs no Meta.
              </p>
              <AdvancedRow
                checked={convention.usesCampaignNamePlaceholder}
                onChange={() => onToggleAdvancedField('usesCampaignNamePlaceholder')}
                disabled={disabled}
                code="utm_campaign={{campaign.name}}"
                desc="Necessário pra match por nome de campanha. Desligar quebra atribuição automática."
              />
              <AdvancedRow
                checked={convention.usesAdNameAsContent}
                onChange={() => onToggleAdvancedField('usesAdNameAsContent')}
                disabled={disabled}
                code="utm_content={{ad.name}}"
                desc="Permite ver qual criativo converteu (necessário pra Hook Rate vs Receita)."
              />
              <AdvancedRow
                checked={convention.usesAdSetNameAsTerm}
                onChange={() => onToggleAdvancedField('usesAdSetNameAsTerm')}
                disabled={disabled}
                code="utm_term={{adset.name}}"
                desc="Granularidade até conjunto de anúncios. Raramente usado em Meta."
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border-strong)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  )
}

function AdvancedRow({
  checked,
  onChange,
  disabled,
  code,
  desc,
}: {
  checked: boolean
  onChange: () => void
  disabled: boolean
  code: string
  desc: string
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
        <code className="block font-mono text-[11px] text-[var(--color-fg)]">{code}</code>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          {desc}
        </span>
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Snippet dialog — passo-a-passo de configuração no Meta Ads
// ---------------------------------------------------------------------------

function SnippetDialog({
  open,
  onClose,
  snippet,
}: {
  open: boolean
  onClose: () => void
  snippet: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-[var(--color-fg)]">
            Configurar URL parameters no Meta Ads
          </DialogTitle>
          <DialogDescription className="text-[var(--color-fg-muted)]">
            Esta configuração é colada uma vez na sua conta de anúncios e vale pra todas as
            campanhas atuais e futuras. Não precisa repetir por campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Step
            n={1}
            title="Copie o snippet abaixo"
            body={
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-2">
                <code className="flex-1 font-mono text-[11px] break-all text-[var(--color-fg)]">
                  {snippet}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)]"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            }
          />

          <Step
            n={2}
            title="Abra o Meta Ads Manager"
            body={
              <a
                href="https://business.facebook.com/adsmanager/manage/accounts"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)]"
              >
                Abrir Meta Ads Manager
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />

          <Step
            n={3}
            title="Configure em cada campanha"
            body={
              <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
                Edite a campanha → seção{' '}
                <strong className="text-[var(--color-fg)]">Rastreamento</strong> → campo{' '}
                <strong className="text-[var(--color-fg)]">Parâmetros de URL</strong> → cole o
                snippet → publicar. O Meta substitui{' '}
                <code className="rounded bg-[var(--color-bg-muted)] px-1 font-mono text-[var(--color-fg)]">
                  {'{{campaign.name}}'}
                </code>{' '}
                e{' '}
                <code className="rounded bg-[var(--color-bg-muted)] px-1 font-mono text-[var(--color-fg)]">
                  {'{{ad.name}}'}
                </code>{' '}
                dinamicamente em cada impressão.
              </p>
            }
          />

          <Step
            n={4}
            title="Verifique no Criation"
            body={
              <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
                Após a próxima venda, vá em{' '}
                <strong className="text-[var(--color-fg)]">Dashboard</strong> e veja se a venda
                aparece atribuída à campanha correta. Latência ~1-2s após o webhook chegar.
              </p>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-medium text-[var(--color-fg-on-accent)]">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-[var(--color-fg)]">{title}</p>
        {body}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bulk mapping form — simplificado: 1 campo default + avançado expandível
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
  const [showAdvanced, setShowAdvanced] = useState(false)

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
        utmCampaign: (formData.get('utmCampaign') as string) || null,
        utmSource: (formData.get('utmSource') as string) || null,
        utmMedium: (formData.get('utmMedium') as string) || null,
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
        Mapping manual cobre casos onde sua UTM não bate com o nome da campanha. Use só pra UTM
        custom (ex: você usa <code className="font-mono">utm_campaign=BF</code> mas a campanha Meta
        se chama &ldquo;Black Friday 2026 - VSL&rdquo;).
      </p>

      <Field name="utmCampaign" label="utm_campaign que chega do gateway" placeholder="ex: BF" />

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="mt-3 inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
      >
        Avançado: source, medium, content, term
        <ChevronDown
          className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
        />
      </button>

      {showAdvanced && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field name="utmSource" label="utm_source" placeholder="ex: meta" />
          <Field name="utmMedium" label="utm_medium" placeholder="ex: cpc" />
          <Field name="utmContent" label="utm_content" placeholder="ex: vsl-rosa" />
          <Field name="utmTerm" label="utm_term" placeholder="ex: adset-mulheres-30" />
        </div>
      )}

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
            <Th>UTM campaign</Th>
            <Th>Outras UTMs</Th>
            <Th>Anúncio</Th>
            <Th>{''}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const others = [
              m.utmSource && `source=${m.utmSource}`,
              m.utmMedium && `medium=${m.utmMedium}`,
              m.utmContent && `content=${m.utmContent}`,
              m.utmTerm && `term=${m.utmTerm}`,
            ].filter(Boolean)
            return (
              <tr
                key={m.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-elevated)]"
              >
                <Td mono>{m.utmCampaign ?? '—'}</Td>
                <Td mono>{others.length > 0 ? others.join(' · ') : '—'}</Td>
                <Td>
                  {m.campaignName} → {m.adName}
                </Td>
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-[var(--color-fg-muted)]">{label}</span>
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
