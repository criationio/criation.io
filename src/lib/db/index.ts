import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

type DbInstance = ReturnType<typeof drizzle<typeof schema>>

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined
  drizzleDb: DbInstance | undefined
}

let cached: DbInstance | null = globalForDb.drizzleDb ?? null

function getDb(): DbInstance {
  if (cached) return cached

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined')
  }

  const client =
    globalForDb.pgClient ??
    postgres(connectionString, {
      max: process.env.NODE_ENV === 'production' ? 10 : 1,
      idle_timeout: 20,
      connect_timeout: 10,
    })

  cached = drizzle(client, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pgClient = client
    globalForDb.drizzleDb = cached
  }

  return cached
}

export const db = new Proxy({} as DbInstance, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop)
    return typeof value === 'function' ? value.bind(real) : value
  },
}) as DbInstance
