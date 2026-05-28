/**
 * Mapeia preset de período pra { start, end } Date (PR-13b).
 *
 * Usado pelas queries reais do dashboard pra construir filtro de data.
 * Period anterior (comparação) tem mesma duracao em janela imediatamente
 * antes do current.
 */

export interface PeriodRange {
  start: Date
  end: Date
}

export function presetToRange(preset: string | undefined, refDate: Date = new Date()): PeriodRange {
  const end = new Date(refDate)
  const start = new Date(refDate)

  switch (preset) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      break
    case 'yesterday':
      start.setUTCDate(start.getUTCDate() - 1)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCDate(end.getUTCDate() - 1)
      end.setUTCHours(23, 59, 59, 999)
      break
    case 'last_7d':
      start.setUTCDate(start.getUTCDate() - 7)
      break
    case 'last_30d':
      start.setUTCDate(start.getUTCDate() - 30)
      break
    case 'last_90d':
      start.setUTCDate(start.getUTCDate() - 90)
      break
    case 'mtd':
      start.setUTCDate(1)
      start.setUTCHours(0, 0, 0, 0)
      break
    case 'qtd': {
      const q = Math.floor(start.getUTCMonth() / 3) * 3
      start.setUTCMonth(q, 1)
      start.setUTCHours(0, 0, 0, 0)
      break
    }
    case 'ytd':
      start.setUTCMonth(0, 1)
      start.setUTCHours(0, 0, 0, 0)
      break
    case 'last_month': {
      start.setUTCMonth(start.getUTCMonth() - 1, 1)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCDate(1)
      end.setUTCHours(0, 0, 0, 0)
      // end-1ms = ultimo dia do mes passado às 23:59:59.999
      end.setTime(end.getTime() - 1)
      break
    }
    case 'last_quarter': {
      const currentQ = Math.floor(start.getUTCMonth() / 3)
      const prevQStart = currentQ === 0 ? -3 : (currentQ - 1) * 3
      start.setUTCMonth(prevQStart, 1)
      start.setUTCHours(0, 0, 0, 0)
      end.setUTCMonth(currentQ * 3, 1)
      end.setUTCHours(0, 0, 0, 0)
      end.setTime(end.getTime() - 1)
      break
    }
    default:
      // last_30d default
      start.setUTCDate(start.getUTCDate() - 30)
  }

  return { start, end }
}

/**
 * Janela imediatamente anterior ao range atual, mesma duração. Pra "vs período
 * anterior" comparison.
 */
export function previousRange(current: PeriodRange): PeriodRange {
  const durationMs = current.end.getTime() - current.start.getTime()
  return {
    start: new Date(current.start.getTime() - durationMs),
    end: new Date(current.start.getTime() - 1),
  }
}
