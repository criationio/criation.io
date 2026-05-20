import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

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

// TD-022 — Sentry wrap.
//
// SEMPRE wrap quando DSN configurado — `withSentryConfig` faz webpack/turbopack
// instrumentation que e necessario pro SDK funcionar em runtime (nao so source
// maps). Sem o wrap, instrumentation.ts roda mas SDK fica em estado parcial.
//
// `org` + `project` + `authToken` so sao necessarios pra upload de source maps
// no build. Sem eles, stack traces ficam minified mas SDK funciona.
const hasSentryDsn = !!process.env.NEXT_PUBLIC_SENTRY_DSN
const hasSentrySourceMapsUpload =
  !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT && !!process.env.SENTRY_AUTH_TOKEN

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      // Source maps upload — condicional. Sem essas envs, Sentry CLI pula
      // upload mas SDK runtime segue funcionando.
      ...(hasSentrySourceMapsUpload && {
        org: process.env.SENTRY_ORG!,
        project: process.env.SENTRY_PROJECT!,
        widenClientFileUpload: true,
      }),
      silent: !process.env.CI,
      // Tree-shake Sentry logger statements em prod
      disableLogger: true,
      // Tunnel pra evitar adblockers — usa /monitoring no app
      tunnelRoute: '/monitoring',
    })
  : nextConfig
