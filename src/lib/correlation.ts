import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'

/**
 * Correlation ID storage — TD-021.
 *
 * Middleware (`src/middleware.ts`) gera `x-correlation-id` por request e
 * propaga no header. Mas AsyncLocalStorage **so persiste em call chain
 * dentro da mesma function** — middleware termina e o context se perde
 * quando Next.js entrega control ao route handler.
 *
 * Padrao: entry points (route handlers, Server Actions, Trigger.dev tasks)
 * leem o header/metadata e envelopam o trabalho em `withCorrelation`. Daquele
 * ponto em diante, `getCorrelationId()` retorna o ID propagado em vez de
 * gerar um novo, e `logger.info` (que usa mixin getCorrelationId) loga com
 * ID consistente.
 *
 * Sem isso (estado anterior): cada `logger.X()` cria um UUID novo, impossivel
 * correlacionar logs do mesmo request.
 */

interface CorrelationContext {
  correlationId: string
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>()

export function getCorrelationId(): string {
  return correlationStorage.getStore()?.correlationId ?? crypto.randomUUID()
}

export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

/**
 * Envelopa fn em AsyncLocalStorage com correlationId. Logger dentro de fn
 * (qualquer profundidade async) vai usar o ID propagado.
 *
 * @example Route handler (Node.js runtime):
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const cid = req.headers.get('x-correlation-id') ?? generateCorrelationId()
 *   return withCorrelation(cid, async () => {
 *     // logger.info aqui usa cid
 *   })
 * }
 * ```
 *
 * @example Server Action:
 * ```ts
 * import { headers } from 'next/headers'
 * export async function someAction() {
 *   const h = await headers()
 *   const cid = h.get('x-correlation-id') ?? generateCorrelationId()
 *   return withCorrelation(cid, async () => { ... })
 * }
 * ```
 *
 * @example Trigger.dev task — propagar via payload:
 * ```ts
 * run: async (payload: { correlationId?: string }) => {
 *   const cid = payload.correlationId ?? generateCorrelationId()
 *   return withCorrelation(cid, async () => { ... })
 * }
 * ```
 */
export async function withCorrelation<T>(correlationId: string, fn: () => Promise<T>): Promise<T> {
  return correlationStorage.run({ correlationId }, fn)
}

/**
 * Helper sync para callers que precisam de bloco sincrono dentro do scope.
 * Maioria dos casos usar `withCorrelation` (async).
 */
export function withCorrelationSync<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run({ correlationId }, fn)
}

/**
 * Le `x-correlation-id` do request header (setado pelo middleware) ou gera
 * um novo. Helper pra entry points async como Server Actions.
 *
 * @example
 * ```ts
 * export async function someAction() {
 *   const cid = await getCorrelationIdFromRequest()
 *   return withCorrelation(cid, async () => { ... })
 * }
 * ```
 */
export async function getCorrelationIdFromRequest(): Promise<string> {
  // Import lazy pra evitar pin do Next runtime em testes
  const { headers } = await import('next/headers')
  const h = await headers()
  return h.get('x-correlation-id') ?? generateCorrelationId()
}

/**
 * Helper combinado pra Server Actions: le o correlationId do request header
 * e envelopa o trabalho. Padrao mais conciso quando o caller nao precisa
 * acessar o cid diretamente.
 *
 * @example
 * ```ts
 * export async function someAction(input: Input): Promise<Result> {
 *   return withCorrelatedAction(async () => {
 *     // existing body — logger.* dentro daqui usa correlationId propagado
 *   })
 * }
 * ```
 */
export async function withCorrelatedAction<T>(fn: () => Promise<T>): Promise<T> {
  const cid = await getCorrelationIdFromRequest()
  return withCorrelation(cid, fn)
}
