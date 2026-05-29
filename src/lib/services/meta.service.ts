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

// ============================================================
// Pagination helper (cursor-based via Graph API "paging.next")
// ============================================================

interface PagedResponse<T> {
  data: T[]
  paging?:
    | { cursors?: { after?: string | undefined } | undefined; next?: string | undefined }
    | undefined
}

async function fetchAllPages<T>(input: {
  initialUrl: string
  schema: z.ZodType<PagedResponse<T>>
  maxPages?: number
  maxItems?: number
}): Promise<T[]> {
  const maxPages = input.maxPages ?? 20
  const maxItems = input.maxItems ?? 1000
  let url: string | null = input.initialUrl
  const items: T[] = []
  let pageCount = 0

  while (url && pageCount < maxPages && items.length < maxItems) {
    const data: PagedResponse<T> = await metaFetch(url, { method: 'GET', schema: input.schema })
    items.push(...data.data)
    url = data.paging?.next ?? null
    pageCount += 1
  }

  return items.slice(0, maxItems)
}

// ============================================================
// Campaigns
// ============================================================

const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  effective_status: z.string().optional(),
  objective: z.string().optional(),
  daily_budget: z.string().optional(),
  lifetime_budget: z.string().optional(),
  start_time: z.string().optional(),
  stop_time: z.string().optional(),
})

const campaignsPagedSchema = z.object({
  data: z.array(campaignSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
})

export interface CampaignSummary {
  id: string
  name: string
  status: string
  effectiveStatus: string | null
  objective: string | null
  dailyBudgetCents: number | null
  lifetimeBudgetCents: number | null
  startTime: Date | null
  stopTime: Date | null
}

function metaBudgetToCents(s: string | undefined | null): number | null {
  if (!s) return null
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

export async function listCampaigns(input: {
  accessToken: string
  adAccountId: string // formato 'act_123' OU '123'
  limit?: number
}): Promise<CampaignSummary[]> {
  const accountId = input.adAccountId.startsWith('act_')
    ? input.adAccountId
    : `act_${input.adAccountId}`
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields:
      'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time',
    limit: String(input.limit ?? 100),
  })

  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${accountId}/campaigns?${params.toString()}`),
    schema: campaignsPagedSchema,
    maxItems: input.limit ?? 100,
  })

  return items.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    effectiveStatus: c.effective_status ?? null,
    objective: c.objective ?? null,
    dailyBudgetCents: metaBudgetToCents(c.daily_budget),
    lifetimeBudgetCents: metaBudgetToCents(c.lifetime_budget),
    startTime: c.start_time ? new Date(c.start_time) : null,
    stopTime: c.stop_time ? new Date(c.stop_time) : null,
  }))
}

// ============================================================
// Ad Sets
// ============================================================

const adSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  effective_status: z.string().optional(),
  campaign_id: z.string(),
  targeting: z.unknown().optional(),
})

const adSetsPagedSchema = z.object({
  data: z.array(adSetSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
})

export interface AdSetSummary {
  id: string
  name: string
  status: string
  effectiveStatus: string | null
  campaignId: string
  targeting: unknown
}

export async function listAdSets(input: {
  accessToken: string
  campaignId: string
  limit?: number
}): Promise<AdSetSummary[]> {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,name,status,effective_status,campaign_id,targeting',
    limit: String(input.limit ?? 100),
  })

  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${input.campaignId}/adsets?${params.toString()}`),
    schema: adSetsPagedSchema,
    maxItems: input.limit ?? 100,
  })

  return items.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    effectiveStatus: s.effective_status ?? null,
    campaignId: s.campaign_id,
    targeting: s.targeting ?? null,
  }))
}

// ============================================================
// Ads
// ============================================================

const adSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  effective_status: z.string().optional(),
  adset_id: z.string(),
  creative: z.object({ id: z.string() }).optional(),
})

const adsPagedSchema = z.object({
  data: z.array(adSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
})

export interface AdSummary {
  id: string
  name: string
  status: string
  effectiveStatus: string | null
  adSetId: string
  creativeId: string | null
}

export async function listAds(input: {
  accessToken: string
  adSetId: string
  limit?: number
}): Promise<AdSummary[]> {
  const params = new URLSearchParams({
    access_token: input.accessToken,
    fields: 'id,name,status,effective_status,adset_id,creative{id}',
    limit: String(input.limit ?? 100),
  })

  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${input.adSetId}/ads?${params.toString()}`),
    schema: adsPagedSchema,
    maxItems: input.limit ?? 100,
  })

  return items.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    effectiveStatus: a.effective_status ?? null,
    adSetId: a.adset_id,
    creativeId: a.creative?.id ?? null,
  }))
}

// ============================================================
// Ad Insights (level=ad, breakdown=date, last 7d)
// ============================================================

const insightsActionSchema = z.object({
  action_type: z.string(),
  value: z.string(),
})

const insightSchema = z.object({
  ad_id: z.string(),
  date_start: z.string(),
  date_stop: z.string().optional(),
  impressions: z.string().optional(),
  clicks: z.string().optional(),
  spend: z.string().optional(),
  reach: z.string().optional(),
  frequency: z.string().optional(),
  ctr: z.string().optional(),
  cpc: z.string().optional(),
  cpm: z.string().optional(),
  video_play_actions: z.array(insightsActionSchema).optional(),
  video_3_sec_watched_actions: z.array(insightsActionSchema).optional(),
  video_15_sec_watched_actions: z.array(insightsActionSchema).optional(),
  video_30_sec_watched_actions: z.array(insightsActionSchema).optional(),
  actions: z.array(insightsActionSchema).optional(),
})

const insightsPagedSchema = z.object({
  data: z.array(insightSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
})

export interface AdInsightSummary {
  adId: string
  date: string // YYYY-MM-DD
  impressions: number
  clicks: number
  spendCents: number
  reach: number
  frequency: number | null
  ctr: number | null // 0..1 (decimal, nao %)
  cpcCents: number | null
  cpmCents: number | null
  videoViews: number
  hookRate: number | null // video_3s / impressions
  holdRate15s: number | null // video_15s / video_3s
  holdRate30s: number | null // video_30s / video_3s
}

function pickActionValue(
  actions: { action_type: string; value: string }[] | undefined,
  type: string
): number {
  if (!actions) return 0
  const match = actions.find((a) => a.action_type === type)
  return match ? Number.parseFloat(match.value) || 0 : 0
}

function dollarsToCents(s: string | undefined): number {
  if (!s) return 0
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function safeDecimal(s: string | undefined): number | null {
  if (!s) return null
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

export async function getAdInsights(input: {
  accessToken: string
  adAccountId: string
  datePreset?: string // 'last_7d' | 'last_30d' | etc.
  limit?: number
}): Promise<AdInsightSummary[]> {
  const accountId = input.adAccountId.startsWith('act_')
    ? input.adAccountId
    : `act_${input.adAccountId}`
  const params = new URLSearchParams({
    access_token: input.accessToken,
    level: 'ad',
    date_preset: input.datePreset ?? 'last_7d',
    time_increment: '1', // por dia
    // NOTA Meta v25: video_3_sec_watched_actions / video_15_sec_watched_actions /
    // video_30_sec_watched_actions foram descontinuados e fazem o endpoint
    // retornar HTTP 400 (#100). hookRate / holdRate ficam null por enquanto.
    // TD-pendente: migrar pra video_continuous_2_sec_watched_actions +
    // video_avg_time_watched_actions ou similar.
    fields:
      'ad_id,date_start,date_stop,impressions,clicks,spend,reach,frequency,ctr,cpc,cpm,' +
      'video_play_actions,actions',
    limit: String(input.limit ?? 500),
  })

  const items = await fetchAllPages({
    initialUrl: graphUrl(`/${accountId}/insights?${params.toString()}`),
    schema: insightsPagedSchema,
    maxItems: input.limit ?? 500,
    maxPages: 30,
  })

  return items.map((i) => {
    const impressions = Number.parseInt(i.impressions ?? '0', 10) || 0
    const video3s = pickActionValue(i.video_3_sec_watched_actions, 'video_view')
    const video15s = pickActionValue(i.video_15_sec_watched_actions, 'video_view')
    const video30s = pickActionValue(i.video_30_sec_watched_actions, 'video_view')
    const videoPlay = pickActionValue(i.video_play_actions, 'video_view')

    const ctrRaw = safeDecimal(i.ctr)

    return {
      adId: i.ad_id,
      date: i.date_start,
      impressions,
      clicks: Number.parseInt(i.clicks ?? '0', 10) || 0,
      spendCents: dollarsToCents(i.spend),
      reach: Number.parseInt(i.reach ?? '0', 10) || 0,
      frequency: safeDecimal(i.frequency),
      ctr: ctrRaw !== null ? ctrRaw / 100 : null, // Meta retorna em %
      cpcCents: dollarsToCents(i.cpc) || null,
      cpmCents: dollarsToCents(i.cpm) || null,
      videoViews: videoPlay,
      hookRate: video3s > 0 && impressions > 0 ? video3s / impressions : null,
      holdRate15s: video15s > 0 && video3s > 0 ? video15s / video3s : null,
      holdRate30s: video30s > 0 && video3s > 0 ? video30s / video3s : null,
    }
  })
}
