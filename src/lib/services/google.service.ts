import crypto from 'node:crypto'

import { env } from '@/env'
import { authLogger } from '@/lib/logger'

/**
 * Google OAuth + metadata service (1.4.9.B / ADR-015).
 *
 * Concerns:
 *  - PKCE code_verifier/challenge (PKCE obrigatorio em "Desktop"/"Web" public clients)
 *  - Authorization URL builder (consent screen com 3 scopes na mesma tela)
 *  - Token exchange (code -> access + refresh)
 *  - Token refresh (refresh_token -> novo access)
 *  - User info (sub, email, name) via OpenID userinfo
 *
 * NAO faz: chamadas Data Manager API (vao em `capi/google.adapter.ts` +
 * `capi/google.service.ts`) ou Google Ads API REST metadata (vao em
 * `services/google-ads-metadata.service.ts` no Step 4).
 *
 * Decisao ADR-015: 3 scopes pedidos na MESMA consent screen
 * (`auth/datamanager` + `auth/adwords` + `auth/cloud-platform`). Sensitive,
 * verification obrigatoria — submeter em paralelo a 1.4.9.B (2-6 semanas).
 */

const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/datamanager',
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/cloud-platform',
  'openid',
  'email',
  'profile',
] as const

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errorCode?: string,
    public readonly errorDescription?: string
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers — RFC 7636
// ---------------------------------------------------------------------------

/**
 * Gera code_verifier (43-128 chars, URL-safe base64 sem padding) + challenge
 * (SHA-256 do verifier, base64url-encoded). Verifier persistido em Upstash
 * via oauth-state.service. Challenge enviado no /auth URL.
 */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const verifierBytes = crypto.randomBytes(32) // 32 bytes => 43 chars base64url
  const codeVerifier = verifierBytes.toString('base64url')
  const challengeBytes = crypto.createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = challengeBytes.toString('base64url')
  return { codeVerifier, codeChallenge }
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export interface BuildAuthUrlInput {
  state: string
  codeChallenge: string
  redirectUri: string
  /** Opcional. Se passado, Google sugere essa conta na consent screen.
   * Quando user ja tem conta Google logada, evita perguntar de novo. */
  loginHint?: string
}

export function buildAuthUrl(input: BuildAuthUrlInput): string {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new GoogleApiError('GOOGLE_OAUTH_CLIENT_ID nao configurado')
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES.join(' '),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    // access_type=offline + prompt=consent garante refresh_token retornado
    // (Google so manda refresh_token na primeira autorizacao OU quando user
    // ve consent screen novamente).
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  if (input.loginHint) params.set('login_hint', input.loginHint)
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export interface GoogleTokenResponse {
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number
  scope: string
  tokenType: string
  idToken: string | null
}

/**
 * Troca authorization code por tokens (access + refresh + id_token).
 * Requer code_verifier que matcha o code_challenge da chamada /auth.
 */
export async function exchangeCodeForToken(input: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new GoogleApiError('GOOGLE_OAUTH_CLIENT_ID/SECRET nao configurados')
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  })
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  return parseTokenResponse(res, 'exchangeCodeForToken')
}

/**
 * Troca refresh_token por novo access_token. Refresh tokens Google nao
 * expiram por tempo (ate user revogar ou 6m inatividade em apps unverified).
 *
 * Erro mais comum: `invalid_grant` quando user revogou ou 50 refresh tokens
 * limit em app unverified.
 */
export async function refreshAccessToken(input: {
  refreshToken: string
}): Promise<GoogleTokenResponse> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new GoogleApiError('GOOGLE_OAUTH_CLIENT_ID/SECRET nao configurados')
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  })
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  return parseTokenResponse(res, 'refreshAccessToken')
}

async function parseTokenResponse(res: Response, operation: string): Promise<GoogleTokenResponse> {
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    // non-JSON response (HTML error page)
  }

  if (!res.ok) {
    const errorCode = typeof json.error === 'string' ? json.error : undefined
    const errorDescription =
      typeof json.error_description === 'string' ? json.error_description : undefined
    authLogger.error(
      { operation, status: res.status, errorCode, errorDescription },
      'google oauth token endpoint error'
    )
    throw new GoogleApiError(
      errorDescription ?? errorCode ?? `google_oauth_http_${res.status}`,
      res.status,
      errorCode,
      errorDescription
    )
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : null
  if (!accessToken) {
    throw new GoogleApiError(`${operation}: access_token ausente na resposta`, res.status)
  }
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresInSeconds: typeof json.expires_in === 'number' ? json.expires_in : 3600,
    scope: typeof json.scope === 'string' ? json.scope : '',
    tokenType: typeof json.token_type === 'string' ? json.token_type : 'Bearer',
    idToken: typeof json.id_token === 'string' ? json.id_token : null,
  }
}

// ---------------------------------------------------------------------------
// User info (OpenID)
// ---------------------------------------------------------------------------

export interface GoogleUserInfo {
  sub: string
  email: string | null
  name: string | null
  emailVerified: boolean
}

/**
 * Obtem identidade Google (sub + email + name). Usado pra popular
 * `google_connections.google_user_id/email/name` pos-OAuth.
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new GoogleApiError(`getUserInfo http ${res.status}`, res.status)
  }
  const json = (await res.json()) as Record<string, unknown>
  const sub = typeof json.sub === 'string' ? json.sub : null
  if (!sub) {
    throw new GoogleApiError('getUserInfo: sub ausente na resposta')
  }
  return {
    sub,
    email: typeof json.email === 'string' ? json.email : null,
    name: typeof json.name === 'string' ? json.name : null,
    emailVerified: json.email_verified === true,
  }
}

// ---------------------------------------------------------------------------
// Scope parsing
// ---------------------------------------------------------------------------

export interface GrantedScopeFlags {
  dataManager: boolean
  adwords: boolean
  cloudPlatform: boolean
  openid: boolean
  email: boolean
  profile: boolean
}

/**
 * Parse scope string retornada no token response. Google manda como
 * space-separated. Retorna flags por scope canonico — Adapter checa
 * `granted_data_manager_scope` antes do fanout (gracefully skips).
 */
export function parseGrantedScopes(scopeString: string): {
  scopes: string[]
  flags: GrantedScopeFlags
} {
  const scopes = scopeString
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    scopes,
    flags: {
      dataManager: scopes.includes('https://www.googleapis.com/auth/datamanager'),
      adwords: scopes.includes('https://www.googleapis.com/auth/adwords'),
      cloudPlatform: scopes.includes('https://www.googleapis.com/auth/cloud-platform'),
      openid: scopes.includes('openid'),
      email:
        scopes.includes('email') ||
        scopes.includes('https://www.googleapis.com/auth/userinfo.email'),
      profile:
        scopes.includes('profile') ||
        scopes.includes('https://www.googleapis.com/auth/userinfo.profile'),
    },
  }
}
