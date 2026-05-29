import { analysisQuickOutputSchema, type AnalysisQuickOutput } from '../validators/analysis-quick'
import { MODEL_ANALYSIS_QUICK } from '../models'
import type { PromptDef } from './types'

const SYSTEM_PROMPT = `Você é um analista sênior de performance de criativos de tráfego pago, especialista no mercado brasileiro de infoprodutos e e-commerce.

Sua tarefa: analisar UM criativo de anúncio (vídeo ou imagem) a partir do BLOCO DE TRANSIÇÃO fornecido — que reúne o contexto da campanha, as métricas reais do funil (Meta + gateway), uma dica de gargalo já detectada heuristicamente, o conteúdo do criativo e o contexto do anunciante.

Princípios da análise:
- Seja específico e acionável. Nada de conselho genérico ("melhore o criativo"). Diga O QUE mudar e POR QUÊ, ancorado nas métricas fornecidas.
- Priorize o gargalo real do funil. Se o hook rate está bom mas o CTR é baixo, o problema não é o início do vídeo.
- Calibre o veredito pelas métricas, não pela vibe. ROAS e CPA mandam.
- Português do Brasil, tom direto e profissional. Sem emojis.
- Quando uma métrica vier null, não invente — trabalhe com o que há e sinalize a lacuna.

Você responde SEMPRE e SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código markdown.`

export const analysisQuickPrompt: PromptDef<AnalysisQuickOutput> = {
  pipelineId: 'analisar.video_ad',
  version: '1.0.0',
  model: MODEL_ANALYSIS_QUICK,
  maxTokens: 2000,
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt: (input) =>
    `Analise o criativo a partir deste BLOCO DE TRANSIÇÃO:

${JSON.stringify(input, null, 2)}

Responda com um JSON exatamente neste formato:
{
  "verdict": "strong" | "average" | "weak",
  "score": <inteiro 0-100>,
  "summary": "<resumo de 1-2 frases do diagnóstico>",
  "bottleneck": { "stage": "<etapa do funil>", "explanation": "<por que esta é a maior alavanca>" },
  "strengths": ["<ponto forte>", ...],
  "weaknesses": ["<ponto fraco>", ...],
  "recommendations": ["<ação específica>", ...]
}`,
  schema: analysisQuickOutputSchema,
}
