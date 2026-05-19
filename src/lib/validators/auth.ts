import { z } from 'zod/v4'

/**
 * Validators dos fluxos de autenticacao.
 * Importados por Server Actions e Route Handlers (Step 7).
 */

const password = z
  .string()
  .min(10, 'minimo 10 caracteres')
  .max(128, 'maximo 128 caracteres')
  .regex(/[A-Za-z]/, 'precisa ao menos 1 letra')
  .regex(/[0-9]/, 'precisa ao menos 1 numero')

export const signupSchema = z.object({
  email: z.email().toLowerCase().trim().max(254),
  password,
  fingerprint: z.string().max(128).optional(),
  // Honeypot anti-bot — campo invisivel no form, deve vir vazio.
  honeypot: z.string().max(0).optional(),
})

export const loginSchema = z.object({
  email: z.email().toLowerCase().trim(),
  password: z.string().min(1),
})

export const magicLinkSchema = z.object({
  email: z.email().toLowerCase().trim(),
})

export const resetRequestSchema = z.object({
  email: z.email().toLowerCase().trim(),
})

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'senhas nao coincidem',
  })

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type MagicLinkInput = z.infer<typeof magicLinkSchema>
export type ResetRequestInput = z.infer<typeof resetRequestSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
