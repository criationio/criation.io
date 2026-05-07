import crypto from 'node:crypto'

import { env } from '@/env'

/**
 * HMAC-SHA256 com salt da env. Use para hashear PII como IP, user agent
 * e fingerprint antes de persistir. O salt fica fora do banco — vazamento
 * do dump nao permite re-identificacao trivial.
 */
function hmac(value: string): string {
  const salt = Buffer.from(env.HASH_SALT, 'base64')
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

export function hashIp(ip: string): string {
  return hmac(ip)
}

export function hashUserAgent(ua: string): string {
  return hmac(ua)
}
