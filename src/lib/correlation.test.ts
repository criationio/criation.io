/**
 * Testes do correlation helper (TD-021). AsyncLocalStorage do Node — sem
 * mocks, exercita comportamento real.
 */
import { describe, expect, it } from 'vitest'

import {
  correlationStorage,
  generateCorrelationId,
  getCorrelationId,
  withCorrelation,
  withCorrelationSync,
} from './correlation'

describe('generateCorrelationId', () => {
  it('gera UUID v4 valido', () => {
    const id = generateCorrelationId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('gera IDs unicos', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i += 1) ids.add(generateCorrelationId())
    expect(ids.size).toBe(100)
  })
})

describe('getCorrelationId — fora de scope', () => {
  it('retorna UUID novo a cada chamada quando sem context', () => {
    const a = getCorrelationId()
    const b = getCorrelationId()
    // Sem AsyncLocalStorage ativo, fallback gera novos UUIDs
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f-]+$/i)
  })
})

describe('withCorrelation — propaga ID em call chain async', () => {
  it('logger dentro de fn ve o mesmo ID', async () => {
    const expected = '11111111-2222-3333-4444-555555555555'
    let captured: string | null = null

    await withCorrelation(expected, async () => {
      captured = getCorrelationId()
    })

    expect(captured).toBe(expected)
  })

  it('propaga atraves de awaits aninhados', async () => {
    const expected = 'abc-123'
    let inner: string | null = null

    await withCorrelation(expected, async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 1))
      inner = getCorrelationId()
    })

    expect(inner).toBe(expected)
  })

  it('contexts paralelos sao isolados', async () => {
    const results: Array<string | null> = [null, null, null]

    await Promise.all([
      withCorrelation('id-1', async () => {
        await new Promise((r) => setTimeout(r, 5))
        results[0] = getCorrelationId()
      }),
      withCorrelation('id-2', async () => {
        await new Promise((r) => setTimeout(r, 3))
        results[1] = getCorrelationId()
      }),
      withCorrelation('id-3', async () => {
        results[2] = getCorrelationId()
      }),
    ])

    expect(results).toEqual(['id-1', 'id-2', 'id-3'])
  })

  it('retorna o valor de fn', async () => {
    const result = await withCorrelation('x', async () => {
      return 42
    })
    expect(result).toBe(42)
  })

  it('propaga exception sem leak de context', async () => {
    await expect(
      withCorrelation('error-ctx', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    // Fora do scope: novo ID
    const outside = getCorrelationId()
    expect(outside).not.toBe('error-ctx')
  })

  it('contexts aninhados: inner sobrescreve outer', async () => {
    const captured: Record<string, string | null> = { outer: null, inner: null, afterInner: null }

    await withCorrelation('outer-id', async () => {
      captured.outer = getCorrelationId()
      await withCorrelation('inner-id', async () => {
        captured.inner = getCorrelationId()
      })
      captured.afterInner = getCorrelationId()
    })

    expect(captured.outer).toBe('outer-id')
    expect(captured.inner).toBe('inner-id')
    expect(captured.afterInner).toBe('outer-id') // volta pro outer
  })
})

describe('withCorrelationSync — variante sincrona', () => {
  it('propaga ID em bloco sincrono', () => {
    const captured = withCorrelationSync('sync-id', () => getCorrelationId())
    expect(captured).toBe('sync-id')
  })

  it('retorna o valor do callback', () => {
    const result = withCorrelationSync('x', () => 'hello')
    expect(result).toBe('hello')
  })
})

describe('correlationStorage — export direto pra integracao avancada', () => {
  it('expoe AsyncLocalStorage pra middleware/helpers customizados', () => {
    expect(correlationStorage).toBeDefined()
    expect(typeof correlationStorage.run).toBe('function')
    expect(typeof correlationStorage.getStore).toBe('function')
  })
})
