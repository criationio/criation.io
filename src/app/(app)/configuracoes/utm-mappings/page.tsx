import { redirect } from 'next/navigation'

/**
 * Path antigo renomeado pra `/configuracoes/atribuicao` (refactor 2026-05).
 * Mantemos redirect pra nao quebrar bookmarks/links externos.
 */
export default function UtmMappingsLegacyRedirect(): never {
  redirect('/configuracoes/atribuicao')
}
