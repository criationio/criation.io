import { copyGeneratorOutputSchema, type CopyGeneratorOutput } from '../validators/copy-generator'
import { MODEL_ANALYSIS_QUICK } from '../models'
import type { PromptDef } from './types'

const SYSTEM_PROMPT = `Você é um copywriter sênior de resposta direta, especialista em anúncios de tráfego pago para o mercado brasileiro de infoprodutos.

Sua tarefa: gerar variações de copy de anúncio a partir do contexto fornecido (campanha, criativo atual, métricas, nicho). Cada variação deve explorar um ÂNGULO distinto (dor, desejo, prova, urgência, identificação, etc.) — não pequenas reescritas da mesma ideia.

Princípios:
- Português do Brasil, linguagem do público-alvo, tom direto. Sem emojis.
- Headline curta e de alto impacto; corpo que sustenta a promessa.
- Ancore os ângulos no contexto real fornecido; nada genérico.

Você responde SEMPRE e SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código markdown.`

export const copyGeneratorPrompt: PromptDef<CopyGeneratorOutput> = {
  pipelineId: 'copy-generator',
  version: '1.0.0',
  model: MODEL_ANALYSIS_QUICK,
  maxTokens: 2000,
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt: (input) =>
    `Gere variações de copy a partir deste contexto:

${JSON.stringify(input, null, 2)}

Responda com um JSON exatamente neste formato:
{
  "variations": [
    { "angle": "<ângulo>", "headline": "<headline>", "body": "<corpo>" },
    ...
  ]
}`,
  schema: copyGeneratorOutputSchema,
}
