import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

// P2-7 fix: revalidate cache server-side 60s. Actions mutantes (Server Actions
// em google-conversoes.ts) invalidam via revalidatePath. Sem isso, F5 rapido
// dispara 3 queries DB cada vez.
export const revalidate = 60

import { db } from '@/lib/db'
import {
  getActiveGoogleConnectionByWorkspace,
  listAdsAccountsByConnection,
  listMappingsByWorkspace,
} from '@/lib/db/queries/google-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { GoogleConversoesClient } from './google-conversoes-client'

/**
 * Wizard /configuracoes/google/conversoes (1.4.9.B step 10).
 *
 * Server-loads: connection + accounts + conversion actions (cache jsonb) +
 * mappings. Client renderiza 4 secoes: status, multi-customer picker,
 * mapping CRUD, test mode toggle.
 *
 * Stats vivem em `/tracking` aba Google (step 11) — pra alinhar com Meta.
 */
export default async function GoogleConversoesPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  const connection = await getActiveGoogleConnectionByWorkspace(workspaceId)
  const accounts = connection ? await listAdsAccountsByConnection(connection.id) : []
  const mappings = connection ? await listMappingsByWorkspace(workspaceId) : []

  return (
    <GoogleConversoesClient
      connected={!!connection}
      testMode={connection?.testMode ?? false}
      googleUserEmail={connection?.googleUserEmail ?? null}
      googleUserName={connection?.googleUserName ?? null}
      grantedDataManagerScope={connection?.grantedDataManagerScope ?? false}
      grantedAdsScope={connection?.grantedAdsScope ?? false}
      accounts={accounts.map((a) => ({
        id: a.id,
        customerId: a.customerId,
        customerDescriptiveName: a.customerDescriptiveName,
        managerCustomerId: a.managerCustomerId,
        currencyCode: a.currencyCode,
        timeZone: a.timeZone,
        isTestAccount: a.isTestAccount,
        isManager: a.isManager,
        isDefault: a.isDefault,
        conversionActions: parseConversionActions(a.conversionActions),
      }))}
      mappings={mappings.map((m) => ({
        id: m.id,
        googleAdsAccountId: m.googleAdsAccountId,
        internalEventName: m.internalEventName,
        productDestinationId: m.productDestinationId,
        conversionActionName: m.conversionActionName,
        conversionActionType: m.conversionActionType,
        isPrimary: m.isPrimary,
        isEnabled: m.isEnabled,
      }))}
    />
  )
}

interface ConversionActionLite {
  id: string
  name: string
  type?: string | null
  category?: string | null
}

/**
 * conversion_actions jsonb pode vir em formatos variados conforme o adapter
 * de metadata. Trata como array de objetos com {id, name, type?, category?}.
 * Filtra entries invalidas pra nao crashar a UI.
 */
function parseConversionActions(raw: unknown): ConversionActionLite[] {
  if (!Array.isArray(raw)) return []
  const out: ConversionActionLite[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : null
    const name = typeof r.name === 'string' ? r.name : null
    if (!id || !name) continue
    out.push({
      id,
      name,
      type: typeof r.type === 'string' ? r.type : null,
      category: typeof r.category === 'string' ? r.category : null,
    })
  }
  return out
}
