'use client'

import { Image as ImageIcon, Video } from 'lucide-react'

import type { CampaignCreative } from '@/lib/db/queries/campaign-detail'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('pt-BR')

export function CreativesGallery({ creatives }: { creatives: CampaignCreative[] }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Criativos</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Anúncios ordenados por gasto no período. Thumbnails carregados direto da plataforma.
        </p>
      </header>

      {creatives.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-8 text-center">
          <p className="text-xs text-[var(--color-fg-muted)]">
            Nenhum criativo sincronizado pra essa campanha.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {creatives.map((c) => (
            <CreativeCard key={c.id} creative={c} />
          ))}
        </div>
      )}
    </section>
  )
}

function CreativeCard({ creative }: { creative: CampaignCreative }) {
  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors hover:border-[var(--color-border-strong)]">
      <div className="relative aspect-square bg-[var(--color-bg-subtle)]">
        {creative.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnailUrl}
            alt={creative.title ?? creative.adName ?? 'Criativo'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-fg-subtle)]">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        {creative.videoUrl && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <Video className="h-2.5 w-2.5" />
            Vídeo
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-2.5">
        <p
          className="line-clamp-2 text-[11px] font-medium text-[var(--color-fg)]"
          title={creative.title ?? creative.adName ?? ''}
        >
          {creative.title ?? creative.adName ?? '—'}
        </p>
        <div className="flex items-center justify-between text-[10px] text-[var(--color-fg-muted)]">
          <span className="font-tabular">{BRL.format(creative.spendCents / 100)}</span>
          <span className="font-tabular">
            CTR {creative.ctrPct !== null ? `${creative.ctrPct.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="text-[10px] text-[var(--color-fg-subtle)]">
          {NUM.format(creative.impressions)} impr · {NUM.format(creative.clicks)} cliques
        </div>
      </div>
    </article>
  )
}
