/**
 * Utilitarios puros para comparativo de campanhas (PR-6/7 da Sessao 1.7).
 *
 * Usados em ComparativoTable, CampaignKpiGrid e tests.
 */

export type MetricFormat = 'brl' | 'number' | 'percent' | 'roas'

/**
 * Variacao percentual entre dois valores. Quando `previous === 0`, retorna
 * 100 se houve qualquer valor novo, 0 se ambos sao zero. Evita Infinity.
 */
export function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('pt-BR')

/**
 * Formata valor numerico para display segundo formato.
 * Recebe cents para BRL — formato responsavel por dividir por 100.
 * Retorna "—" se valor for 0 ou nao-finito.
 */
export function formatMetricValue(value: number, format: MetricFormat): string {
  if (value === 0 || !Number.isFinite(value)) return '—'
  switch (format) {
    case 'brl':
      return BRL.format(value / 100)
    case 'percent':
      return `${value.toFixed(2)}%`
    case 'roas':
      return `${value.toFixed(2)}×`
    case 'number':
    default:
      return NUM.format(Math.round(value))
  }
}

/**
 * Numero total de paginas a partir do total de itens e tamanho da pagina.
 * Sempre retorna >= 1 (mesmo com 0 itens — pra UI sempre mostrar "1 de 1").
 */
export function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}
