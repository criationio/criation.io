import Anthropic from '@anthropic-ai/sdk'
import { and, eq } from 'drizzle-orm'

import { env } from '@/env'
import { checkBudget } from '@/lib/claude/budget'
import { structuralJudgePrompt, type JudgeVerdict } from '@/lib/claude/judges/structural-judge'
import { estimateCostUsd } from '@/lib/claude/models'
import { copyGeneratorPrompt } from '@/lib/claude/prompts'
import type { PromptDef } from '@/lib/claude/prompts/types'
import type { CopyGeneratorOutput } from '@/lib/claude/validators/copy-generator'
import { db } from '@/lib/db'
import { claudeRequestLogs, promptVersions } from '@/lib/db/schema/admin'
import { checkBalance, consume } from '@/lib/services/credit.service'
import { analysisLogger } from '@/lib/logger'

/**
 * claude.service — wrapper único do Claude API (Sessão 1.8).
 *
 * Responsabilidades:
 *  - selecionar modelo + prompt versionado por pipeline;
 *  - prompt caching no system block;
 *  - HARD CAP de budget (Regra 20) antes de cada request;
 *  - retry em 429/5xx (backoff), sem retry em 4xx de validação;
 *  - validar output com Zod (validateOutput);
 *  - persistir TODA request em claude_request_logs (observabilidade).
 *
 * Erro esperado = shape discriminado { ok:false, error } (Regra 7), não throw.
 */

export interface AnalyzeContext {
  workspaceId: string
  userId?: string | null
  planId?: string | null
  analysisId?: string | null
  /**
   * Cobrança em créditos do usuário (creditService). Quando presente:
   * checkBalance pré-flight (1.5x) antes + consume on-success depois (§4.11).
   * Requer analysisId. Chamadas internas (judge) NÃO passam isto.
   */
  credits?: { cost: number; idempotencyKey: string }
}

export interface AnalyzeOptions {
  /** Roda o LLM-judge após o output; refaz a análise 1x se reprovar. */
  judge?: boolean
}

export interface AnalyzeUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  costUsd: number
  latencyMs: number
}

export type AnalyzeErrorCode =
  | 'BUDGET_EXCEEDED'
  | 'INSUFFICIENT_CREDITS'
  | 'VALIDATION'
  | 'API_ERROR'

export type AnalyzeResult<T> =
  | { ok: true; data: T; usage: AnalyzeUsage }
  | { ok: false; error: { code: AnalyzeErrorCode; message: string } }

// --- Cliente lazy --------------------------------------------------------

let cachedClient: Anthropic | null = null

function getClient(): Anthropic {
  if (cachedClient) return cachedClient
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada — claude.service indisponível')
  }
  cachedClient = new Anthropic({ apiKey })
  return cachedClient
}

// --- Retry (429/5xx) -----------------------------------------------------

const RETRY_BACKOFF_MS = [10_000, 30_000, 120_000]
const MAX_ATTEMPTS = 3

function isRetryableStatus(status: unknown): boolean {
  return status === 429 || status === 529 || (typeof status === 'number' && status >= 500)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await client.messages.create(params)
    } catch (err) {
      lastError = err
      const status = (err as { status?: unknown }).status
      // 4xx de validação (400/401/403/404/413) → não retenta.
      if (!isRetryableStatus(status) || attempt === MAX_ATTEMPTS - 1) throw err
      const ms = process.env.NODE_ENV === 'test' ? 0 : (RETRY_BACKOFF_MS[attempt] ?? 120_000)
      analysisLogger.warn({ status, attempt: attempt + 1 }, 'claude retry após erro retryável')
      await sleep(ms)
    }
  }
  throw lastError
}

// --- Helpers de output ---------------------------------------------------

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/** Remove cercas markdown ```json ... ``` e parseia. null se inválido. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  const candidate = fenced?.[1] ?? trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

export type ValidateResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: 'VALIDATION'; message: string } }

/** Valida `raw` contra um schema Zod. Exposto per spec §1.8. */
export function validateOutput<T>(schema: PromptDef<T>['schema'], raw: unknown): ValidateResult<T> {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    error: { code: 'VALIDATION', message: parsed.error.issues.map((i) => i.message).join('; ') },
  }
}

// --- Observabilidade -----------------------------------------------------

const promptVersionIdCache = new Map<string, string | null>()

async function resolvePromptVersionId(pipelineId: string, version: string): Promise<string | null> {
  const key = `${pipelineId}@${version}`
  const cached = promptVersionIdCache.get(key)
  if (cached !== undefined) return cached
  const row = await db.query.promptVersions.findFirst({
    where: and(eq(promptVersions.pipelineId, pipelineId), eq(promptVersions.version, version)),
    columns: { id: true },
  })
  const id = row?.id ?? null
  promptVersionIdCache.set(key, id)
  return id
}

async function persistLog(
  prompt: PromptDef<unknown>,
  ctx: AnalyzeContext,
  usage: AnalyzeUsage | null,
  errorMessage: string | null
): Promise<void> {
  try {
    const promptVersionId = await resolvePromptVersionId(prompt.pipelineId, prompt.version)
    await db.insert(claudeRequestLogs).values({
      workspaceId: ctx.workspaceId,
      analysisId: ctx.analysisId ?? null,
      pipelineId: prompt.pipelineId,
      model: prompt.model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      latencyMs: usage?.latencyMs ?? null,
      costUsd: usage ? usage.costUsd.toFixed(6) : '0',
      promptVersionId,
      errorMessage,
    })
  } catch (err) {
    // Falha ao logar não deve derrubar a análise — só registra.
    analysisLogger.error({ err: String(err) }, 'falha ao persistir claude_request_logs')
  }
}

function buildUsage(model: string, message: Anthropic.Message, latencyMs: number): AnalyzeUsage {
  const u = message.usage
  const inputTokens = u?.input_tokens ?? 0
  const outputTokens = u?.output_tokens ?? 0
  const cacheRead = u?.cache_read_input_tokens ?? 0
  const cacheCreation = u?.cache_creation_input_tokens ?? 0
  const totalInput = inputTokens + cacheRead + cacheCreation
  const costUsd = estimateCostUsd(model, totalInput, outputTokens, cacheRead)
  return { model, inputTokens, outputTokens, cachedTokens: cacheRead, costUsd, latencyMs }
}

function buildParams(
  prompt: PromptDef<unknown>,
  input: unknown
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: prompt.model,
    max_tokens: prompt.maxTokens,
    // Prompt caching: system estável é cacheável (cache_control no bloco).
    system: [{ type: 'text', text: prompt.systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt.buildUserPrompt(input) }],
  }
}

// --- analyze -------------------------------------------------------------

/**
 * Uma tentativa: budget gate → request (com retry) → validar → logar.
 * NÃO mexe em créditos nem judge (orquestrados por analyze).
 */
async function runOnce<T>(
  prompt: PromptDef<T>,
  input: unknown,
  ctx: AnalyzeContext
): Promise<AnalyzeResult<T>> {
  // HARD CAP de budget (Regra 20) — antes de qualquer request (inclui judge).
  const budget = await checkBudget(ctx.workspaceId, { planId: ctx.planId ?? null })
  if (!budget.ok) {
    return {
      ok: false,
      error: {
        code: 'BUDGET_EXCEEDED',
        message:
          'Você atingiu o limite de análises do plano este mês. Faça upgrade ou aguarde o reset.',
      },
    }
  }

  const client = getClient()
  const startedAt = Date.now()
  let message: Anthropic.Message
  try {
    message = await callWithRetry(client, buildParams(prompt as PromptDef<unknown>, input))
  } catch (err) {
    analysisLogger.error(
      { workspaceId: ctx.workspaceId, pipelineId: prompt.pipelineId, err: String(err) },
      'claude api error'
    )
    await persistLog(prompt as PromptDef<unknown>, ctx, null, String(err))
    return { ok: false, error: { code: 'API_ERROR', message: 'Falha ao chamar o modelo.' } }
  }

  const usage = buildUsage(prompt.model, message, Date.now() - startedAt)
  const validation = validateOutput(prompt.schema, parseJsonLoose(extractText(message)))

  await persistLog(
    prompt as PromptDef<unknown>,
    ctx,
    usage,
    validation.ok ? null : 'validation_failed'
  )

  if (!validation.ok) {
    return { ok: false, error: { code: 'VALIDATION', message: validation.error.message } }
  }
  return { ok: true, data: validation.data, usage }
}

/** Roda o judge sobre um output. Retorna null se o judge falhar (= não bloqueia). */
async function runJudge(output: unknown, ctx: AnalyzeContext): Promise<JudgeVerdict | null> {
  // Judge é chamada interna: sem créditos (não cobra o usuário), mas conta no budget.
  const judgeCtx: AnalyzeContext = {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId ?? null,
    planId: ctx.planId ?? null,
    analysisId: ctx.analysisId ?? null,
  }
  const r = await runOnce(structuralJudgePrompt, { output }, judgeCtx)
  return r.ok ? r.data : null
}

/**
 * Roda um prompt versionado contra o Claude e valida o output. `prompt` carrega
 * pipelineId/version (= "prompt_name" da spec).
 *
 * Orquestra, em ordem (§4.11 + §1.8):
 *  1. checkBalance pré-flight (1.5x) se ctx.credits — bloqueia saldo limítrofe;
 *  2. runOnce (budget gate + request + validação + log);
 *  3. opcional LLM-judge → refaz 1x se reprovar;
 *  4. consume on-success se ctx.credits (dedução real no fim, §4.11).
 */
export async function analyze<T>(
  prompt: PromptDef<T>,
  input: unknown,
  ctx: AnalyzeContext,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult<T>> {
  // 1. Pré-flight de créditos (1.5x do custo previsto, §4.11).
  if (ctx.credits) {
    const preflight = await checkBalance(ctx.workspaceId, ctx.credits.cost, { safetyFactor: 1.5 })
    if (!preflight.ok) {
      return {
        ok: false,
        error: {
          code: 'INSUFFICIENT_CREDITS',
          message: `Créditos insuficientes: ${preflight.available} disponível, ${ctx.credits.cost} necessário.`,
        },
      }
    }
  }

  // 2. Primeira tentativa.
  let result = await runOnce(prompt, input, ctx)

  // 3. LLM-judge + retry 1x.
  if (result.ok && options.judge) {
    const verdict = await runJudge(result.data, ctx)
    if (verdict && !verdict.approved) {
      analysisLogger.info(
        { pipelineId: prompt.pipelineId, issues: verdict.issues },
        'judge reprovou output — refazendo análise 1x'
      )
      result = await runOnce(prompt, input, ctx)
    }
  }

  // 4. Consome créditos no sucesso (no fim do pipeline, §4.11).
  if (result.ok && ctx.credits) {
    if (!ctx.analysisId) {
      analysisLogger.error(
        { workspaceId: ctx.workspaceId, pipelineId: prompt.pipelineId },
        'credits sem analysisId — consume pulado'
      )
    } else {
      const consumed = await consume(ctx.workspaceId, ctx.userId ?? null, ctx.credits.cost, {
        pipelineId: prompt.pipelineId,
        analysisId: ctx.analysisId,
        idempotencyKey: ctx.credits.idempotencyKey,
      })
      if (!consumed.ok) {
        analysisLogger.error(
          { workspaceId: ctx.workspaceId, pipelineId: prompt.pipelineId, error: consumed.error },
          'consume falhou após análise bem-sucedida'
        )
      }
    }
  }

  return result
}

/** Gera variações de copy (copy-generator). Atalho tipado sobre analyze. */
export function generateCopy(
  input: unknown,
  ctx: AnalyzeContext,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult<CopyGeneratorOutput>> {
  return analyze(copyGeneratorPrompt, input, ctx, options)
}
