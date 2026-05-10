import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { env } from '@/env'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

type Unit = 's' | 'm' | 'h' | 'd'
type WindowSpec = `${number}${Unit}`
type LimitSpec = `${number}/${WindowSpec}`

export function ratelimit(name: string, spec: LimitSpec): Ratelimit {
  const [countPart, windowPart] = spec.split('/') as [string, WindowSpec]
  const count = Number.parseInt(countPart, 10)
  const m = windowPart.match(/^(\d+)([smhd])$/)
  if (!m) throw new Error(`Invalid window spec: ${windowPart}`)
  const num = Number.parseInt(m[1] ?? '1', 10)
  const unit = (m[2] ?? 'm') as Unit
  const duration = `${num} ${unit}` as `${number} ${Unit}`

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(count, duration),
    prefix: `rl:${name}`,
    analytics: true,
  })
}

export const signupLimiter = ratelimit('signup', '3/1h')
export const loginLimiter = ratelimit('login', '5/1m')
export const resetLimiter = ratelimit('reset', '3/1h')
export const magicLinkLimiter = ratelimit('magic', '3/1h')
