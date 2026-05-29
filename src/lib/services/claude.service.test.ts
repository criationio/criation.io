// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => {
  const create = vi.fn()
  // Função regular (não arrow) — precisa ser construtável via `new Anthropic()`.
  const Anthropic = vi.fn(function (this: unknown) {
    return { messages: { create } }
  })
  return { default: Anthropic, __mocks: { create } }
})

vi.mock('@/lib/claude/budget', () => ({ checkBudget: vi.fn() }))

vi.mock('@/lib/db', () => {
  const insertValues = vi.fn()
  const insert = vi.fn(() => ({ values: insertValues }))
  const promptVersionsFindFirst = vi.fn()
  return {
    db: {
      insert,
      query: { promptVersions: { findFirst: promptVersionsFindFirst } },
    },
    __mocks: { insert, insertValues, promptVersionsFindFirst },
  }
})

import { checkBudget } from '@/lib/claude/budget'
import { analysisQuickPrompt } from '@/lib/claude/prompts'
import { analyze } from './claude.service'

const sdkModule = (await import('@anthropic-ai/sdk')) as unknown as {
  __mocks: { create: ReturnType<typeof vi.fn> }
}
const create = sdkModule.__mocks.create
const checkBudgetMock = checkBudget as unknown as ReturnType<typeof vi.fn>

const dbModule = (await import('@/lib/db')) as unknown as {
  __mocks: {
    insertValues: ReturnType<typeof vi.fn>
    promptVersionsFindFirst: ReturnType<typeof vi.fn>
  }
}
const mocks = dbModule.__mocks

const VALID_OUTPUT = {
  verdict: 'strong',
  score: 80,
  summary: 'Bom criativo.',
  bottleneck: { stage: 'checkout', explanation: 'CPA alto' },
  strengths: ['hook forte'],
  weaknesses: [],
  recommendations: ['testar CTA'],
}

function message(text: string, usage = {}) {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      ...usage,
    },
  }
}

const ctx = { workspaceId: 'ws-1', planId: 'pro' }

beforeEach(() => {
  checkBudgetMock.mockResolvedValue({
    ok: true,
    usageBrlCents: 0,
    budgetBrlCents: 4000,
    usageUsd: 0,
  })
  create.mockResolvedValue(message(JSON.stringify(VALID_OUTPUT)))
  mocks.insertValues.mockResolvedValue(undefined)
  mocks.promptVersionsFindFirst.mockResolvedValue({ id: 'pv-1' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('analyze', () => {
  it('happy path: valida output e retorna ok com usage + loga', async () => {
    const r = await analyze(analysisQuickPrompt, { foo: 'bar' }, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.verdict).toBe('strong')
    expect(r.usage.model).toBe(analysisQuickPrompt.model)
    expect(mocks.insertValues).toHaveBeenCalledTimes(1)
  })

  it('prompt caching: system block tem cache_control ephemeral', async () => {
    await analyze(analysisQuickPrompt, {}, ctx)
    const params = create.mock.calls[0]![0] as {
      model: string
      system: Array<{ cache_control?: { type: string } }>
    }
    expect(params.system[0]!.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('modelo selecionado por pipeline (Quick = Sonnet)', async () => {
    await analyze(analysisQuickPrompt, {}, ctx)
    const params = create.mock.calls[0]![0] as { model: string }
    expect(params.model).toBe('claude-sonnet-4-6')
  })

  it('budget estourado: retorna BUDGET_EXCEEDED sem chamar a API', async () => {
    checkBudgetMock.mockResolvedValue({
      ok: false,
      usageBrlCents: 5000,
      budgetBrlCents: 4000,
      usageUsd: 9,
    })
    const r = await analyze(analysisQuickPrompt, {}, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('BUDGET_EXCEEDED')
    expect(create).not.toHaveBeenCalled()
  })

  it('output inválido: retorna VALIDATION e loga validation_failed', async () => {
    create.mockResolvedValue(message(JSON.stringify({ ...VALID_OUTPUT, verdict: 'amazing' })))
    const r = await analyze(analysisQuickPrompt, {}, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('VALIDATION')
    const logged = mocks.insertValues.mock.calls[0]![0] as { errorMessage: string | null }
    expect(logged.errorMessage).toBe('validation_failed')
  })

  it('JSON com cercas markdown ainda parseia', async () => {
    create.mockResolvedValue(message('```json\n' + JSON.stringify(VALID_OUTPUT) + '\n```'))
    const r = await analyze(analysisQuickPrompt, {}, ctx)
    expect(r.ok).toBe(true)
  })

  it('retry: 2x 429 seguidos de 200 = 3 chamadas, 1 sucesso', async () => {
    create
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce(message(JSON.stringify(VALID_OUTPUT)))
    const r = await analyze(analysisQuickPrompt, {}, ctx)
    expect(create).toHaveBeenCalledTimes(3)
    expect(r.ok).toBe(true)
  })

  it('não retenta em 4xx de validação (400)', async () => {
    create.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }))
    const r = await analyze(analysisQuickPrompt, {}, ctx)
    expect(create).toHaveBeenCalledTimes(1)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('API_ERROR')
  })
})
