import { z } from 'zod/v4'

import { env } from '@/env'

const GRAPH_BASE = 'https://graph.facebook.com'

function graphUrl(path: string): string {
  const v = env.META_GRAPH_VERSION
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${GRAPH_BASE}/${v}${clean}`
}

/**
 * Scopes pedidos no OAuth dialog. Conjunto minimo para Sessao 1.3
 * funcionar em Dev Mode sem App Review:
 *   - ads_read: ler campanhas, ad accounts, insights basicos
 *   - ads_management: enviar conversoes via CAPI (Sessao 1.4.9)
 *   - business_management: ler /me/businesses + owned_ad_accounts + owned_pixels
 *   - pages_show_list, pages_read_engagement: ler paginas vinculadas
 *   - public_profile: auto-granted, retorna id+name em /me
 *
 * Scopes adiados para sessoes futuras:
 *   - email: em Login for Business eh via Configuration/config_id, nao scope.
 *     Adicionar quando refatorar OAuth para usar config_id (UX cosmetica).
 *   - read_insights: pra Page Insights, nao Ads. Nao usamos no roadmap atual.
 *   - instagram_basic: exige produto Instagram Graph API. Adicionar quando
 *     analise distinguir IG vs FB explicitamente.
 */
export const META_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'public_profile',
] as const

const metaErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
  }),
})

export class MetaApiError extends Error {
  constructor(
    public readonly code: number | undefined,
    public readonly subcode: number | undefined,
    message: string,
    public readonly fbtraceId?: string
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

async function metaFetch<T>(url: string, init: RequestInit & { schema: z.ZodType<T> }): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new MetaApiError(
      undefined,
      undefined,
      `Resposta nao-JSON da Meta API: ${text.slice(0, 200)}`
    )
  }

  if (!res.ok) {
    const parsed = metaErrorSchema.safeParse(data)
    if (parsed.success) {
      const e = parsed.data.error
      throw new MetaApiError(e.code, e.error_subcode, e.message, e.fbtrace_id)
    }
    throw new MetaApiError(undefined, undefined, `HTTP ${res.status}: ${text.slice(0, 200)}`)
  }

  const parsed = init.schema.safeParse(data)
  if (!parsed.success) {
    throw new MetaApiError(
      undefined,
      undefined,
      `Resposta da Meta API nao bate com schema esperado: ${parsed.error.message}`
    )
  }
  return parsed.data
}

// ============================================================
// OAuth: code -> token
// ============================================================

const tokenExchangeSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export interface OAuthTokenResult {
  accessToken: string
  expiresInSeconds: number | null
}

/**
 * Step 1: troca o `code` recebido no callback por short-lived token (~1h).
 */
export async function exchangeCodeForToken(input: {
  code: string
  redirectUri: string
}): Promise<OAuthTokenResult> {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: input.redirectUri,
    code: input.code,
  })

  const data = await metaFetch(graphUrl(`/oauth/access_token?${params.toString()}`), {
    method: 'GET',
    schema: tokenExchangeSchema,
  })

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in ?? null,
  }
}

/**
 * Step 2: troca o short-lived token por long-lived (~60d).
 */
export async function extendToLongLivedToken(input: {
  shortLivedToken: string
}): Promise<OAuthTokenResult> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: input.shortLivedToken,
  })

  const data = await metaFetch(graphUrl(`/oauth/access_token?${params.toString()}`), {
    method: 'GET',
    schema: tokenExchangeSchema,
  })

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in ?? null,
  }
}

// ============================================================
// /me + permissions
// ============================================================

const meSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
})

export interface MetaUserInfo {
  id: string
  name: string | null
  email: string | null
}

export async function getMe(accessToken: string): Promise<MetaUserInfo> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,email',
  })
  const data = await metaFetch(graphUrl(`/me?${params.toString()}`), {
    method: 'GET',
    schema: meSchema,
  })
  return {
    id: data.id,
    name: data.name ?? null,
    email: data.email ?? null,
  }
}

const permissionsSchema = z.object({
  data: z.array(
    z.object({
      permission: z.string(),
      status: z.enum(['granted', 'declined', 'expired']),
    })
  ),
})

export interface PermissionEntry {
  permission: string
  status: 'granted' | 'declined' | 'expired'
}

export async function listPermissions(accessToken: string): Promise<PermissionEntry[]> {
  const params = new URLSearchParams({ access_token: accessToken })
  const data = await metaFetch(graphUrl(`/me/permissions?${params.toString()}`), {
    method: 'GET',
    schema: permissionsSchema,
  })
  return data.data
}

// ============================================================
// Businesses + verification + verified domains
// ============================================================

const businessesSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      verification_status: z.string().optional(),
    })
  ),
})

export interface BusinessSummary {
  id: string
  name: string
  verificationStatus: string | null
}

export async function listBusinesses(accessToken: string): Promise<BusinessSummary[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,name,verification_status',
  })
  const data = await metaFetch(graphUrl(`/me/businesses?${params.toString()}`), {
    method: 'GET',
    schema: businessesSchema,
  })

  return data.data.map((b) => ({
    id: b.id,
    name: b.name,
    verificationStatus: b.verification_status ?? null,
  }))
}

// ============================================================
// Owned domains (endpoint dedicado a partir de v23+)
// ============================================================

const ownedDomainsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      is_verified: z.boolean().optional(),
    })
  ),
})

export interface OwnedDomain {
  domain: string
  verified: boolean
}

export async function listOwnedDomains(input: {
  accessToken: string
  businessId: string
}): Promise<OwnedDomain[]> {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,name,is_verified',
  })
  const data = await metaFetch(
    graphUrl(`/${input.businessId}/owned_domains?${params.toString()}`),
    {
      method: 'GET',
      schema: ownedDomainsSchema,
    }
  )

  return data.data.map((d) => ({
    domain: d.name,
    verified: d.is_verified ?? false,
  }))
}

// ============================================================
// Ad accounts (per business)
// ============================================================

const adAccountsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(), // 'act_1234'
      account_id: z.string().optional(),
      name: z.string().optional(),
      currency: z.string().optional(),
      timezone_name: z.string().optional(),
      account_status: z.number().optional(),
      business: z
        .object({
          id: z.string(),
          name: z.string().optional(),
        })
        .optional(),
    })
  ),
})

export interface AdAccountSummary {
  id: string // 'act_xxx'
  accountId: string // numeric only
  name: string | null
  currency: string | null
  timezoneName: string | null
  accountStatus: number | null
  businessId: string | null
}

export async function listOwnedAdAccounts(input: {
  accessToken: string
  businessId: string
}): Promise<AdAccountSummary[]> {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,account_id,name,currency,timezone_name,account_status,business',
  })
  const data = await metaFetch(
    graphUrl(`/${input.businessId}/owned_ad_accounts?${params.toString()}`),
    {
      method: 'GET',
      schema: adAccountsSchema,
    }
  )

  return data.data.map((a) => ({
    id: a.id,
    accountId: a.account_id ?? a.id.replace(/^act_/, ''),
    name: a.name ?? null,
    currency: a.currency ?? null,
    timezoneName: a.timezone_name ?? null,
    accountStatus: a.account_status ?? null,
    businessId: a.business?.id ?? input.businessId,
  }))
}

/**
 * Lista ad accounts diretamente do user (sem filtrar por business).
 * Util quando user nao tem BM ou nos quer pegar tudo de uma vez.
 */
export async function listMyAdAccounts(accessToken: string): Promise<AdAccountSummary[]> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,account_id,name,currency,timezone_name,account_status,business',
  })
  const data = await metaFetch(graphUrl(`/me/adaccounts?${params.toString()}`), {
    method: 'GET',
    schema: adAccountsSchema,
  })

  return data.data.map((a) => ({
    id: a.id,
    accountId: a.account_id ?? a.id.replace(/^act_/, ''),
    name: a.name ?? null,
    currency: a.currency ?? null,
    timezoneName: a.timezone_name ?? null,
    accountStatus: a.account_status ?? null,
    businessId: a.business?.id ?? null,
  }))
}

// ============================================================
// Pixels
// ============================================================

const pixelsSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      last_fired_time: z.string().optional(),
    })
  ),
})

export interface PixelSummary {
  id: string
  name: string | null
  lastFiredAt: Date | null
}

export async function listOwnedPixels(input: {
  accessToken: string
  businessId: string
}): Promise<PixelSummary[]> {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,name,last_fired_time',
  })
  const data = await metaFetch(graphUrl(`/${input.businessId}/owned_pixels?${params.toString()}`), {
    method: 'GET',
    schema: pixelsSchema,
  })

  return data.data.map((p) => ({
    id: p.id,
    name: p.name ?? null,
    lastFiredAt: p.last_fired_time ? new Date(p.last_fired_time) : null,
  }))
}
