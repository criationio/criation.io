import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, Plus, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typewriter } from '@/components/Typewriter'
import { resolveCurrentWorkspaceId } from '@/lib/auth/workspace'
import { getAnalysisById } from '@/lib/db/queries/analyses'
import { getBalanceForWorkspace } from '@/lib/db/queries/credits'
import { analysisQuickOutputSchema } from '@/lib/claude/validators/analysis-quick'
import { blocoTransicaoSchema, type BlocoTransicao } from '@/lib/validators/bloco-transicao'

import { RunningWatcher } from './RunningWatcher'
import { AnalysisActions } from './AnalysisActions'
import { DownloadMenu } from './DownloadMenu'
import type { ReportData } from './report-data'

export const revalidate = 0

const VERDICT_LABEL: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Forte', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  average: { label: 'Mediano', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  weak: { label: 'Fraco', cls: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' },
}

const SEVERITY: Record<string, { label: string; cls: string; border: string }> = {
  high: {
    label: 'Severidade alta',
    cls: 'text-[var(--color-danger)]',
    border: 'border-[var(--color-danger)]/40',
  },
  medium: {
    label: 'Severidade média',
    cls: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/40',
  },
  low: {
    label: 'Severidade baixa',
    cls: 'text-[var(--color-success)]',
    border: 'border-[var(--color-border)]',
  },
}

function fallbackName(createdAt: Date): string {
  return `Análise · ${formatDateTime(createdAt)}`
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatReais(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}
function formatInt(n: number | null | undefined): string {
  return n == null ? '—' : new Intl.NumberFormat('pt-BR').format(n)
}
function formatPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(2)}%`
}
function formatRoas(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(2)}×`
}

export default async function AnaliseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = await resolveCurrentWorkspaceId()
  if (!workspaceId) redirect('/login')

  const data = await getAnalysisById(workspaceId, id)
  if (!data) notFound()

  const { analysis, result } = data
  const isRunning = analysis.status === 'queued' || analysis.status === 'running'
  const isFailed = analysis.status === 'failed'
  const isCompleted = analysis.status === 'completed' && !!result

  const balanceRow = isCompleted ? await getBalanceForWorkspace(workspaceId) : null

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <Link
        href="/estudio/analisar"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Histórico
      </Link>

      <header className="flex items-center justify-between gap-3">
        <AnalysisActions
          analysisId={analysis.id}
          initialName={analysis.name}
          fallbackName={fallbackName(analysis.createdAt)}
        />
        <StatusBadge status={analysis.status} />
      </header>
      <p className="-mt-3 text-xs text-[var(--color-fg-subtle)]">
        Anúncio em vídeo · Quick · {formatDateTime(analysis.createdAt)}
      </p>

      {isRunning && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Analisando o criativo... isso leva ~30s. O resultado aparece aqui automaticamente.
          </p>
          <RunningWatcher analysisId={id} />
        </div>
      )}

      {isFailed && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-6 py-8">
          <div className="flex items-center gap-2 text-[var(--color-danger)]">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">A análise falhou</span>
          </div>
          <p className="text-sm text-[var(--color-fg-muted)]">
            {analysis.errorMessage ?? 'Erro desconhecido.'}
          </p>
        </div>
      )}

      {isCompleted && result && (
        <AnalysisReport
          resultData={result.resultData}
          inputSnapshot={result.inputSnapshot}
          creditsConsumed={analysis.creditsConsumed}
          balance={balanceRow?.balance ?? 0}
          title={analysis.name?.trim() || fallbackName(analysis.createdAt)}
          generatedAt={formatDateTime(analysis.createdAt)}
        />
      )}
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <Badge className="gap-1 bg-[var(--color-success-bg)] text-[var(--color-success)]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Concluída
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge className="gap-1 bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <XCircle className="h-3.5 w-3.5" /> Falhou
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executando
    </Badge>
  )
}

function AnalysisReport({
  resultData,
  inputSnapshot,
  creditsConsumed,
  balance,
  title,
  generatedAt,
}: {
  resultData: unknown
  inputSnapshot: unknown
  creditsConsumed: number
  balance: number
  title: string
  generatedAt: string
}) {
  const parsed = analysisQuickOutputSchema.safeParse(resultData)
  if (!parsed.success) {
    return (
      <p className="text-sm text-[var(--color-fg-muted)]">
        Resultado em formato inesperado. Tente refazer a análise.
      </p>
    )
  }
  const r = parsed.data
  const verdict = VERDICT_LABEL[r.verdict] ?? { label: r.verdict, cls: '' }
  const snapshot = blocoTransicaoSchema.safeParse(inputSnapshot)
  const severityKey = snapshot.success ? snapshot.data.bottleneckHint.severity : 'medium'
  const sev = SEVERITY[severityKey] ?? SEVERITY.medium!

  // Dados do relatório pra export (PDF/DOCX/JSON legível).
  const funnel: Array<{ label: string; value: string }> = snapshot.success
    ? [
        ['Impressões', formatInt(snapshot.data.funnelMetrics.impressions)],
        ['Cliques', formatInt(snapshot.data.funnelMetrics.clicks)],
        ['CTR', formatPct(snapshot.data.funnelMetrics.ctr)],
        ['Conversões', formatInt(snapshot.data.funnelMetrics.conversions)],
        ['Investimento', formatReais(snapshot.data.funnelMetrics.spend)],
        ['CPA', formatReais(snapshot.data.funnelMetrics.cpa)],
        ['ROAS', formatRoas(snapshot.data.funnelMetrics.roas)],
      ].map(([label, value]) => ({ label: label!, value: value! }))
    : []
  const reportData: ReportData = {
    title,
    generatedAt,
    verdict: verdict.label,
    score: r.score,
    summary: r.summary,
    bottleneck: {
      stage: r.bottleneck.stage,
      explanation: r.bottleneck.explanation,
      severity: sev.label.replace('Severidade ', ''),
    },
    strengths: r.strengths,
    weaknesses: r.weaknesses,
    recommendations: r.recommendations,
    funnel,
    campaignName: snapshot.success ? snapshot.data.campaignContext.name : null,
    copyText:
      snapshot.success &&
      snapshot.data.creativeData.copyText &&
      snapshot.data.creativeData.copyText !== '(sem texto de copy disponível)'
        ? snapshot.data.creativeData.copyText
        : null,
  }
  const fileBase =
    `analise-${title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'analise'

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header executivo — veredito + score + ações */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={verdict.cls}>{verdict.label}</Badge>
          <span className="text-sm text-[var(--color-fg-muted)]">
            Score: <span className="font-semibold text-[var(--color-fg)]">{r.score}/100</span>
          </span>
          <span className={`text-sm ${sev.cls}`}>
            Gargalo: {r.bottleneck.stage} · {sev.label.replace('Severidade ', '')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/estudio/analisar/nova">
              <Plus className="h-4 w-4" /> Nova análise
            </Link>
          </Button>
          <DownloadMenu report={reportData} rawJson={resultData} fileBase={fileBase} />
          {['Comparar', 'Modelar', 'Rodar novamente'].map((label) => (
            <Button key={label} variant="ghost" size="sm" disabled className="gap-1.5">
              {label} <span className="text-[10px]">em breve</span>
            </Button>
          ))}
        </div>
      </div>

      {/* 2. Resumo estratégico */}
      <Section title="Resumo estratégico">
        <p className="text-sm leading-relaxed text-[var(--color-fg)]">
          <Typewriter key={r.summary} text={r.summary} />
        </p>
      </Section>

      {/* 3. Diagnóstico — maior gargalo */}
      <div
        className={`flex flex-col gap-2 rounded-[var(--radius-lg)] border ${sev.border} bg-[var(--color-bg-elevated)] px-4 py-3`}
      >
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">
          Maior gargalo · {r.bottleneck.stage}{' '}
          <span className={`text-xs font-normal ${sev.cls}`}>({sev.label})</span>
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
          {r.bottleneck.explanation}
        </p>
      </div>

      {/* 4. Pontos fortes / fracos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {r.strengths.length > 0 && (
          <Section title="Pontos fortes">
            <BulletList items={r.strengths} markerCls="text-[var(--color-success)]" />
          </Section>
        )}
        {r.weaknesses.length > 0 && (
          <Section title="Pontos fracos">
            <BulletList items={r.weaknesses} markerCls="text-[var(--color-danger)]" />
          </Section>
        )}
      </div>

      {/* 5. Sugestões priorizadas */}
      {r.recommendations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">Sugestões priorizadas</h2>
          <div className="flex flex-col gap-2">
            {r.recommendations.map((rec, i) => (
              <SuggestionCard key={i} index={i} text={rec} />
            ))}
          </div>
        </div>
      )}

      {/* 6. Dados que a IA analisou (snapshot do BLOCO) */}
      {snapshot.success ? (
        <DataSection bloco={snapshot.data} />
      ) : (
        <Section title="Dados que a IA analisou">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Snapshot indisponível para esta análise (gerada antes do registro de dados).
          </p>
        </Section>
      )}

      {/* 7. Footer com saldo */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
        <span className="text-sm text-[var(--color-fg-muted)]">
          {creditsConsumed} {creditsConsumed === 1 ? 'crédito consumido' : 'créditos consumidos'}{' '}
          nesta análise · saldo atual:{' '}
          <span className="font-semibold text-[var(--color-fg)]">{balance}</span>
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/estudio/analisar/nova">
            <Plus className="h-4 w-4" /> Nova análise
          </Link>
        </Button>
      </div>
    </div>
  )
}

function SuggestionCard({ index, text }: { index: number; text: string }) {
  const prio =
    index === 0
      ? { tag: 'P1', cls: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' }
      : index === 1
        ? { tag: 'P2', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' }
        : { tag: 'P3', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' }
  return (
    <div className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
      <Badge className={`h-fit ${prio.cls}`} title="Prioridade sugerida">
        {prio.tag}
      </Badge>
      <p className="text-sm leading-relaxed text-[var(--color-fg)]">{text}</p>
    </div>
  )
}

function DataSection({ bloco }: { bloco: BlocoTransicao }) {
  const m = bloco.funnelMetrics
  const rows: Array<[string, string]> = [
    ['Impressões', formatInt(m.impressions)],
    ['Cliques', formatInt(m.clicks)],
    ['CTR', formatPct(m.ctr)],
    ['Conversões', formatInt(m.conversions)],
    ['Investimento', formatReais(m.spend)],
    ['CPA', formatReais(m.cpa)],
    ['ROAS', formatRoas(m.roas)],
  ]
  return (
    <Section title="Dados que a IA analisou">
      <p className="mb-1 text-xs text-[var(--color-fg-subtle)]">
        Snapshot do momento da análise · {bloco.campaignContext.name}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-[var(--color-fg-subtle)]">{label}</dt>
            <dd className="text-sm font-medium text-[var(--color-fg)]">{value}</dd>
          </div>
        ))}
      </dl>
      {bloco.creativeData.copyText &&
        bloco.creativeData.copyText !== '(sem texto de copy disponível)' && (
          <div className="mt-3 border-t border-[var(--color-border)] pt-3">
            <dt className="text-xs text-[var(--color-fg-subtle)]">Copy do criativo</dt>
            <p className="mt-1 text-sm whitespace-pre-line text-[var(--color-fg-muted)]">
              {bloco.creativeData.copyText}
            </p>
          </div>
        )}
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
      <h2 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h2>
      {children}
    </div>
  )
}

function BulletList({ items, markerCls }: { items: string[]; markerCls?: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-[var(--color-fg-muted)]">
          <span className={markerCls ?? 'text-[var(--color-primary)]'}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
