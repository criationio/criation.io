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
