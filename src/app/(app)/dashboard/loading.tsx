/**
 * Skeleton de loading do /dashboard (PR-14).
 *
 * Next.js App Router renderiza esse arquivo durante a transicao da rota
 * (primeira navegacao + revalidacao de search params em alguns casos).
 * Imitar layout principal pra evitar layout shift: header + filtros bar +
 * 6 KPI cards + funil + chart + 2 tables + 2 widgets large.
 */
export default function DashboardLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
          <div className="h-4 w-64 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)]" />
      </header>

      {/* Filters bar */}
      <div className="sticky top-14 z-20 -mx-6 mb-2 flex gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-6 py-3 backdrop-blur-md">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)]"
          />
        ))}
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} height={140} />
        ))}
      </div>

      {/* Funil + chart row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkeletonCard height={460} />
        <SkeletonCard height={460} />
      </div>

      {/* Creatives + channel mix row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <SkeletonCard height={400} />
        <SkeletonCard height={400} />
      </div>

      {/* UTM + cohort row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SkeletonCard height={400} />
        <SkeletonCard height={400} />
      </div>
    </main>
  )
}

function SkeletonCard({ height }: { height: number }) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
      style={{ height }}
    >
      <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-bg-subtle)]" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-[var(--color-bg-subtle)]" />
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  )
}
