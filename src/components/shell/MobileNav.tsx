'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import { NAV_GROUPS, isPathActive } from './nav-config'
import { PlanUsageCard } from './PlanUsageCard'
import type { PlanUsageData } from './PlanUsageCard'

interface MobileNavProps {
  unreadAlerts: number
  planUsage: PlanUsageData
}

export function MobileNav({ unreadAlerts, planUsage }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)] lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-[var(--color-border)] px-4 py-3">
          <SheetTitle>Criation</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal</SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="mb-4">
              <div className="text-label mb-1 px-4 text-[10px]">{group.label}</div>
              <ul className="flex flex-col px-2">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isPathActive(item.href, pathname, true)
                  const showBadge = item.badge === 'unread' && unreadAlerts > 0
                  return (
                    <li key={item.id}>
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-sm text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]',
                            active && 'bg-[var(--color-accent-subtle)] text-[var(--color-fg)]'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {showBadge && (
                            <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] leading-none font-medium text-[var(--color-fg-on-accent)]">
                              {unreadAlerts > 99 ? '99+' : unreadAlerts}
                            </span>
                          )}
                        </Link>
                      </SheetClose>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <PlanUsageCard data={planUsage} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
