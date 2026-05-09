'use client'

import { Bell, Check } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications'
import { markAllNotificationsAsRead, markNotificationAsRead } from '@/lib/actions/notifications'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/db/schema'

const TAB_CATEGORIES = {
  todos: null,
  analise: ['analysis_ready', 'analysis_failed', 'analysis_refunded'],
  alerta: ['alert_critical', 'alert_warning', 'credits_running_low', 'credits_expiring_soon'],
  sistema: ['system', 'billing', 'auth'],
} as const

type TabKey = keyof typeof TAB_CATEGORIES

interface NotificationsPanelProps {
  userId: string
  initialItems: Notification[]
}

export function NotificationsPanel({ userId, initialItems }: NotificationsPanelProps) {
  const { items, unreadCount, markAsReadLocal, markAllAsReadLocal } = useRealtimeNotifications({
    userId,
    initialItems,
  })
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-[var(--color-accent)]"
              aria-hidden
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <NotificationsContent
          items={items}
          unreadCount={unreadCount}
          markAsReadLocal={markAsReadLocal}
          markAllAsReadLocal={markAllAsReadLocal}
        />
      </PopoverContent>
    </Popover>
  )
}

function NotificationsContent({
  items,
  unreadCount,
  markAsReadLocal,
  markAllAsReadLocal,
}: {
  items: Notification[]
  unreadCount: number
  markAsReadLocal: (id: string) => void
  markAllAsReadLocal: () => void
}) {
  const [tab, setTab] = useState<TabKey>('todos')
  const [isPending, startTransition] = useTransition()

  const filtered = items.filter((n) => {
    if (tab === 'todos') return true
    const cats = TAB_CATEGORIES[tab]
    if (!cats) return true
    return (cats as readonly string[]).includes(n.type)
  })

  function handleMarkAll() {
    markAllAsReadLocal()
    startTransition(async () => {
      await markAllNotificationsAsRead()
    })
  }

  function handleClick(n: Notification) {
    if (!n.readAt) {
      markAsReadLocal(n.id)
      startTransition(async () => {
        await markNotificationAsRead(n.id)
      })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-sm font-medium">Notificações</span>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || isPending}
          className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          Marcar todas como lidas
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b border-[var(--color-border)] bg-transparent p-0">
          <TabsTrigger value="todos" className="rounded-none">
            Tudo
          </TabsTrigger>
          <TabsTrigger value="analise" className="rounded-none">
            Análises
          </TabsTrigger>
          <TabsTrigger value="alerta" className="rounded-none">
            Alertas
          </TabsTrigger>
          <TabsTrigger value="sistema" className="rounded-none">
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="m-0 max-h-[420px] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {filtered.map((n) => (
                <NotificationItem key={n.id} notification={n} onClick={() => handleClick(n)} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <div className="border-t border-[var(--color-border)] p-2 text-center">
        <Link
          href="/alertas"
          className="text-xs text-[var(--color-accent)] transition hover:text-[var(--color-accent-hover)]"
        >
          Ver todas em /alertas
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Bell className="h-6 w-6 text-[var(--color-fg-subtle)]" />
      <div className="text-xs text-[var(--color-fg-muted)]">Sem notificações por enquanto.</div>
      <div className="text-[10px] text-[var(--color-fg-subtle)]">
        Avisos de análise, alertas e sistema aparecem aqui.
      </div>
    </div>
  )
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: () => void
}) {
  const unread = notification.readAt === null
  const ts = relativeTime(notification.createdAt)

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-bg-muted)]',
          unread && 'bg-[var(--color-accent-muted)]'
        )}
      >
        <span
          className={cn(
            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
            unread ? 'bg-[var(--color-accent)]' : 'bg-transparent'
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-fg)]">
              {notification.title}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--color-fg-subtle)]">{ts}</span>
          </div>
          {notification.body && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-fg-muted)]">
              {notification.body}
            </p>
          )}
        </div>
      </button>
    </li>
  )
}

function relativeTime(date: Date | string | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `${diffD}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
