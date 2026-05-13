import { env } from '@/env'
import { authLogger } from '@/lib/logger'

import { GoogleApiError } from './google.service'

/**
 * Google Ads API REST — metadata only (1.4.9.B / ADR-015).
 *
 * Esta service usa Google Ads API REST `v24` (NAO Data Manager API) somente
 * para descoberta de contas + conversion actions:
 *
 *  - GET /v{V}/customers:listAccessibleCustomers
 *      => lista customer_ids que o user OAuth tem acesso
 *  - POST /v{V}/customers/{customer_id}/googleAds:search (GAQL)
 *      => para managers: lista managed customers
 *      => para non-managers: lista conversion_actions ENABLED
 *
 * Esses dados populam google_ads_accounts + conversion_actions jsonb pos-OAuth.
 * O fanout em si vai por Data Manager API (capi/google.adapter.ts).
 *
 * Developer Token Basic obrigatorio em todas as chamadas (env
 * GOOGLE_ADS_DEVELOPER_TOKEN). Sem token, function lanca GoogleApiError.
 *
 * Header login-customer-id obrigatorio quando consultando managed customers
 * via MCC. Helper passa quando relevante.
 *
 * Rate limit: 15k ops/dia global no developer token Basic — suficiente pra
 * metadata calls (1x por workspace + esporadico refresh manual).
 */

function getBaseUrl(version: string = env.GOOGLE_ADS_API_VERSION): string {
  return `https://googleads.googleapis.com/${version}`
}

function buildHeaders(input: {
  accessToken: string
  loginCustomerId?: string | null
}): HeadersInit {
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    throw new GoogleApiError('GOOGLE_ADS_DEVELOPER_TOKEN nao configurado')
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.accessToken}`,
    'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  }
  if (input.loginCustomerId) {
    // login-customer-id strip hyphens (Google Ads UI mostra com hifens; API quer sem)
    headers['login-customer-id'] = input.loginCustomerId.replace(/-/g, '')
  }
  return headers
}

async function googleAdsRest<T>(url: string, init: RequestInit, operation: string): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    // Google Ads API returns rich error array — pick first message + code
    const errors = (json.error as Record<string, unknown>) ?? {}
    const message =
      typeof errors.message === 'string' ? errors.message : `google_ads_http_${res.status}`
    const status = (errors.code as number) ?? res.status
    authLogger.error({ operation, status, message }, 'google ads rest api error')
    throw new GoogleApiError(message, status)
  }
  return json as T
}

// ---------------------------------------------------------------------------
// listAccessibleCustomers
// ---------------------------------------------------------------------------

interface ListAccessibleCustomersResponse {
  resourceNames?: string[]
}

/**
 * GET /customers:listAccessibleCustomers
 *
 * Retorna list de customer_resource_names que o user tem acesso direto.
 * Cada resource_name e tipo `customers/1234567890` — extraimos so o ID.
 */
export async function listAccessibleCustomers(input: { accessToken: string }): Promise<string[]> {
  const url = `${getBaseUrl()}/customers:listAccessibleCustomers`
  const json = await googleAdsRest<ListAccessibleCustomersResponse>(
    url,
    { method: 'GET', headers: buildHeaders({ accessToken: input.accessToken }) },
    'listAccessibleCustomers'
  )
  return (json.resourceNames ?? []).map((rn) => rn.replace('customers/', ''))
}

// ---------------------------------------------------------------------------
// Customer details via GAQL
// ---------------------------------------------------------------------------

export interface CustomerInfo {
  customerId: string
  descriptiveName: string | null
  currencyCode: string | null
  timeZone: string | null
  status: number | null
  isTestAccount: boolean
  isManager: boolean
  managerCustomerId: string | null
}

interface GoogleAdsSearchRow {
  customer?: {
    id?: string
    descriptiveName?: string
    currencyCode?: string
    timeZone?: string
    status?: string
    testAccount?: boolean
    manager?: boolean
  }
}

interface CustomerClientRow {
  customerClient?: {
    id?: string
    descriptiveName?: string
    currencyCode?: string
    timeZone?: string
    status?: string
    testAccount?: boolean
    manager?: boolean
  }
}

interface SearchResponse<T> {
  results?: T[]
  nextPageToken?: string
}

/**
 * Customer self-details via SELECT customer.* FROM customer
 * (1 row apenas — a propria customer). Determina se e manager + test_account.
 */
export async function getCustomerSelf(input: {
  accessToken: string
  customerId: string
}): Promise<CustomerInfo | null> {
  const url = `${getBaseUrl()}/customers/${input.customerId}/googleAds:search`
  const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code,
    customer.time_zone, customer.status, customer.test_account, customer.manager
    FROM customer`
  const json = await googleAdsRest<SearchResponse<GoogleAdsSearchRow>>(
    url,
    {
      method: 'POST',
      headers: buildHeaders({ accessToken: input.accessToken }),
      body: JSON.stringify({ query }),
    },
    'getCustomerSelf'
  )
  const row = json.results?.[0]?.customer
  if (!row?.id) return null
  return {
    customerId: row.id,
    descriptiveName: row.descriptiveName ?? null,
    currencyCode: row.currencyCode ?? null,
    timeZone: row.timeZone ?? null,
    status: parseStatusCode(row.status),
    isTestAccount: row.testAccount === true,
    isManager: row.manager === true,
    managerCustomerId: null,
  }
}

/**
 * Listar managed customers via SELECT customer_client.* FROM customer_client.
 * Disparado pra cada customer que retornou `manager=true`.
 *
 * Header login-customer-id = managerCustomerId (audit Google §2 — sem isso,
 * chamada falha pra contas gerenciadas).
 */
export async function listManagedCustomers(input: {
  accessToken: string
  managerCustomerId: string
}): Promise<CustomerInfo[]> {
  const url = `${getBaseUrl()}/customers/${input.managerCustomerId}/googleAds:search`
  const query = `SELECT customer_client.id, customer_client.descriptive_name,
    customer_client.currency_code, customer_client.time_zone, customer_client.status,
    customer_client.test_account, customer_client.manager
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'`
  const json = await googleAdsRest<SearchResponse<CustomerClientRow>>(
    url,
    {
      method: 'POST',
      headers: buildHeaders({
        accessToken: input.accessToken,
        loginCustomerId: input.managerCustomerId,
      }),
      body: JSON.stringify({ query }),
    },
    'listManagedCustomers'
  )
  return (json.results ?? [])
    .map((r) => r.customerClient)
    .filter((c): c is NonNullable<typeof c> => !!c?.id)
    .map((c) => ({
      customerId: c.id!,
      descriptiveName: c.descriptiveName ?? null,
      currencyCode: c.currencyCode ?? null,
      timeZone: c.timeZone ?? null,
      status: parseStatusCode(c.status),
      isTestAccount: c.testAccount === true,
      isManager: c.manager === true,
      managerCustomerId: input.managerCustomerId,
    }))
}

// ---------------------------------------------------------------------------
// Conversion actions
// ---------------------------------------------------------------------------

export interface ConversionActionInfo {
  id: string
  resourceName: string
  name: string
  type: string | null
  category: string | null
}

interface ConversionActionRow {
  conversionAction?: {
    id?: string
    resourceName?: string
    name?: string
    type?: string
    category?: string
  }
}

/**
 * Listar conversion_actions ENABLED de um customer non-manager.
 *
 * Sem mapping (workspace event_name -> conversion_action_id), fanout falha
 * 100%. Cache em google_ads_accounts.conversion_actions jsonb.
 */
export async function listConversionActions(input: {
  accessToken: string
  customerId: string
  loginCustomerId?: string | null
}): Promise<ConversionActionInfo[]> {
  const url = `${getBaseUrl()}/customers/${input.customerId}/googleAds:search`
  const query = `SELECT conversion_action.id, conversion_action.resource_name,
    conversion_action.name, conversion_action.type, conversion_action.category
    FROM conversion_action
    WHERE conversion_action.status = 'ENABLED'`
  const json = await googleAdsRest<SearchResponse<ConversionActionRow>>(
    url,
    {
      method: 'POST',
      headers: buildHeaders({
        accessToken: input.accessToken,
        loginCustomerId: input.loginCustomerId ?? null,
      }),
      body: JSON.stringify({ query }),
    },
    'listConversionActions'
  )
  return (json.results ?? [])
    .map((r) => r.conversionAction)
    .filter((c): c is NonNullable<typeof c> => !!c?.id)
    .map((c) => ({
      id: c.id!,
      resourceName: c.resourceName ?? '',
      name: c.name ?? '',
      type: c.type ?? null,
      category: c.category ?? null,
    }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStatusCode(raw: string | undefined): number | null {
  if (!raw) return null
  // Google Ads API retorna status como string enum ('ENABLED', 'CANCELED', etc).
  // Convertemos pra integer compativel com nosso schema (1=enabled, etc).
  switch (raw.toUpperCase()) {
    case 'ENABLED':
      return 1
    case 'CANCELED':
      return 2
    case 'SUSPENDED':
      return 3
    case 'CLOSED':
      return 4
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// High-level orchestration — usado pelo OAuth callback (Step 4 / wire-in)
// ---------------------------------------------------------------------------

export interface FullMetadataSyncResult {
  customers: Array<CustomerInfo & { conversionActions: ConversionActionInfo[] }>
  managers: CustomerInfo[]
  errors: Array<{ phase: string; customerId?: string; message: string }>
}

/**
 * Discovery completa pos-OAuth: lista todos os customers acessiveis, pra cada
 * manager enumera managed customers, pra cada non-manager enumera conversion
 * actions. Falhas individuais sao acumuladas em `errors` (degradacao
 * graceful — wizard mostra "0 conversion actions" e cliente faz "Atualizar").
 */
export async function discoverAllMetadata(input: {
  accessToken: string
}): Promise<FullMetadataSyncResult> {
  const result: FullMetadataSyncResult = { customers: [], managers: [], errors: [] }

  let accessibleIds: string[]
  try {
    accessibleIds = await listAccessibleCustomers({ accessToken: input.accessToken })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    result.errors.push({ phase: 'listAccessibleCustomers', message: msg })
    return result
  }

  // 1. Identify managers vs non-managers (1 call per customer)
  const customerInfos: CustomerInfo[] = []
  for (const customerId of accessibleIds) {
    try {
      const info = await getCustomerSelf({ accessToken: input.accessToken, customerId })
      if (info) customerInfos.push(info)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      result.errors.push({ phase: 'getCustomerSelf', customerId, message: msg })
    }
  }

  // 2. Expand managers
  for (const m of customerInfos.filter((c) => c.isManager)) {
    result.managers.push(m)
    try {
      const managed = await listManagedCustomers({
        accessToken: input.accessToken,
        managerCustomerId: m.customerId,
      })
      customerInfos.push(...managed.filter((c) => !c.isManager))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      result.errors.push({
        phase: 'listManagedCustomers',
        customerId: m.customerId,
        message: msg,
      })
    }
  }

  // 3. List conversion actions per non-manager (de-dup by customerId — managers
  //    podem aparecer na lista direta + via managed)
  const uniqueNonManagers = new Map<string, CustomerInfo>()
  for (const c of customerInfos.filter((c) => !c.isManager)) {
    if (!uniqueNonManagers.has(c.customerId)) {
      uniqueNonManagers.set(c.customerId, c)
    }
  }
  for (const c of uniqueNonManagers.values()) {
    let conversionActions: ConversionActionInfo[] = []
    try {
      conversionActions = await listConversionActions({
        accessToken: input.accessToken,
        customerId: c.customerId,
        loginCustomerId: c.managerCustomerId,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      result.errors.push({
        phase: 'listConversionActions',
        customerId: c.customerId,
        message: msg,
      })
    }
    result.customers.push({ ...c, conversionActions })
  }

  authLogger.info(
    {
      customers: result.customers.length,
      managers: result.managers.length,
      errors: result.errors.length,
    },
    'google ads metadata discovery completed'
  )
  return result
}
