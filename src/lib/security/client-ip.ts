interface HeaderLike {
  get(name: string): string | null
}

type HeaderSource = HeaderLike | { headers: HeaderLike }

/**
 * Extrai IP do cliente respeitando proxies (Vercel, Cloudflare).
 * Ordem: x-forwarded-for (primeiro IP da lista) > x-real-ip > 'unknown'.
 *
 * Aceita qualquer objeto Headers-like: NextRequest, Request, ReadonlyHeaders
 * (next/headers), ou Headers nativo.
 */
export function getClientIp(source: HeaderSource): string {
  const headers: HeaderLike =
    'headers' in source && typeof (source as { headers: HeaderLike }).headers?.get === 'function'
      ? (source as { headers: HeaderLike }).headers
      : (source as HeaderLike)

  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp

  return 'unknown'
}
