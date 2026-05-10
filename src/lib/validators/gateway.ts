import { z } from 'zod'

/**
 * Schemas Zod para inputs publicos das actions de gateway.
 * Schema do payload Hotmart vive em `services/gateways/hotmart/parser.ts`.
 *
 * MVP (Sessao 1.4.5): so precisamos do HOTTOK (HMAC do webhook). Credenciais
 * OAuth (clientId/clientSecret) ficam para fase pos-MVP, junto com backfill.
 */

export const connectHotmartSchema = z.object({
  hottok: z
    .string()
    .trim()
    .min(10, 'HOTTOK muito curto. Copie do painel app-postback.hotmart.com.'),
  sandbox: z.boolean().optional().default(false),
})

export type ConnectHotmartInput = z.infer<typeof connectHotmartSchema>

export const disconnectGatewaySchema = z.object({
  connectionId: z.string().uuid(),
})

/**
 * Connect Kiwify: o token e gerado pelo nosso wizard como UUIDv4 e
 * apresentado ao cliente para colar no painel Kiwify (ADR-017 dec.1).
 * Cliente pode alternativamente colar token proprio se ja tiver um webhook
 * configurado.
 */
export const connectKiwifySchema = z.object({
  /** Token plain — UUIDv4 sugerido ou string custom do cliente. */
  webhookToken: z
    .string()
    .trim()
    .min(8, 'Token muito curto. Use o gerado pelo wizard ou um UUIDv4 proprio.'),
})

export type ConnectKiwifyInput = z.infer<typeof connectKiwifySchema>
