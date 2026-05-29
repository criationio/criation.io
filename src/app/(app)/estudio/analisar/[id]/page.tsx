import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Typewriter } from '@/components/Typewriter'
import { resolveCurrentWorkspaceId } from '@/lib/auth/workspace'
import { getAnalysisById } from '@/lib/db/queries/analyses'
import { analysisQuickOutputSchema } from '@/lib/claude/validators/analysis-quick'

import { RunningWatcher } from './RunningWatcher'

export const revalidate = 0

const VERDICT_LABEL: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Forte', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  average: { label: 'Mediano', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
  weak: { label: 'Fraco', cls: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' },
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <Link
        href="/estudio/analisar"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Histórico
      </Link>

      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">
          Análise de criativo
        </h1>
        <StatusBadge status={analysis.status} />
      </header>

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

      {analysis.status === 'completed' && result && (
        <AnalysisReport resultData={result.resultData} />
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

/**
 * Render MVP do resultado (Sessão 1.9). O relatório rico de 8 seções vem na
 * Sessão 1.11; aqui mostramos os campos do schema Quick de forma simples.
 */
function AnalysisReport({ resultData }: { resultData: unknown }) {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Badge className={verdict.cls}>{verdict.label}</Badge>
        <span className="text-sm text-[var(--color-fg-muted)]">
          Score: <span className="font-semibold text-[var(--color-fg)]">{r.score}/100</span>
        </span>
      </div>

      <p className="text-sm leading-relaxed text-[var(--color-fg)]">
        <Typewriter key={r.summary} text={r.summary} />
      </p>

      <Section title={`Maior gargalo · ${r.bottleneck.stage}`}>
        <p className="text-sm text-[var(--color-fg-muted)]">{r.bottleneck.explanation}</p>
      </Section>

      {r.strengths.length > 0 && (
        <Section title="Pontos fortes">
          <BulletList items={r.strengths} />
        </Section>
      )}

      {r.weaknesses.length > 0 && (
        <Section title="Pontos fracos">
          <BulletList items={r.weaknesses} />
        </Section>
      )}

      {r.recommendations.length > 0 && (
        <Section title="Recomendações">
          <BulletList items={r.recommendations} />
        </Section>
      )}
    </div>
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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-[var(--color-fg-muted)]">
          <span className="text-[var(--color-primary)]">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
