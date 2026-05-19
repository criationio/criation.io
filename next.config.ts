import type { NextConfig } from 'next'

// Security headers aplicados globalmente em todas as respostas do app.
//
// Strategy: enforce direto pros headers consagrados (HSTS, X-Frame-Options,
// etc) e CSP em Report-Only pra coletar violacoes sem quebrar nada no
// primeiro deploy. Apos 1-2 semanas observando relatorios via DevTools
// console, migrar pra `Content-Security-Policy` (enforce) e — idealmente —
// strict CSP com nonce via middleware (TD-024b).
//
// Decisao: nao usar Cross-Origin-Resource-Policy global porque
// `/criation-tracking.js` precisa ser carregavel cross-origin por sites
// cliente (script tag nao requer CORS, mas CORP `same-origin` bloquearia
// o response). Mantemos o default permissivo.
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
]

// CSP em Report-Only. `unsafe-inline`/`unsafe-eval` necessarios porque
// Next.js 16 App Router injeta scripts/styles inline no SSR. Migrar pra
// nonce-based em TD-024b.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // Webhooks de gateways (Hotmart, etc) podem chegar com ou sem trailing
  // slash. Hotmart NAO segue redirects 308, entao deixamos o handler aceitar
  // ambas as variantes em vez de redirecionar.
  skipTrailingSlashRedirect: true,

  // Remove header `X-Powered-By: Next.js` (tech stack leak minimo).
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          ...SECURITY_HEADERS,
          {
            key: 'Content-Security-Policy-Report-Only',
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ]
  },
}

export default nextConfig
