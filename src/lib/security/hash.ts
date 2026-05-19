import crypto from 'node:crypto'

/**
 * HMAC-SHA256 com salt da env. Use para hashear PII como IP, user agent
 * e fingerprint antes de persistir. O salt fica fora do banco — vazamento
 * do dump nao permite re-identificacao trivial.
 *
 * Le `process.env.HASH_SALT` direto (sem wrapper t3-env) porque este modulo
 * roda em Node em qualquer contexto (server actions, Trigger.dev, jobs) e
 * o wrapper bloqueia uso em vitest jsdom.
 */
function getSalt(): Buffer {
  const raw = process.env.HASH_SALT
  if (!raw) throw new Error('HASH_SALT env var missing')
  return Buffer.from(raw, 'base64')
}

function hmac(value: string): string {
  return crypto.createHmac('sha256', getSalt()).update(value).digest('hex')
}

/**
 * SHA-256 puro (sem salt). Usado quando o destino consome o hash em
 * comparacoes cross-system (ex: Meta CAPI exige sha256 lowercase do
 * email normalizado, sem salt). Nunca use para IP/user-agent — usar `hmac`.
 */
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function hashIp(ip: string): string {
  return hmac(ip)
}

export function hashUserAgent(ua: string): string {
  return hmac(ua)
}

/**
 * Normaliza email: lowercase + trim. Reservado para input que vai virar
 * `hashEmail` ou comparacoes case-insensitive. Nao use para display.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Normaliza telefone para E.164. Preserva codigo de pais quando vem
 * com `+` explicito (`+14155551234` → `+14155551234`, nao prepend BR).
 * Sem `+`, heuristica: 10-11 digitos = BR (prepend 55), 12-15 = ja E.164.
 *
 * TD-107 (fechado 2026-05-12): versao anterior assumia BR pra qualquer
 * 10-11 digits, mesmo quando input tinha `+1...` (US). Hash de phone
 * intl saia com `+5514...` errado, degradando EMQ em clientes Agency
 * com phones nao-BR.
 */
export function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim()
  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''

  // Input com `+`: trust country code declarado, nao prepend BR
  if (hadPlus) return `+${digits}`

  // Sem `+`, 12-15 digits = E.164 completo (ex: 5511999998888)
  if (digits.length >= 12) return `+${digits}`

  // Sem `+`, 10-11 digits = BR sem codigo (DDD + numero)
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`

  // Curto demais — devolve digits sem `+` pra caller decidir
  return digits
}

/**
 * Normaliza documento BR (CPF/CNPJ): strip de pontuacao. Nao valida
 * digito verificador — apenas prepara para hashing.
 */
export function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '')
}

/**
 * SHA-256 do email normalizado. Compativel com Meta CAPI (Customer Information
 * Parameters § email). Nao usa salt — receivers comparam contra mesmo hash.
 */
export function hashEmail(email: string): string {
  const normalized = normalizeEmail(email)
  if (!normalized) return ''
  return sha256(normalized)
}

/**
 * SHA-256 do telefone E.164. Meta CAPI espera `ph` no formato E.164 sem `+`,
 * mas mantemos o `+` no input pre-hash para consistencia interna; receivers
 * que precisam sem `+` re-normalizam. Nao usa salt.
 */
export function hashPhone(phone: string): string {
  const normalized = normalizePhoneE164(phone)
  if (!normalized) return ''
  // Meta CAPI: hash sem o `+` prefix
  return sha256(normalized.replace(/^\+/, ''))
}

/**
 * SHA-256 do documento normalizado (CPF ou CNPJ). LGPD-sensitive — nunca
 * loggar plain. Usa HMAC com salt para evitar dictionary attack a hashes
 * conhecidos (CPF tem espaco de busca tratavel).
 */
export function hashDocument(doc: string): string {
  const normalized = normalizeDocument(doc)
  if (!normalized) return ''
  return hmac(normalized)
}
