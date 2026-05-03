import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined')
}

const globalForDb = globalThis as unknown as { pgClient: ReturnType<typeof postgres> | undefined }

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = client
}

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})
