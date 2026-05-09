import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  FlaskConical,
  Layers,
  LayoutDashboard,
  LineChart,
  Link2,
  Megaphone,
  Settings,
  Sparkles,
  UserPlus,
} from 'lucide-react'

export interface NavSubItem {
  label: string
  href: string
}

export interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  shortcut?: string
  children?: NavSubItem[]
  badge?: 'unread'
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        shortcut: 'g d',
        children: [
          { label: 'Overview', href: '/dashboard' },
          { label: 'Funis', href: '/dashboard/funis' },
          { label: 'UTMs', href: '/dashboard/utms' },
        ],
      },
      {
        id: 'campanhas',
        label: 'Campanhas',
        href: '/campanhas',
        icon: Megaphone,
        shortcut: 'g c',
        children: [
          { label: 'Todas as campanhas', href: '/campanhas' },
          { label: 'Comparativo A×B', href: '/campanhas/comparativo' },
          { label: 'Histórico de ações', href: '/campanhas/historico' },
        ],
      },
      {
        id: 'produtos',
        label: 'Produtos',
        href: '/produtos',
        icon: Layers,
        shortcut: 'g p',
        children: [
          { label: 'Todos os produtos', href: '/produtos' },
          { label: 'Mapeamento', href: '/produtos/mapeamento' },
          { label: 'Benchmarks', href: '/produtos/benchmarks' },
        ],
      },
      {
        id: 'estudio',
        label: 'Estúdio',
        href: '/estudio',
        icon: FlaskConical,
        shortcut: 'g e',
        children: [
          { label: 'Analisar', href: '/estudio/analisar' },
          { label: 'Modelar', href: '/estudio/modelar' },
          { label: 'Variar', href: '/estudio/variar' },
          { label: 'Comparar análises', href: '/estudio/comparar' },
          { label: 'Histórico', href: '/estudio/historico' },
        ],
      },
      {
        id: 'referencias',
        label: 'Referências',
        href: '/referencias',
        icon: Sparkles,
        shortcut: 'g r',
        children: [
          { label: 'Biblioteca', href: '/referencias' },
          { label: 'Nova referência', href: '/referencias/nova' },
        ],
      },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      {
        id: 'alertas',
        label: 'Alertas',
        href: '/alertas',
        icon: Bell,
        badge: 'unread',
        children: [
          { label: 'Ativos', href: '/alertas' },
          { label: 'Histórico', href: '/alertas/historico' },
          { label: 'Configurar', href: '/alertas/configurar' },
        ],
      },
      {
        id: 'utm-builder',
        label: 'UTM Builder',
        href: '/utm-builder',
        icon: Link2,
        children: [
          { label: 'Health Score', href: '/utm-builder/health' },
          { label: 'Gerador', href: '/utm-builder/gerador' },
        ],
      },
    ],
  },
  {
    id: 'conta',
    label: 'Conta',
    items: [
      {
        id: 'configuracoes',
        label: 'Configurações',
        href: '/configuracoes',
        icon: Settings,
        shortcut: 'g s',
        children: [
          { label: 'Conexões', href: '/configuracoes/conexoes' },
          { label: 'Gateways', href: '/configuracoes/gateways' },
          { label: 'CAPI', href: '/configuracoes/capi' },
          { label: 'Equipe', href: '/configuracoes/equipe' },
          { label: 'Notificações', href: '/configuracoes/notificacoes' },
          { label: 'Faturamento', href: '/configuracoes/faturamento' },
          { label: 'API', href: '/configuracoes/api' },
          { label: 'Segurança', href: '/configuracoes/seguranca' },
        ],
      },
      {
        id: 'afiliados',
        label: 'Afiliados',
        href: '/afiliados',
        icon: UserPlus,
        children: [
          { label: 'Visão geral', href: '/afiliados' },
          { label: 'Comissões', href: '/afiliados/comissoes' },
        ],
      },
    ],
  },
] as const

export const QUICK_ACTIONS = [
  {
    id: 'new-analysis',
    label: 'Nova análise',
    href: '/estudio/analisar/nova',
    icon: BarChart3,
    shortcut: 'n a',
  },
  {
    id: 'new-reference',
    label: 'Nova referência',
    href: '/referencias/nova',
    icon: Sparkles,
  },
  {
    id: 'utm-health',
    label: 'Ver UTM Health Score',
    href: '/utm-builder/health',
    icon: LineChart,
  },
] as const

export function flattenNavRoutes() {
  const result: { label: string; href: string; group: string }[] = []
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      result.push({ label: item.label, href: item.href, group: group.label })
      if (item.children) {
        for (const child of item.children) {
          result.push({
            label: `${item.label} → ${child.label}`,
            href: child.href,
            group: group.label,
          })
        }
      }
    }
  }
  return result
}

export function isPathActive(itemHref: string, pathname: string, isParent = false): boolean {
  if (isParent) {
    return pathname === itemHref || pathname.startsWith(`${itemHref}/`)
  }
  return pathname === itemHref
}
