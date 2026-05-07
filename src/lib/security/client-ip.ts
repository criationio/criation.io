import type { NextRequest } from 'next/server'

type HeaderSource = NextRequest | Request | { headers: Headers }

/**
 * Extrai IP do cliente respeitando proxies (Vercel, Cloudflare).
 * Ordem: x-forwarded-for (primeiro IP da lista) > x-real-ip > 'unknown'.
 */
export function getClientIp(source: HeaderSource): string {
  const headers = 'headers' in source ? source.headers : (source as Headers)

  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp

  return 'unknown'
}
