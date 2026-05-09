'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { useSidebarCollapse } from '@/lib/hooks/useSidebarCollapse'

import { NAV_GROUPS, isPathActive, type NavItem } from './nav-config'
import { PlanUsageCard } from './PlanUsageCard'
import type { PlanUsageData } from './PlanUsageCard'

interface SidebarProps {
  initialCollapsed?: boolean
  unreadAlerts?: number
  planUsage: PlanUsageData
  workspaceName: string
}

export function Sidebar({
  initialCollapsed = false,
  unreadAlerts = 0,
  planUsage,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarCollapse(initialCollapsed)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-muted)] transition-[width] duration-200 ease-out lg:flex',
        collapsed ? 'w-[52px]' : 'w-[236px]'
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-3',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight text-[var(--color-fg)]"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-fg-on-accent)]"
            aria-hidden
          >
            C
          </span>
          {!collapsed && <span className="text-sm">Criation</span>}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-4">
            {!collapsed && <div className="text-label mb-1 px-3 text-[10px]">{group.label}</div>}
            <ul className="flex flex-col gap-0.5 px-2">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  badgeCount={item.badge === 'unread' ? unreadAlerts : 0}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        {!collapsed && (
          <div className="mb-2">
            <PlanUsageCard data={planUsage} />
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]',
            collapsed && 'justify-center'
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="truncate">{workspaceName}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

interface SidebarItemProps {
  item: NavItem
  pathname: string
  collapsed: boolean
  badgeCount: number
}

function SidebarItem({ item, pathname, collapsed, badgeCount }: SidebarItemProps) {
  const Icon = item.icon
  const active = isPathActive(item.href, pathname, true)
  const [manuallyOpen, setManuallyOpen] = useState(false)
  // Item ativo sempre mostra filhos (UX padrao Linear/GitHub). Itens
  // inativos podem ser expandidos manualmente.
  const open = active || manuallyOpen

  const hasChildren = !!item.children?.length
  const showToggle = hasChildren && !active

  if (collapsed) {
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]',
            active && 'bg-[var(--color-accent-subtle)] text-[var(--color-fg)]'
          )}
          title={item.label}
          aria-label={item.label}
        >
          <Icon className="h-4 w-4" />
        </Link>
      </li>
    )
  }

  return (
    <li>
      <div className="flex items-stretch">
        <Link
          href={item.href}
          onClick={() => showToggle && setManuallyOpen(true)}
          className={cn(
            'group flex flex-1 items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-[var(--color-fg-muted)] transition',
            'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]',
            active && 'bg-[var(--color-accent-subtle)] text-[var(--color-fg)]'
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'
            )}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {badgeCount > 0 && (
            <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] leading-none font-medium text-[var(--color-fg-on-accent)]">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
          {item.shortcut && (
            <span className="hidden font-mono text-[10px] text-[var(--color-fg-subtle)] group-hover:inline">
              {item.shortcut}
            </span>
          )}
        </Link>
        {showToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setManuallyOpen((v) => !v)
            }}
            className="flex w-6 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-subtle)] transition hover:text-[var(--color-fg)]"
            aria-label={open ? 'Recolher subitens' : 'Expandir subitens'}
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-0' : '-rotate-90')}
            />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <ul className="mt-0.5 ml-6 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-2">
          {item.children!.map((child) => {
            const childActive = pathname === child.href
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex items-center rounded-[var(--radius-sm)] px-2 py-1 text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]',
                    childActive && 'text-[var(--color-fg)]'
                  )}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
