import pino from 'pino'

import { getCorrelationId } from './correlation'

const transport =
  process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' as const, options: { colorize: true } }
    : undefined

export const logger = transport
  ? pino({
      level: process.env.LOG_LEVEL ?? 'info',
      mixin: () => ({ correlationId: getCorrelationId() }),
      transport,
    })
  : pino({
      level: process.env.LOG_LEVEL ?? 'info',
      mixin: () => ({ correlationId: getCorrelationId() }),
    })
