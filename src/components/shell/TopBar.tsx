'use client'

import { Search } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { useCommandPaletteStore, useCommandPaletteShortcut } from '@/lib/hooks/useCommandPalette'
import { useShellShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import type { Notification } from '@/lib/db/schema'

import { AccountMenu } from './AccountMenu'
import { Breadcrumb } from './Breadcrumb'
import { MobileNav } from './MobileNav'
import { NotificationsPanel } from './NotificationsPanel'
import type { PlanUsageData } from './PlanUsageCard'

// Le navigator.platform via useSyncExternalStore para evitar hydration
// mismatch. Server renderiza Ctrl+K (getServerSnapshot); client em Mac
// troca para ⌘K apos hydration sem warning.
function subscribePlatform() {
  return () => {}
}
function getPlatformSnapshot(): 'Ctrl+K' | '⌘K' {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'
}
function getServerPlatformSnapshot(): 'Ctrl+K' {
  return 'Ctrl+K'
}

interface TopBarProps {
  user: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
  }
  planLabel: string
  unreadAlerts: number
  planUsage: PlanUsageData
  initialNotifications: Notification[]
}

export function TopBar({
  user,
  planLabel,
  unreadAlerts,
  planUsage,
  initialNotifications,
}: TopBarProps) {
  useCommandPaletteShortcut()
  useShellShortcuts()
  const openPalette = useCommandPaletteStore((s) => s.setOpen)

  const shortcutLabel = useSyncExternalStore(
    subscribePlatform,
    getPlatformSnapshot,
    getServerPlatformSnapshot
  )

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 backdrop-blur-md">
      <MobileNav unreadAlerts={unreadAlerts} planUsage={planUsage} />

      <div className="flex flex-1 items-center gap-3">
        <div className="hidden md:block">
          <Breadcrumb />
        </div>

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => openPalette(true)}
            className="group flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 text-xs text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            aria-label={`Abrir busca (${shortcutLabel})`}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buscar ou ir para…</span>
            <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
              {shortcutLabel}
            </span>
          </button>
        </div>
      </div>

      <NotificationsPanel userId={user.id} initialItems={initialNotifications} />

      <AccountMenu
        user={{ email: user.email, name: user.name, avatarUrl: user.avatarUrl }}
        planLabel={planLabel}
      />
    </header>
  )
}
