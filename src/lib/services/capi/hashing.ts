import crypto from 'node:crypto'

import {
  hashEmail as securityHashEmail,
  normalizeEmail as securityNormalizeEmail,
  normalizePhoneE164,
} from '@/lib/security/hash'

/**
 * PII hashing pra CAPI fanout (Meta + Google EC) — Sessao 1.4.9.
 *
 * Decisao: reusa primitivas de `src/lib/security/hash.ts` (hashEmail,
 * normalizePhoneE164 etc — ja usados por Hotmart/Kiwify/Eduzz adapters)
 * e estende com:
 *  - Variante phone Google (com `+`) vs Meta (sem `+`)
 *  - Campos Meta P1 que nao tem helper: fn, ln, db, ge, ct, st, zp, country
 *  - external_id (string raw normalizada)
 *  - Namespace `hashForMeta` / `hashForGoogle` pra clareza no adapter
 *
 * Convencoes:
 *  - SHA-256 lowercase hex (default node:crypto)
 *  - Hashing PURO (sem salt) — Meta/Google comparam contra hashes do
 *    Pixel/Tag cliente, qualquer salt nosso quebraria match. Salt e
 *    reservado pra IP/UA/CPF (via `hmac` em security/hash.ts).
 *  - Normalizers retornam `string | null` — null = nao enviar campo
 *    (Meta/Google: campo ausente e melhor que hash de string vazia).
 *  - High-level hashers (hashForMeta.*, hashForGoogle.*) tambem retornam
 *    `string | null` — adapter checa explicitamente antes de embutir
 *    no payload.
 *
 * Diferencas Meta vs Google:
 *  - Phone: Meta `5511999998888`, Google `+5511999998888` (com `+`)
 *  - Email e external_id: identicos (lowercase + trim → SHA-256)
 *  - Names: ambos lowercase + trim + sem pontuacao/digitos; **preserva
 *    diacritos UTF-8** (Meta CAPI doc: "Special characters in non-English
 *    names are accepted"). Audit interno mencionou strip-diacritics mas
 *    a doc oficial Meta nao exige isso.
 *
 * Audit Meta 2026-05 §3: hashing e bug-prone. Test suite dedicado
 * (`hashing.test.ts`) cobre canonicos + edge cases BR.
 */

/** SHA-256 lowercase hex. Plain (sem salt). Exported pra testes. */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ---------------------------------------------------------------------------
// Normalizers — pure, retornam null pra input invalido
// ---------------------------------------------------------------------------

/**
 * Normaliza nome (fn/ln Meta + first_name/last_name Google).
 * Lowercase + trim + remove digitos/pontuacao/espacos. Preserva UTF-8
 * diacritos (`á é í ó ú ç ñ` etc).
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null
  // \p{L} matches any Unicode letter (preserva diacritos PT-BR)
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '')
  return cleaned || null
}

/**
 * YYYYMMDD (Meta db field). Aceita 'YYYY-MM-DD', 'DD/MM/YYYY' (BR),
 * 'YYYYMMDD' — tudo vira 8 digitos.
 *
 * NOTA: input 'DD/MM/YYYY' vira '15011990' mas Meta espera '19900115'
 * (year first). Caller deve passar formato consistente (ISO). Esta
 * funcao apenas extrai digitos — validar ordem cabe ao caller.
 */
export function normalizeDateOfBirth(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

/**
 * Meta `ge` field: single lowercase letter 'f' ou 'm'.
 * Aceita 'F', 'm', 'female', 'masculino', 'Feminino', 'M' — pega
 * primeiro caractere lowercase.
 */
export function normalizeGender(raw: string | null | undefined): 'f' | 'm' | null {
  if (!raw) return null
  const c = raw.trim().toLowerCase().charAt(0)
  return c === 'f' || c === 'm' ? c : null
}

/**
 * Meta `ct` field: lowercase + remove spaces/pontuacao/digitos.
 * Preserva diacritos UTF-8 (cidades BR: 'São Paulo' → 'sãopaulo').
 */
export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '')
  return cleaned || null
}

/**
 * Meta `st` field: 2-letter lowercase state code. Rejeita input
 * que nao seja exatamente 2 chars apos trim+lowercase (caller deve
 * passar abreviacao, nao nome completo — 'SP' OK, 'Sao Paulo' rejected).
 */
export function normalizeStateCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const c = raw.trim().toLowerCase().replace(/\s/g, '')
  return c.length === 2 && /^[a-z]{2}$/.test(c) ? c : null
}

/**
 * Meta `zp` field. BR (default): strip pontuacao, lowercase, sem espacos.
 * US: primeiros 5 digitos do ZIP.
 *
 * Audit Meta: "First 5 chars of zip (US); for other countries use full
 * code with no spaces". CEP BR aceita '01310-100' ou '01310100' → '01310100'.
 */
export function normalizeZip(
  raw: string | null | undefined,
  countryCode: string = 'br'
): string | null {
  if (!raw) return null
  if (countryCode.toLowerCase() === 'us') {
    const digits = raw.replace(/\D/g, '').slice(0, 5)
    return digits.length === 5 ? digits : null
  }
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]/g, '')
  return cleaned || null
}

/**
 * Meta `country` field: 2-letter ISO 3166-1 alpha-2 lowercase. Rejeita
 * input que nao seja exatamente 2 chars (caller passa 'BR', 'US' — nao
 * nome completo).
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const c = raw.trim().toLowerCase()
  return c.length === 2 && /^[a-z]{2}$/.test(c) ? c : null
}

/**
 * external_id Meta. Genérico (uuid, hash, identifier interno). Lowercase
 * + trim. Nao strip outros caracteres — external_id pode ter `-`, `_`, etc.
 */
export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toLowerCase()
  return cleaned || null
}

/**
 * Phone normalizado pro formato Meta CAPI (E.164 SEM `+`). Reusa
 * `security.normalizePhoneE164` (TD-107 fechado — bug intl corrigido).
 * Retorna null pra input invalido ou muito curto (sem `+` ja-prefixado).
 */
export function normalizePhoneMeta(raw: string | null | undefined): string | null {
  if (!raw) return null
  const e164 = normalizePhoneE164(raw)
  if (!e164) return null
  // Caso edge: 4-9 digits sem `+` → security retorna digits sem `+`.
  // E.164 valido tem >=10 digits ou `+` prefix.
  if (!e164.startsWith('+')) return null
  return e164.slice(1) || null
}

/**
 * Phone normalizado pro formato Google EC (E.164 COM `+`).
 */
export function normalizePhoneGoogle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const e164 = normalizePhoneE164(raw)
  if (!e164) return null
  // Mesmo edge case do Meta: sem `+` significa input invalido.
  if (!e164.startsWith('+')) return null
  return e164
}

// ---------------------------------------------------------------------------
// High-level hashers — normalize + sha256, retorna null se invalido
// ---------------------------------------------------------------------------

function hashOrNull(normalized: string | null): string | null {
  return normalized ? sha256Hex(normalized) : null
}

/**
 * Helpers pra construir `user_data` Meta CAPI. Cada metodo retorna
 * SHA-256 lowercase hex ou null (= nao incluir no payload).
 *
 * Reusa `security.hashEmail` quando ja existe pra manter unica fonte
 * de verdade — adapter externo (Hotmart/Kiwify) ja chama esse helper
 * e os hashes precisam matchear.
 */
export const hashForMeta = {
  email(raw: string | null | undefined): string | null {
    if (!raw) return null
    const normalized = securityNormalizeEmail(raw)
    if (!normalized) return null
    return securityHashEmail(raw) || null
  },
  phone(raw: string | null | undefined): string | null {
    return hashOrNull(normalizePhoneMeta(raw))
  },
  externalId(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeExternalId(raw))
  },
  firstName(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeName(raw))
  },
  lastName(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeName(raw))
  },
  dateOfBirth(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeDateOfBirth(raw))
  },
  gender(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeGender(raw))
  },
  city(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeCity(raw))
  },
  state(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeStateCode(raw))
  },
  zip(raw: string | null | undefined, countryCode?: string): string | null {
    return hashOrNull(normalizeZip(raw, countryCode))
  },
  country(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeCountryCode(raw))
  },
}

/**
 * Helpers pra construir `user_identifiers` Google EC. Schema mais
 * enxuto que Meta — Google foca em email, phone, e address_info
 * (first_name, last_name, postal_code, country_code).
 *
 * Email e externalId hashing identico ao Meta (mesma normalizacao).
 * Phone difere: Google quer `+` prefix.
 */
export const hashForGoogle = {
  email(raw: string | null | undefined): string | null {
    return hashForMeta.email(raw)
  },
  phone(raw: string | null | undefined): string | null {
    return hashOrNull(normalizePhoneGoogle(raw))
  },
  externalId(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeExternalId(raw))
  },
  firstName(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeName(raw))
  },
  lastName(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeName(raw))
  },
  zip(raw: string | null | undefined, countryCode?: string): string | null {
    return hashOrNull(normalizeZip(raw, countryCode))
  },
  country(raw: string | null | undefined): string | null {
    return hashOrNull(normalizeCountryCode(raw))
  },
}
