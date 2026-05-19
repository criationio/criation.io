import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'

/**
 * Conta signups recentes com mesmo IP hash. Usado pelo anti-fraude
 * (D3 da Sessao 1.1) para gerar `fraud_alert_signup_burst` quando
 * >= 3 signups em 24h. Nao bloqueia signup.
 */
export async function countRecentSignupsByIpHash(
  ipHash: string,
  intervalSql: string = '24 hours'
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      sql`${users.signupIpHash} = ${ipHash} AND ${users.createdAt} > NOW() - INTERVAL '${sql.raw(intervalSql)}'`
    )

  return result[0]?.count ?? 0
}
