import { z } from 'zod'

import { MODEL_TRIVIAL } from '../models'
import type { PromptDef } from '../prompts/types'

/**
 * LLM-as-judge: depois que um pipeline gera output, o judge (modelo barato —
 * Haiku) confere se está bem estruturado e completo. Se reprovar, o
 * claude.service refaz a análise 1x (spec §1.8). O judge NÃO consome créditos
 * do usuário, mas conta no hard cap de budget (é uma chamada Claude).
 */

export const judgeVerdictSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
})

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>

const SYSTEM_PROMPT = `Você é um revisor de qualidade de outputs de IA. Recebe o resultado JSON de uma análise e avalia se está bem estruturado, completo e coerente — NÃO se você concorda com o conteúdo, apenas se a forma está sólida (campos preenchidos, recomendações acionáveis, sem contradições internas óbvias, sem placeholders).

Responda SEMPRE e SOMENTE com JSON: { "approved": <bool>, "issues": ["<problema>", ...] }. Se aprovado, issues = [].`

export const structuralJudgePrompt: PromptDef<JudgeVerdict> = {
  pipelineId: 'structural-judge',
  version: '1.0.0',
  model: MODEL_TRIVIAL,
  maxTokens: 500,
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt: (input) =>
    `Avalie a estrutura/qualidade deste output:

${JSON.stringify(input, null, 2)}

Responda apenas com { "approved": bool, "issues": [...] }.`,
  schema: judgeVerdictSchema,
}
