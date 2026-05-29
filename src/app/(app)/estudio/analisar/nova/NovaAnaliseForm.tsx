'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAnalysis, getCreativesForPicker } from '@/lib/actions/analysis'

export interface CampaignOption {
  id: string
  name: string
  status: string
}

export interface CreativeOption {
  id: string
  label: string
}

interface NovaAnaliseFormProps {
  campaigns: CampaignOption[]
  balance: number
  cost: number
}

const ASSET_TABS = [
  { key: 'video_ad', label: 'Anúncio em vídeo', enabled: true },
  { key: 'vsl', label: 'VSL', enabled: false },
  { key: 'sales_page', label: 'Página de vendas', enabled: false },
  { key: 'text_ad', label: 'Anúncio em texto', enabled: false },
] as const

export function NovaAnaliseForm({ campaigns, balance, cost }: NovaAnaliseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [campaignId, setCampaignId] = useState<string>('')
  const [creatives, setCreatives] = useState<CreativeOption[]>([])
  const [loadingCreatives, setLoadingCreatives] = useState(false)
  const [creativeId, setCreativeId] = useState<string>('')
  const [extraContext, setExtraContext] = useState('')
  const [error, setError] = useState<string | null>(null)

  const insufficientBalance = balance < cost

  async function handleCampaignChange(id: string) {
    setCampaignId(id)
    setCreativeId('')
    setCreatives([])
    setError(null)
    setLoadingCreatives(true)
    const res = await getCreativesForPicker(id)
    setLoadingCreatives(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setCreatives(
      res.data.map((c) => ({
        id: c.id,
        label: c.title?.trim() || c.adName?.trim() || `Criativo ${c.id.slice(0, 8)}`,
      }))
    )
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const res = await createAnalysis({
        assetType: 'video_ad',
        source: 'campaign',
        campaignId,
        creativeId,
        depth: 'quick',
        extraContext: extraContext.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      router.push(`/estudio/analisar/${res.data.analysisId}`)
    })
  }

  const canSubmit = !!campaignId && !!creativeId && !insufficientBalance && !isPending

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs tipo de ativo */}
      <div className="flex flex-wrap gap-2">
        {ASSET_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            disabled={!tab.enabled}
            className={[
              'rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors',
              tab.enabled
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-fg)]'
                : 'cursor-not-allowed border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
            ].join(' ')}
          >
            {tab.label}
            {!tab.enabled && <span className="ml-1.5 text-[10px]">em breve</span>}
          </button>
        ))}
      </div>

      {/* Origem: campanha conectada */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign">Campanha conectada (Meta)</Label>
        <Select value={campaignId} onValueChange={handleCampaignChange}>
          <SelectTrigger id="campaign">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campaigns.length === 0 && (
          <p className="text-xs text-[var(--color-fg-muted)]">
            Nenhuma campanha conectada. Conecte uma conta Meta em /campanhas primeiro.
          </p>
        )}
      </div>

      {/* Criativo */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="creative">Criativo</Label>
        <Select
          value={creativeId}
          onValueChange={setCreativeId}
          disabled={!campaignId || loadingCreatives}
        >
          <SelectTrigger id="creative">
            <SelectValue
              placeholder={
                loadingCreatives
                  ? 'Carregando criativos...'
                  : campaignId
                    ? 'Selecione um criativo'
                    : 'Escolha uma campanha primeiro'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {creatives.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campaignId && !loadingCreatives && creatives.length === 0 && (
          <p className="text-xs text-[var(--color-fg-muted)]">
            Esta campanha não tem criativos sincronizados.
          </p>
        )}
      </div>

      {/* Profundidade */}
      <div className="flex flex-col gap-2">
        <Label>Profundidade</Label>
        <div className="flex gap-2">
          <span className="rounded-[var(--radius-md)] border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-2 text-sm text-[var(--color-fg)]">
            Quick · ~30s
          </span>
          <span className="cursor-not-allowed rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg-subtle)]">
            Deep <span className="ml-1 text-[10px]">em breve</span>
          </span>
        </div>
      </div>

      {/* Contexto adicional */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="extra">O que a IA deve observar especialmente? (opcional)</Label>
        <textarea
          id="extra"
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Ex: acho que meu CTA está fraco; vale escalar pro Google Ads?"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:ring-2 focus:ring-[var(--color-primary)] focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {/* Preview de custo + executar */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <div className="text-sm text-[var(--color-fg-muted)]">
          Custo:{' '}
          <span className="font-medium text-[var(--color-fg)]">
            {cost} {cost === 1 ? 'crédito' : 'créditos'}
          </span>{' '}
          · ~30s · saldo:{' '}
          <span
            className={
              insufficientBalance ? 'text-[var(--color-danger)]' : 'text-[var(--color-fg)]'
            }
          >
            {balance}
          </span>
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Iniciando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Executar análise
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
