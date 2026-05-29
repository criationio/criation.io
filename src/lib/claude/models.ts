/**
 * Constantes de modelo Claude por pipeline + tabela de pricing pra calcular
 * custo real (cost_usd em claude_request_logs).
 *
 * NAO usar um unico ANTHROPIC_MODEL env — cada pipeline escolhe o modelo certo
 * pro seu tradeoff custo/qualidade (spec Sessao 1.8).
 *
 * IDs sao os aliases atuais (a Anthropic resolve pra versao vigente). Quick usa
 * Sonnet (rapido/barato), Deep usa Opus (mais capaz), Trivial usa Haiku
 * (judge, classificacao, tarefas baratas).
 */

export const MODEL_ANALYSIS_QUICK = 'claude-sonnet-4-6'
export const MODEL_ANALYSIS_DEEP = 'claude-opus-4-8'
export const MODEL_VSL_DEEP = 'claude-opus-4-8'
export const MODEL_TRIVIAL = 'claude-haiku-4-5'

export type ClaudeModel =
  | typeof MODEL_ANALYSIS_QUICK
  | typeof MODEL_ANALYSIS_DEEP
  | typeof MODEL_TRIVIAL

/**
 * Pricing USD por 1M tokens (input/output). Fonte: tabela Anthropic, cache
 * 2026-05-26 (via skill claude-api). Recalibracao trimestral (v0.6 §4.3) — se
 * a Anthropic mudar preco, atualizar aqui. cached input ~= 0.1x do input.
 */
interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-8': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  'claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'claude-haiku-4-5': { inputPerMTok: 1.0, outputPerMTok: 5.0 },
}

/** Fração do preço de input cobrada por tokens lidos do cache (~10%). */
const CACHE_READ_MULTIPLIER = 0.1

/**
 * Estima o custo USD de uma request. `cachedTokens` (cache_read_input_tokens)
 * sao cobrados a ~0.1x do input; o restante de input a preco cheio.
 * Retorna numero com 6 casas (precisao de cost_usd decimal(10,6)).
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0
): number {
  const pricing = PRICING[model]
  if (!pricing) {
    // Modelo desconhecido — nao quebra o fluxo, mas custo 0 sinaliza pra auditar.
    return 0
  }
  const billableInput = Math.max(inputTokens - cachedTokens, 0)
  const inputCost = (billableInput / 1_000_000) * pricing.inputPerMTok
  const cachedCost = (cachedTokens / 1_000_000) * pricing.inputPerMTok * CACHE_READ_MULTIPLIER
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok
  const total = inputCost + cachedCost + outputCost
  return Math.round(total * 1_000_000) / 1_000_000
}
