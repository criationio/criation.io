import type { z } from 'zod'

/**
 * Definição versionada de um prompt. O conteúdo (system + template) vive em
 * código (versionado em git); ao deploy, persiste-se uma row em
 * `prompt_versions` com status='production' (Sessão 1.8 commit 5).
 *
 * `version` segue semver e compõe a chave única (pipelineId, version) em
 * prompt_versions. Bump de versão = novo prompt; o anterior vira histórico.
 */
export interface PromptDef<T> {
  pipelineId: string
  version: string
  model: string
  maxTokens: number
  /** Estável e cacheável (cache_control no system block). Não interpolar dados voláteis aqui. */
  systemPrompt: string
  /** Monta o user turn a partir do input do pipeline (BLOCO DE TRANSIÇÃO ou similar). */
  buildUserPrompt: (input: unknown) => string
  /** Valida o output do Claude antes de retornar/persistir. */
  schema: z.ZodType<T>
}
