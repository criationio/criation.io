export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(value)
}

export function formatDelta(
  value: number,
  decimals = 1
): {
  text: string
  trend: 'up' | 'down' | 'flat'
} {
  if (value === 0) return { text: '0%', trend: 'flat' }
  const sign = value > 0 ? '+' : ''
  return {
    text: `${sign}${value.toFixed(decimals)}%`,
    trend: value > 0 ? 'up' : 'down',
  }
}
