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
  const tablesRow = tables[0]
  if (!tablesRow) throw new Error('Expected pg_tables count row, got empty result')
  console.log('TABLES_PUBLIC:', tablesRow.count)

  const tableNames = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
  `
  console.log('TABLE_NAMES:', tableNames.map((t) => t.tablename).join(','))

  const pipelineCosts = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM pipeline_costs
  `
  const pipelineCostsRow = pipelineCosts[0]
  if (!pipelineCostsRow) throw new Error('Expected pipeline_costs count row, got empty result')
  console.log('PIPELINE_COSTS_ROWS:', pipelineCostsRow.count)

  const creditPackages = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM credit_packages
  `
  const creditPackagesRow = creditPackages[0]
  if (!creditPackagesRow) throw new Error('Expected credit_packages count row, got empty result')
  console.log('CREDIT_PACKAGES_ROWS:', creditPackagesRow.count)

  const auditExists = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='audit_logs'
    ) as exists
  `
  const auditExistsRow = auditExists[0]
  if (!auditExistsRow) throw new Error('Expected audit_logs EXISTS row, got empty result')
  console.log('AUDIT_LOGS_EXISTS:', auditExistsRow.exists)

  const policies = await sql<{ count: string }[]>`
    SELECT count(*)::text as count FROM pg_policies WHERE schemaname='public'
  `
  const policiesRow = policies[0]
  if (!policiesRow) throw new Error('Expected pg_policies count row, got empty result')
  console.log('POLICIES_COUNT:', policiesRow.count)

  const policyTables = await sql<{ tablename: string }[]>`
    SELECT DISTINCT tablename FROM pg_policies WHERE schemaname='public' ORDER BY tablename
  `
  console.log('POLICY_TABLES:', policyTables.map((t) => t.tablename).join(','))

  const select1 = await sql<{ ok: number }[]>`SELECT 1 as ok`
  const select1Row = select1[0]
  if (!select1Row) throw new Error('Expected SELECT 1 row, got empty result')
  console.log('SELECT_1:', select1Row.ok)

  await sql.end()
}

main().catch((err) => {
  console.error('DIAGNOSE_ERROR:', err)
  process.exit(1)
})
