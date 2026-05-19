import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envLocalPath)
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Ensure .env.local exists at the project root and contains DATABASE_URL.'
  )
}

async function applyRls() {
  const postgres = (await import('postgres')).default
  const sql = postgres(process.env.DATABASE_URL!)
  const rls = readFileSync(resolve(process.cwd(), 'src/lib/db/rls.sql'), 'utf8')
  await sql.unsafe(rls)
  console.log('RLS aplicado')
  await sql.end()
}

applyRls().catch((err) => {
  console.error(err)
  process.exit(1)
})
