import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  CreditCard,
  FileCode2,
  FlaskConical,
  KeyRound,
  Layers,
  LayoutDashboard,
  LineChart,
  Link2,
  Megaphone,
  Plug2,
  Radio,
  Shield,
  Sparkles,
  Target,
  UserPlus,
  Users,
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
  /** Visual hint que pagina ainda e placeholder. Sidebar mostra "EM BREVE" pill
   * + opacity reduzida. Cliente ainda pode clicar pra ver "em construcao". */
  comingSoon?: true
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

/**
 * Information architecture (revisada 1.4.A.10).
 *
 * Principio: agrupar por intent ("o que vou fazer agora") e por frequencia
 * de uso (diario > semanal > mensal > raro). Tracking ganha grupo proprio
 * porque e o diferencial competitivo (CDP) — antes estava disperso em 5
 * lugares (Configuracoes/Atribuicao, Configuracoes/Script, Configuracoes/CAPI,
 * Dashboard/UTMs, Insights/UTM Builder).
 */
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
        comingSoon: true,
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
        comingSoon: true,
        children: [
          { label: 'Analisar', href: '/estudio/analisar' },
          { label: 'Modelar', href: '/estudio/modelar' },
          { label: 'Variar', href: '/estudio/variar' },
          { label: 'Comparar análises', href: '/estudio/comparar' },
          { label: 'Referências', href: '/referencias' },
          { label: 'Histórico', href: '/estudio/historico' },
        ],
      },
      {
        id: 'alertas',
        label: 'Alertas',
        href: '/alertas',
        icon: Bell,
        badge: 'unread',
        comingSoon: true,
        children: [
          { label: 'Ativos', href: '/alertas' },
          { label: 'Histórico', href: '/alertas/historico' },
          { label: 'Configurar', href: '/alertas/configurar' },
        ],
      },
    ],
  },
  {
    id: 'tracking',
    label: 'Tracking',
    items: [
      {
        id: 'tracking-overview',
        label: 'Visão geral',
        href: '/tracking',
        icon: Activity,
        shortcut: 'g t',
      },
      {
        id: 'tracking-script',
        label: 'Script de rastreio',
        href: '/configuracoes/tracking-script',
        icon: FileCode2,
      },
      {
        id: 'atribuicao',
        label: 'Atribuição UTM',
        href: '/configuracoes/atribuicao',
        icon: Target,
      },
      {
        id: 'utm-builder',
        label: 'UTM Builder',
        href: '/utm-builder',
        icon: Link2,
        comingSoon: true,
        children: [
          { label: 'Health Score', href: '/utm-builder/health' },
          { label: 'Gerador', href: '/utm-builder/gerador' },
        ],
      },
      {
        id: 'capi',
        label: 'CAPI',
        href: '/configuracoes/capi',
        icon: Radio,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'integracoes',
    label: 'Integrações',
    items: [
      {
        id: 'conexoes',
        label: 'Conexões',
        href: '/configuracoes/conexoes',
        icon: Plug2,
      },
      {
        id: 'api',
        label: 'API & MCP',
        href: '/configuracoes/api',
        icon: KeyRound,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'conta',
    label: 'Conta',
    items: [
      {
        id: 'workspace',
        label: 'Workspace',
        href: '/configuracoes',
        icon: Briefcase,
        shortcut: 'g s',
      },
      {
        id: 'equipe',
        label: 'Equipe',
        href: '/configuracoes/equipe',
        icon: Users,
        comingSoon: true,
      },
      {
        id: 'faturamento',
        label: 'Faturamento',
        href: '/configuracoes/faturamento',
        icon: CreditCard,
        comingSoon: true,
      },
      {
        id: 'afiliados',
        label: 'Afiliados',
        href: '/afiliados',
        icon: UserPlus,
        comingSoon: true,
        children: [
          { label: 'Visão geral', href: '/afiliados' },
          { label: 'Comissões', href: '/afiliados/comissoes' },
        ],
      },
      {
        id: 'notificacoes',
        label: 'Notificações',
        href: '/configuracoes/notificacoes',
        icon: Bell,
        comingSoon: true,
      },
      {
        id: 'seguranca',
        label: 'Segurança',
        href: '/configuracoes/seguranca',
        icon: Shield,
        comingSoon: true,
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
