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
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_GROUPS.map((group, idx) => (
            <div
              key={group.id}
              className={cn('pb-3', idx > 0 && 'mt-3 border-t border-[var(--color-border)] pt-3')}
            >
              <div className="mb-1.5 flex items-center gap-1.5 px-4">
                <span className="text-[10px] font-semibold tracking-wider text-[var(--color-fg-muted)] uppercase">
                  {group.label}
                </span>
                {group.id === 'tracking' && (
                  <span
                    className="rounded-full bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-[var(--color-accent)] uppercase"
                    title="Customer Data Platform — diferencial Criation"
                  >
                    CDP
                  </span>
                )}
              </div>
              <ul className="flex flex-col px-2">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isPathActive(item.href, pathname, true)
                  const showBadge = item.badge === 'unread' && unreadAlerts > 0
                  return (
                    <li key={item.id} className="relative">
                      {active && (
                        <span
                          aria-hidden
                          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-[var(--color-accent)]"
                        />
                      )}
                      <SheetClose asChild>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-sm text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]',
                            item.comingSoon && 'opacity-60',
                            active &&
                              'bg-[var(--color-accent-subtle)] font-medium text-[var(--color-fg)] opacity-100'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              active ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg-muted)]'
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.comingSoon && !active && (
                            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
                              Em breve
                            </span>
                          )}
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
