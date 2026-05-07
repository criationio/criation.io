import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envLocalPath = resolve(process.cwd(), '.env.local')
if (existsSync(envLocalPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envLocalPath)
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.')
}

async function main() {
  const postgres = (await import('postgres')).default
  const sql = postgres(process.env.DATABASE_URL!)

  const tables = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM pg_tables WHERE schemaname='public'
  `
  console.log('TABLES_PUBLIC:', tables[0].count)

  const tableNames = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
  `
  console.log('TABLE_NAMES:', tableNames.map((t) => t.tablename).join(','))

  const pipelineCosts = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM pipeline_costs
  `
  console.log('PIPELINE_COSTS_ROWS:', pipelineCosts[0].count)

  const creditPackages = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM credit_packages
  `
  console.log('CREDIT_PACKAGES_ROWS:', creditPackages[0].count)

  const auditExists = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='audit_logs'
    ) as exists
  `
  console.log('AUDIT_LOGS_EXISTS:', auditExists[0].exists)

  const policies = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM pg_policies WHERE schemaname='public'
  `
  console.log('POLICIES_COUNT:', policies[0].count)

  const policyTables = await sql<{ tablename: string }[]>`
    SELECT DISTINCT tablename FROM pg_policies WHERE schemaname='public' ORDER BY tablename
  `
  console.log('POLICY_TABLES:', policyTables.map((t) => t.tablename).join(','))

  const select1 = await sql<{ ok: number }[]>`SELECT 1 as ok`
  console.log('SELECT_1:', select1[0].ok)

  await sql.end()
}

main().catch((err) => {
  console.error('DIAGNOSE_ERROR:', err)
  process.exit(1)
})
