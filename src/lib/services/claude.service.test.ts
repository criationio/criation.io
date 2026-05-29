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

vi.mock('@/lib/services/credit.service', () => ({ checkBalance: vi.fn(), consume: vi.fn() }))

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
import { checkBalance, consume } from '@/lib/services/credit.service'
import { analyze, generateCopy } from './claude.service'

const sdkModule = (await import('@anthropic-ai/sdk')) as unknown as {
  __mocks: { create: ReturnType<typeof vi.fn> }
}
const create = sdkModule.__mocks.create
const checkBudgetMock = checkBudget as unknown as ReturnType<typeof vi.fn>
const checkBalanceMock = checkBalance as unknown as ReturnType<typeof vi.fn>
const consumeMock = consume as unknown as ReturnType<typeof vi.fn>

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
  checkBalanceMock.mockResolvedValue({ ok: true, available: 100, required: 1, breakdown: {} })
  consumeMock.mockResolvedValue({
    ok: true,
    transactionId: 't1',
    idempotent: false,
    newBalance: 99,
  })
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

describe('analyze — LLM judge', () => {
  it('judge aprova: 2 chamadas (análise + judge), sem retry', async () => {
    create
      .mockResolvedValueOnce(message(JSON.stringify(VALID_OUTPUT))) // análise
      .mockResolvedValueOnce(message(JSON.stringify({ approved: true, issues: [] }))) // judge
    const r = await analyze(analysisQuickPrompt, {}, ctx, { judge: true })
    expect(create).toHaveBeenCalledTimes(2)
    expect(r.ok).toBe(true)
  })

  it('judge reprova: refaz a análise 1x (3 chamadas)', async () => {
    create
      .mockResolvedValueOnce(message(JSON.stringify(VALID_OUTPUT))) // análise 1
      .mockResolvedValueOnce(message(JSON.stringify({ approved: false, issues: ['vago'] }))) // judge
      .mockResolvedValueOnce(message(JSON.stringify(VALID_OUTPUT))) // retry
    const r = await analyze(analysisQuickPrompt, {}, ctx, { judge: true })
    expect(create).toHaveBeenCalledTimes(3)
    expect(r.ok).toBe(true)
  })
})

describe('analyze — integração creditService', () => {
  const creditCtx = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    analysisId: 'a-1',
    credits: { cost: 1, idempotencyKey: 'consume:a-1' },
  }

  it('pré-flight + consume on success', async () => {
    const r = await analyze(analysisQuickPrompt, {}, creditCtx)
    expect(r.ok).toBe(true)
    expect(checkBalanceMock).toHaveBeenCalledWith('ws-1', 1, { safetyFactor: 1.5 })
    expect(consumeMock).toHaveBeenCalledTimes(1)
    expect(consumeMock).toHaveBeenCalledWith('ws-1', 'user-1', 1, {
      pipelineId: 'analisar.video_ad',
      analysisId: 'a-1',
      idempotencyKey: 'consume:a-1',
    })
  })

  it('saldo insuficiente: INSUFFICIENT_CREDITS sem chamar API nem consume', async () => {
    checkBalanceMock.mockResolvedValue({ ok: false, available: 0, required: 1, breakdown: {} })
    const r = await analyze(analysisQuickPrompt, {}, creditCtx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('INSUFFICIENT_CREDITS')
    expect(create).not.toHaveBeenCalled()
    expect(consumeMock).not.toHaveBeenCalled()
  })

  it('análise falha (validation): NÃO consome créditos', async () => {
    create.mockResolvedValue(message(JSON.stringify({ ...VALID_OUTPUT, verdict: 'bad' })))
    const r = await analyze(analysisQuickPrompt, {}, creditCtx)
    expect(r.ok).toBe(false)
    expect(consumeMock).not.toHaveBeenCalled()
  })

  it('sem ctx.credits: não toca creditService', async () => {
    await analyze(analysisQuickPrompt, {}, ctx)
    expect(checkBalanceMock).not.toHaveBeenCalled()
    expect(consumeMock).not.toHaveBeenCalled()
  })
})

describe('generateCopy', () => {
  it('usa o copy-generator (Sonnet) e valida variações', async () => {
    create.mockResolvedValue(
      message(JSON.stringify({ variations: [{ angle: 'dor', headline: 'h', body: 'b' }] }))
    )
    const r = await generateCopy({ niche: 'x' }, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.variations).toHaveLength(1)
    const params = create.mock.calls[0]![0] as { model: string }
    expect(params.model).toBe('claude-sonnet-4-6')
  })
})
