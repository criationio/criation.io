'use client'

import { useEffect, useState } from 'react'

import { createBrowserClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/db/schema'

/**
 * Subscriber Supabase Realtime na tabela notifications, filtrado por
 * user_id. Recebe um snapshot inicial via SSR (initialItems) e
 * concatena INSERTs em tempo real no topo. UPDATE atualiza in-place
 * (ex: marcar como lida).
 */
export function useRealtimeNotifications(input: { userId: string; initialItems: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(input.initialItems)

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`notifications:user:${input.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${input.userId}`,
        },
        (payload) => {
          const row = payload.new as Notification
          setItems((prev) => [row, ...prev].slice(0, 50))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${input.userId}`,
        },
        (payload) => {
          const row = payload.new as Notification
          setItems((prev) => prev.map((n) => (n.id === row.id ? row : n)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [input.userId])

  const unreadCount = items.filter((n) => n.readAt === null).length

  function markAsReadLocal(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)))
  }

  function markAllAsReadLocal() {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date() })))
  }

  return { items, unreadCount, markAsReadLocal, markAllAsReadLocal }
}
