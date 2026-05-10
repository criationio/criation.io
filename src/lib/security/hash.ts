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
 * Normaliza telefone para E.164. Strip de tudo que nao e digit, e prefix
 * `+55` quando vem sem codigo de pais BR (heuristica: 10 ou 11 digitos
 * comecando com DDD valido). Conservador: nao tenta inferir outros paises.
 */
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  // Ja vem com codigo de pais (12-15 digitos com 55 no inicio ou outro)
  if (digits.length >= 12) return `+${digits}`
  // BR sem codigo: 10 (fixo) ou 11 (movel) digitos
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  // Curto demais ou formato desconhecido — devolve digits sem `+` para
  // o caller decidir. Hash de string vazia/curta e baixa entropia, mas
  // o normalizer do parser ja deve filtrar.
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
