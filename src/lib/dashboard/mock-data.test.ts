import { describe, expect, it } from 'vitest'

import {
  filterChannelMix,
  generateCohortMatrix,
  generateDailySeries,
  generateWithPrevious,
  kpiWithDelta,
  periodPresetToDays,
  summarizeChannelMix,
  summarizeFunnel,
  summarizeKpis,
  topCreatives,
  topUtmSources,
  type ChannelMixSlice,
} from './mock-data'

const REF = new Date('2026-06-15T12:00:00Z')

describe('generateDailySeries', () => {
  it('gera N dias com data ascendente', () => {
    const series = generateDailySeries(REF, 7)
    expect(series).toHaveLength(7)
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.date > series[i - 1]!.date).toBe(true)
    }
  })

  it('seedeado por data: mesmo input gera mesmo output', () => {
    const a = generateDailySeries(REF, 7)
    const b = generateDailySeries(REF, 7)
    expect(a).toEqual(b)
  })

  it('valores plausiveis pra infoprodutor BR', () => {
    const series = generateDailySeries(REF, 30)
    const totalRevenue = series.reduce((s, d) => s + d.revenue, 0)
    // Esperamos ~R$135k/mes baseline com tendencia +10%
    expect(totalRevenue).toBeGreaterThan(50_000)
    expect(totalRevenue).toBeLessThan(300_000)
  })
})

describe('summarizeKpis', () => {
  it('agrega receita, spend, profit', () => {
    const series = generateDailySeries(REF, 30)
    const k = summarizeKpis(series)
    const expectedRevenue = series.reduce((s, d) => s + d.revenue, 0)
    expect(k.revenue).toBe(expectedRevenue)
    expect(k.spend).toBe(series.reduce((s, d) => s + d.spend, 0))
    expect(k.profit).toBe(series.reduce((s, d) => s + d.profit, 0))
  })

  it('ROAS = revenue / spend', () => {
    const series = generateDailySeries(REF, 30)
    const k = summarizeKpis(series)
    expect(k.roas).toBeCloseTo(k.revenue / k.spend, 5)
  })

  it('CAC = spend / customers', () => {
    const series = generateDailySeries(REF, 30)
    const k = summarizeKpis(series)
    const customers = series.reduce((s, d) => s + d.customers, 0)
    expect(k.cac).toBeCloseTo(k.spend / customers, 5)
  })

  it('ticketMedio = revenue / orders', () => {
    const series = generateDailySeries(REF, 30)
    const k = summarizeKpis(series)
    const orders = series.reduce((s, d) => s + d.orders, 0)
    expect(k.ticketMedio).toBeCloseTo(k.revenue / orders, 5)
  })

  it('series vazia: retorna zeros sem divisao por zero', () => {
    const k = summarizeKpis([])
    expect(k.revenue).toBe(0)
    expect(k.roas).toBe(0)
    expect(k.cac).toBe(0)
    expect(k.ticketMedio).toBe(0)
  })
})

describe('summarizeFunnel', () => {
  it('soma cada etapa', () => {
    const series = generateDailySeries(REF, 7)
    const f = summarizeFunnel(series)
    expect(f.impressions).toBe(series.reduce((s, d) => s + d.impressions, 0))
    expect(f.clicks).toBe(series.reduce((s, d) => s + d.clicks, 0))
    expect(f.leads).toBe(series.reduce((s, d) => s + d.leads, 0))
  })

  it('impressions > clicks > leads > purchases (pirâmide natural)', () => {
    const series = generateDailySeries(REF, 30)
    const f = summarizeFunnel(series)
    expect(f.impressions).toBeGreaterThan(f.clicks)
    expect(f.clicks).toBeGreaterThan(f.leads)
    expect(f.leads).toBeGreaterThan(f.purchasesApproved)
  })
})

describe('kpiWithDelta', () => {
  it('delta positivo quando current > previous', () => {
    const current = [{ date: '2026-06-15', revenue: 200 } as never]
    const previous = [{ date: '2026-06-14', revenue: 100 } as never]
    const k = kpiWithDelta({
      series: current,
      previousSeries: previous,
      pick: (d) => d.revenue,
    })
    expect(k.current).toBe(200)
    expect(k.previous).toBe(100)
    expect(k.deltaPercent).toBe(100) // +100%
  })

  it('delta negativo quando current < previous', () => {
    const current = [{ date: '2026-06-15', revenue: 50 } as never]
    const previous = [{ date: '2026-06-14', revenue: 100 } as never]
    const k = kpiWithDelta({
      series: current,
      previousSeries: previous,
      pick: (d) => d.revenue,
    })
    expect(k.deltaPercent).toBe(-50)
  })

  it('previous = 0 → delta = 0 (sem divisao por zero)', () => {
    const k = kpiWithDelta({
      series: [{ date: '2026-06-15', revenue: 100 } as never],
      previousSeries: [],
      pick: (d) => d.revenue,
    })
    expect(k.deltaPercent).toBe(0)
  })

  it('spark mantem ultimos 14 pontos', () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      date: `d${i}`,
      revenue: i,
    })) as never[]
    const k = kpiWithDelta({
      series,
      previousSeries: [],
      pick: (d) => d.revenue,
    })
    expect(k.spark).toHaveLength(14)
    expect(k.spark[0]).toBe(16) // 30 - 14 = 16
    expect(k.spark[13]).toBe(29)
  })
})

describe('periodPresetToDays', () => {
  it('mapeia presets conhecidos', () => {
    expect(periodPresetToDays('today')).toBe(1)
    expect(periodPresetToDays('last_7d')).toBe(7)
    expect(periodPresetToDays('last_30d')).toBe(30)
    expect(periodPresetToDays('last_90d')).toBe(90)
    expect(periodPresetToDays('last_month')).toBe(30)
    expect(periodPresetToDays('last_quarter')).toBe(90)
  })

  it('preset desconhecido → 30 default', () => {
    expect(periodPresetToDays(undefined)).toBe(30)
    expect(periodPresetToDays('xxx')).toBe(30)
  })
})

describe('filterChannelMix', () => {
  const mix: ChannelMixSlice[] = [
    { channel: 'meta', revenue: 6000, spend: 2000, share: 0.6 },
    { channel: 'google', revenue: 3000, spend: 1000, share: 0.3 },
    { channel: 'organic', revenue: 1000, spend: 0, share: 0.1 },
  ]

  it('vazio → retorna tudo', () => {
    expect(filterChannelMix(mix, [])).toEqual(mix)
  })

  it('filtra + recomputa share', () => {
    const filtered = filterChannelMix(mix, ['meta', 'google'])
    expect(filtered).toHaveLength(2)
    // shares recomputadas baseadas no novo total (6000 + 3000 = 9000)
    expect(filtered[0]!.share).toBeCloseTo(6000 / 9000, 5)
    expect(filtered[1]!.share).toBeCloseTo(3000 / 9000, 5)
  })

  it('filtro sem match → array vazio sem erro', () => {
    expect(filterChannelMix(mix, ['whatsapp'])).toEqual([])
  })
})

describe('summarizeChannelMix', () => {
  it('soma shares = 1.0', () => {
    const series = generateDailySeries(REF, 30)
    const mix = summarizeChannelMix(series)
    const totalShare = mix.reduce((s, c) => s + c.share, 0)
    expect(totalShare).toBeCloseTo(1.0, 5)
  })

  it('meta deve ser canal dominante (62% baseline)', () => {
    const series = generateDailySeries(REF, 30)
    const mix = summarizeChannelMix(series)
    const meta = mix.find((c) => c.channel === 'meta')
    expect(meta).toBeDefined()
    expect(meta!.share).toBeGreaterThan(0.5)
  })
})

describe('topCreatives', () => {
  it('retorna 10 criativos ordenados por receita desc', () => {
    const series = generateDailySeries(REF, 30)
    const creatives = topCreatives(series)
    expect(creatives).toHaveLength(10)
    for (let i = 1; i < creatives.length; i++) {
      expect(creatives[i - 1]!.revenue >= creatives[i]!.revenue).toBe(true)
    }
  })

  it('inclui lifecycle status valido', () => {
    const series = generateDailySeries(REF, 30)
    const creatives = topCreatives(series)
    const validStatuses = ['scaling', 'mature', 'fatigued', 'testing']
    for (const c of creatives) {
      expect(validStatuses).toContain(c.status)
    }
  })
})

describe('topUtmSources', () => {
  it('retorna 10 UTM sources com revenue/orders/spend/roas', () => {
    const series = generateDailySeries(REF, 30)
    const utm = topUtmSources(series)
    expect(utm).toHaveLength(10)
    for (const u of utm) {
      expect(typeof u.revenue).toBe('number')
      expect(typeof u.orders).toBe('number')
    }
  })

  it('ordena por revenue desc', () => {
    const series = generateDailySeries(REF, 30)
    const utm = topUtmSources(series)
    for (let i = 1; i < utm.length; i++) {
      expect(utm[i - 1]!.revenue >= utm[i]!.revenue).toBe(true)
    }
  })
})

describe('generateCohortMatrix', () => {
  it('gera N cohorts default 6', () => {
    const matrix = generateCohortMatrix(REF)
    expect(matrix).toHaveLength(6)
  })

  it('cohorts mais novos tem mais cells null (futuro)', () => {
    const matrix = generateCohortMatrix(REF, 6)
    // matrix[5] = cohort mais recente (atual mes)
    const latest = matrix[5]!
    const nullCells = latest.cells.filter((c) => c === null).length
    expect(nullCells).toBeGreaterThan(0)
  })

  it('cohorts antigos tem todas cells preenchidas', () => {
    const matrix = generateCohortMatrix(REF, 8)
    // O cohort mais antigo (index 0) deve ter quase tudo preenchido
    const oldest = matrix[0]!
    const filledCells = oldest.cells.filter((c) => c !== null).length
    expect(filledCells).toBe(oldest.cells.length)
  })

  it('LTV decresce ao longo dos meses (decay)', () => {
    const matrix = generateCohortMatrix(REF, 8)
    const oldest = matrix[0]!
    // Month 0 (compra) sempre maior que Month 1 (retencao)
    expect(oldest.cells[0]!).toBeGreaterThan(oldest.cells[1]!)
  })
})

describe('generateWithPrevious', () => {
  it('current e previous tem mesmo numero de dias', () => {
    const { current, previous } = generateWithPrevious(REF, 30)
    expect(current).toHaveLength(30)
    expect(previous).toHaveLength(30)
  })

  it('previous fica antes do current', () => {
    const { current, previous } = generateWithPrevious(REF, 30)
    expect(previous[previous.length - 1]!.date < current[0]!.date).toBe(true)
  })
})
