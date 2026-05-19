/**
 * Normalizacao de strings UTM pra match consistente entre
 * `gateway_events.utm_*` (vindo do gateway) e `campaigns.name` (vindo do Meta).
 *
 * Casos cobertos:
 * - Lowercase
 * - Strip diacritics (acentos): "promoção" → "promocao"
 * - Whitespace/separadores: `[-_\s]+` → `-`
 * - Trim
 * - Detector de Meta literal: `{{campaign.name}}` quando cliente esqueceu de
 *   configurar URL parameters dinamicos. Retorna `null` (sem normalizar)
 *   pra que o stitcher trate como erro de configuracao.
 *
 * Funcoes puras, deterministicas, testaveis.
 */

const META_LITERAL_REGEX = /\{\{[^}]+\}\}/

/**
 * Normaliza uma string UTM pra comparacao. Retorna `null` se a string
 * contem placeholder Meta literal nao-resolvido (`{{...}}`).
 */
export function normalizeUtm(input: string | null | undefined): string | null {
  if (input == null) return null
  const trimmed = String(input).trim()
  if (trimmed.length === 0) return null
  if (META_LITERAL_REGEX.test(trimmed)) return null

  return (
    trimmed
      .toLowerCase()
      .normalize('NFD')
      // strip diacritics (combining marks)
      .replace(/[̀-ͯ]/g, '')
      // unify separators: hyphens, underscores, spaces, multiple → single hyphen
      .replace(/[-_\s]+/g, '-')
      // remove trailing/leading hyphens after normalization
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * Detecta se a UTM contem placeholder Meta nao-resolvido. Cliente esqueceu de
 * configurar URL parameters no Meta Ads Manager — UTM literal `{{ad.name}}`
 * vai pro link em vez do valor real. Caso patologico que merece alerta UX.
 */
export function isMetaLiteral(input: string | null | undefined): boolean {
  if (input == null) return false
  return META_LITERAL_REGEX.test(String(input))
}

/**
 * Normaliza um conjunto de UTMs do gateway. Retorna `null` em campos com
 * literal Meta — caller decide o que fazer (geralmente: marcar unmatched
 * com strategy='meta_literal').
 */
export interface UtmSet {
  source?: string | null
  medium?: string | null
  campaign?: string | null
  content?: string | null
  term?: string | null
}

export interface NormalizedUtmSet {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  hasMetaLiteral: boolean
}

export function normalizeUtmSet(utms: UtmSet): NormalizedUtmSet {
  const hasMetaLiteral =
    isMetaLiteral(utms.source) ||
    isMetaLiteral(utms.medium) ||
    isMetaLiteral(utms.campaign) ||
    isMetaLiteral(utms.content) ||
    isMetaLiteral(utms.term)

  return {
    source: normalizeUtm(utms.source),
    medium: normalizeUtm(utms.medium),
    campaign: normalizeUtm(utms.campaign),
    content: normalizeUtm(utms.content),
    term: normalizeUtm(utms.term),
    hasMetaLiteral,
  }
}
