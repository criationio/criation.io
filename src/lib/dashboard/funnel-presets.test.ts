import { describe, expect, it } from 'vitest'

import { ALL_FUNNEL_STAGES, FUNNEL_PRESETS, getPreset } from './funnel-presets'

describe('FUNNEL_PRESETS', () => {
  it('tem 6 presets (5 modelos + custom)', () => {
    expect(FUNNEL_PRESETS).toHaveLength(6)
    expect(FUNNEL_PRESETS.map((p) => p.id)).toEqual([
      'vsl-direto',
      'webinar',
      'lead-magnet',
      'whatsapp',
      'trial-saas',
      'custom',
    ])
  })

  it('cada preset tem stages validos', () => {
    for (const preset of FUNNEL_PRESETS) {
      for (const stage of preset.stages) {
        expect(ALL_FUNNEL_STAGES).toContain(stage)
      }
    }
  })

  it('VSL direto NAO tem leads (modelo direto-pra-checkout)', () => {
    const vsl = FUNNEL_PRESETS.find((p) => p.id === 'vsl-direto')
    expect(vsl).toBeDefined()
    expect(vsl!.stages).not.toContain('leads')
  })

  it('Webinar TEM leads (opt-in pro webinar)', () => {
    const webinar = FUNNEL_PRESETS.find((p) => p.id === 'webinar')
    expect(webinar).toBeDefined()
    expect(webinar!.stages).toContain('leads')
  })

  it('Trial SaaS tem assinaturas ativas (recorrencia)', () => {
    const trial = FUNNEL_PRESETS.find((p) => p.id === 'trial-saas')
    expect(trial).toBeDefined()
    expect(trial!.stages).toContain('activeSubscriptions')
  })

  it('Custom tem todas as 8 stages', () => {
    const custom = FUNNEL_PRESETS.find((p) => p.id === 'custom')
    expect(custom).toBeDefined()
    expect(custom!.stages).toHaveLength(ALL_FUNNEL_STAGES.length)
  })
})

describe('getPreset', () => {
  it('retorna preset por id', () => {
    expect(getPreset('vsl-direto').name).toBe('VSL direto pra checkout')
    expect(getPreset('webinar').name).toBe('Webinar / Live launch')
  })

  it('id invalido → fallback pra primeiro preset', () => {
    const fallback = getPreset('xxx' as never)
    expect(fallback).toBe(FUNNEL_PRESETS[0])
  })
})
