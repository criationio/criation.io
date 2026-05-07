/**
 * Discriminated result type para Server Actions e services de auth.
 * Erros de fluxo (validacao, conflito) retornam { ok: false, error }.
 * Erros inesperados (DB down, infra) viram throw — capturados por
 * error.tsx ou pelo middleware do Next.js.
 *
 * Compatibilidade futura: quando neverthrow entrar (Sessao 1.4.9 / 1.8),
 * `Result<T, AuthError>` substitui esse shape sem mudanca semantica.
 */

export interface AuthErrorShape {
  code: string
  message: string
  field?: string
}

export type AuthOutcome<T> = { ok: true; data: T } | { ok: false; error: AuthErrorShape }

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }

  toShape(): AuthErrorShape {
    return { code: this.code, message: this.message }
  }
}

export const AUTH_ERROR_CODES = {
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  RATE_LIMITED: 'RATE_LIMITED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  HONEYPOT_TRIGGERED: 'HONEYPOT_TRIGGERED',
  INTERNAL: 'INTERNAL',
} as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]
