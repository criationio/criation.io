'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { totalPages as computeTotalPages } from '@/lib/campanhas/comparison'

interface CampanhasPaginationProps {
  total: number
  pageSize: number
  currentPage: number
}

export function CampanhasPagination({ total, pageSize, currentPage }: CampanhasPaginationProps) {
  const searchParams = useSearchParams()
  const totalPages = computeTotalPages(total, pageSize)

  if (totalPages <= 1) return null

  function pageUrl(page: number): string {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) params.delete('page')
    else params.set('page', String(page))
    return `/campanhas?${params.toString()}`
  }

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  return (
    <nav
      aria-label="Paginação"
      className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-fg-muted)]"
    >
      <span>
        Mostrando <span className="font-medium text-[var(--color-fg)]">{start}</span>–
        <span className="font-medium text-[var(--color-fg)]">{end}</span> de{' '}
        <span className="font-medium text-[var(--color-fg)]">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <PageLink
          href={pageUrl(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </PageLink>
        <span className="font-tabular px-2 text-[var(--color-fg)]">
          {currentPage} <span className="text-[var(--color-fg-subtle)]">de</span> {totalPages}
        </span>
        <PageLink
          href={pageUrl(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  children,
  ...rest
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
  'aria-label': string
}) {
  if (disabled) {
    return (
      <span
        className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] text-[var(--color-fg-subtle)] opacity-40"
        aria-label={rest['aria-label']}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
      aria-label={rest['aria-label']}
    >
      {children}
    </Link>
  )
}
