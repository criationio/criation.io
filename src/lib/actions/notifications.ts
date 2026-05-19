'use server'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema/alerts'
import { getUser } from '@/lib/supabase/server'

export type NotificationActionResult =
  | { ok: true; updated: number }
  | { ok: false; error: { code: 'UNAUTHORIZED' | 'NOT_FOUND'; message: string } }

export async function markNotificationAsRead(
  notificationId: string
): Promise<NotificationActionResult> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id),
        isNull(notifications.readAt)
      )
    )
    .returning({ id: notifications.id })

  return { ok: true, updated: updated.length }
}

export async function markAllNotificationsAsRead(): Promise<NotificationActionResult> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
  }

  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
    .returning({ id: notifications.id })

  return { ok: true, updated: updated.length }
}
