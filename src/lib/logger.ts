import pino from 'pino'

import { getCorrelationId } from './correlation'

const redactPaths = [
  '*.email',
  '*.password',
  '*.token',
  '*.key',
  '*.secret',
  '*.cpf',
  '*.cnpj',
  '*.document',
  '*.documento',
  '*.phone',
  '*.telefone',
  '*.celular',
  '*.ip',
  '*.name',
  '*.nome',
  '*.address',
  '*.endereco',
  '*.client_secret',
  '*.api_key',
  '*.hottok',
  'email',
  'password',
  'token',
  'document',
  'phone',
  'name',
  'client_secret',
  'hottok',
]

const transport =
  process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' as const, options: { colorize: true } }
    : undefined

const baseOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: redactPaths,
  base: { service: 'criation-io' },
  mixin: () => ({ correlationId: getCorrelationId() }),
}

export const logger = transport ? pino({ ...baseOptions, transport }) : pino(baseOptions)

export const authLogger = logger.child({ domain: 'auth' })
export const billingLogger = logger.child({ domain: 'billing' })
export const analysisLogger = logger.child({ domain: 'analysis' })
export const capiLogger = logger.child({ domain: 'capi' })
export const trackingLogger = logger.child({ domain: 'tracking' })
export const dbLogger = logger.child({ domain: 'db' })
