'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

import { NAV_GROUPS } from './nav-config'

const STATIC_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  campanhas: 'Campanhas',
  produtos: 'Produtos',
  estudio: 'Estúdio',
  referencias: 'Referências',
  alertas: 'Alertas',
  tracking: 'Tracking',
  'tracking-script': 'Script de rastreio',
  atribuicao: 'Atribuição UTM',
  'utm-builder': 'UTM Builder',
  integracoes: 'Integrações',
  configuracoes: 'Workspace',
  afiliados: 'Afiliados',
  funis: 'Funis',
  utms: 'UTMs',
  comparativo: 'Comparativo A×B',
  historico: 'Histórico',
  mapeamento: 'Mapeamento',
  benchmarks: 'Benchmarks',
  analisar: 'Analisar',
  modelar: 'Modelar',
  variar: 'Variar',
  comparar: 'Comparar',
  nova: 'Nova',
  health: 'Health Score',
  gerador: 'Gerador',
  conexoes: 'Conexões',
  gateways: 'Gateways',
  capi: 'CAPI',
  equipe: 'Equipe',
  notificacoes: 'Notificações',
  faturamento: 'Faturamento',
  api: 'API & MCP',
  seguranca: 'Segurança',
  comissoes: 'Comissões',
  configurar: 'Configurar',
  ativos: 'Ativos',
}

function lookupLabelFromNav(href: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === href) return item.label
      const match = item.children?.find((c) => c.href === href)
      if (match) return match.label
    }
  }
  return null
}

function humanize(seg: string): string {
  return STATIC_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
}

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/')
    const label = lookupLabelFromNav(href) ?? humanize(seg)
    return { href, label, isLast: idx === segments.length - 1 }
  })

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          {c.isLast ? (
            <span className="font-medium text-[var(--color-fg)]">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
            >
              {c.label}
            </Link>
          )}
          {!c.isLast && (
            <ChevronRight className="h-3 w-3 text-[var(--color-fg-subtle)]" aria-hidden />
          )}
        </span>
      ))}
    </nav>
  )
}
