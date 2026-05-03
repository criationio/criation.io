import { AsyncLocalStorage } from 'node:async_hooks'
import crypto from 'node:crypto'

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
