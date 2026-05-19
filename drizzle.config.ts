import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'drizzle-kit'

// drizzle-kit invokes this config outside the Next.js runtime, so .env.local is
// not loaded automatically. Load it explicitly before reading process.env.
const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envLocalPath)
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Ensure .env.local exists at the project root and contains DATABASE_URL.'
  )
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
