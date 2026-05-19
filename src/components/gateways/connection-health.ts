/**
 * Helpers puros (server-safe) para derivar estado de health de uma
 * gateway connection. Sem React — pode ser chamado em Server Components.
 *
 * O componente visual `ConnectionStatusBadge` (client) consome este tipo.
 */

export type ConnectionHealth = 'pending' | 'active' | 'failing' | 'stale'

/**
 * Deriva estado a partir de `lastWebhookEventAt` + `webhookFailures24h`:
 *
 * - `pending`: nunca recebeu webhook (lastWebhookEventAt IS NULL)
 * - `failing`: > 3 falhas em 24h E ultimo webhook ha mais de 1h
 * - `stale`: ultimo webhook ha mais de 7 dias
 * - `active`: ultimo webhook recente, sem falhas significativas
 */
export function deriveConnectionHealth(connection: {
  lastWebhookEventAt: Date | null
  webhookFailures24h: number
}): ConnectionHealth {
  const last = connection.lastWebhookEventAt
  if (!last) return 'pending'

  const ageMs = Date.now() - new Date(last).getTime()
  const oneHour = 60 * 60 * 1000
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  if (connection.webhookFailures24h > 3 && ageMs > oneHour) return 'failing'
  if (ageMs > sevenDays) return 'stale'
  return 'active'
}

/** Mensagem explicativa pra mostrar abaixo do badge — varia por health. */
export function getHealthDescription(
  health: ConnectionHealth,
  lastWebhookEventAt: Date | null
): string {
  switch (health) {
    case 'pending':
      return 'Configuração salva. Termine o cadastro do webhook no painel do gateway pra ativarmos. Esta página atualiza sozinha quando o primeiro webhook chegar.'
    case 'active': {
      if (!lastWebhookEventAt) return 'Conexão ativa.'
      const ageMs = Date.now() - new Date(lastWebhookEventAt).getTime()
      const minutes = Math.floor(ageMs / 60_000)
      if (minutes < 1) return 'Último webhook há menos de 1 minuto.'
      if (minutes < 60) return `Último webhook há ${minutes} minuto${minutes === 1 ? '' : 's'}.`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `Último webhook há ${hours} hora${hours === 1 ? '' : 's'}.`
      const days = Math.floor(hours / 24)
      return `Último webhook há ${days} dia${days === 1 ? '' : 's'}.`
    }
    case 'failing':
      return 'Webhooks recentes estão falhando. Verifique se o token/key configurado no gateway bate com o que está aqui.'
    case 'stale':
      return 'Sem webhooks há mais de 7 dias. Pode ser que o gateway tenha desativado a integração ou não há vendas no período.'
  }
}
