import { analysisQuickPrompt } from './analysis-quick.v1.0.0'
import { copyGeneratorPrompt } from './copy-generator.v1.0.0'

/**
 * Registry de prompts em produção. Usado pelo seed de prompt_versions
 * (Sessão 1.8 commit 5) e como referência única dos prompts vigentes.
 */
export const PRODUCTION_PROMPTS = [analysisQuickPrompt, copyGeneratorPrompt] as const

export { analysisQuickPrompt, copyGeneratorPrompt }
