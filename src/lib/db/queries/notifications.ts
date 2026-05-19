import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { notifications } from '@/lib/db/schema/alerts'

export async function listRecentNotifications(input: { userId: string; limit?: number }) {
  const limit = input.limit ?? 20
  return db.query.notifications.findMany({
    where: eq(notifications.userId, input.userId),
    orderBy: [desc(notifications.createdAt)],
    limit,
  })
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return result[0]?.count ?? 0
}
