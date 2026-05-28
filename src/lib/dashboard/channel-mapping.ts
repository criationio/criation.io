/**
 * Mapeia utm_source (texto livre) pra canal canonico do dashboard (PR-13b).
 *
 * Conversao forward: utm_source -> channel (pra agregar receita por canal).
 * Conversao reverse: channel -> regex de utm_sources (pra filtrar SQL).
 *
 * Sem catch-all que retorne direct — quando utm_source nao bate em nenhum
 * pattern conhecido, retorna 'other' (visivel no UI mas nao confundivel
 * com 'direct' que e ausencia de UTM).
 */

export type CanonicalChannel =
  | 'meta'
  | 'google'
  | 'whatsapp'
  | 'email'
  | 'organic'
  | 'direct'
  | 'other'

interface ChannelRule {
  channel: Exclude<CanonicalChannel, 'direct' | 'other'>
  patterns: RegExp[]
}

const RULES: ChannelRule[] = [
  { channel: 'meta', patterns: [/^fb$/i, /^facebook$/i, /^ig$/i, /^instagram$/i, /^meta$/i] },
  { channel: 'google', patterns: [/^google$/i, /^gads$/i, /^youtube$/i, /^yt$/i, /^gclid$/i] },
  { channel: 'whatsapp', patterns: [/^whatsapp$/i, /^wa$/i, /^wpp$/i] },
  { channel: 'email', patterns: [/^email$/i, /^mailchimp$/i, /^rd-?station$/i, /^newsletter$/i] },
  { channel: 'organic', patterns: [/^organic$/i, /^seo$/i, /^search$/i] },
]

export function utmSourceToChannel(utmSource: string | null): CanonicalChannel {
  if (!utmSource || utmSource.trim() === '' || utmSource === '(none)') return 'direct'
  const trimmed = utmSource.trim()
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(trimmed))) return rule.channel
  }
  return 'other'
}

/**
 * Pra um conjunto de canais selecionados, retorna lista plana de utm_sources
 * que devem entrar no WHERE da query SQL. 'direct' tratado com IS NULL OR ''.
 * Retorna { sources, includeNull } pra caller construir SQL apropriado.
 */
export function channelsToSqlFilter(channels: string[]): {
  sources: string[]
  includeNull: boolean
} {
  if (channels.length === 0) return { sources: [], includeNull: false }
  const sources: string[] = []
  let includeNull = false
  for (const ch of channels) {
    if (ch === 'direct') {
      includeNull = true
      continue
    }
    const rule = RULES.find((r) => r.channel === ch)
    if (!rule) continue
    // Patterns são regex; pra SQL, listamos os valores literais reconhecíveis.
    // Como cada pattern e tipo `^x$/i`, extraio o literal X
    for (const p of rule.patterns) {
      const src = p.source
        .replace(/^\^|\$$/g, '')
        .replace('-?', '-')
        .toLowerCase()
      sources.push(src)
    }
  }
  return { sources, includeNull }
}

export const CHANNEL_LABELS: Record<CanonicalChannel, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  whatsapp: 'WhatsApp',
  email: 'Email',
  organic: 'Orgânico',
  direct: 'Direct',
  other: 'Outros',
}
