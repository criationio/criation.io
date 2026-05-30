/**
 * Catálogo de planos — fonte única de verdade (nome/preço/créditos/seats).
 * Mudar valor/nome aqui propaga pra toda a UI, checkout e webhooks (1.12+).
 *
 * IDs (`pro`/`advanced`/`enterprise`) batem com `users.plan_id`,
 * `subscriptions.plan_id` e as keys de `PLAN_CLAUDE_BUDGETS_BRL_CENTS`
 * (lib/claude/budget.ts). `free`/`trial` não são planos pagos.
 *
 * Anual = mensal × 10 (desconto de 16,7% ≈ 2 meses grátis). Créditos de
 * subscription expiram no fim do ciclo (sem rollover — v0.6 §4.2).
 */

export type PlanId = 'pro' | 'advanced' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  monthlyPriceBrlCents: number
  yearlyPriceBrlCents: number
  creditsPerCycle: number
  seats: number
  popular?: boolean
}

export const PLANS: readonly Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    monthlyPriceBrlCents: 29700,
    yearlyPriceBrlCents: 297000,
    creditsPerCycle: 120,
    seats: 1,
  },
  {
    id: 'advanced',
    name: 'Advanced',
    monthlyPriceBrlCents: 49700,
    yearlyPriceBrlCents: 497000,
    creditsPerCycle: 300,
    seats: 3,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPriceBrlCents: 99700,
    yearlyPriceBrlCents: 997000,
    creditsPerCycle: 700,
    seats: 10,
  },
] as const

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id.toLowerCase())
}

/** Rótulos de exibição por plan_id (inclui estados não-pagos). */
export const PLAN_LABELS: Record<string, string> = {
  free: 'Trial',
  trial: 'Trial',
  pro: 'Pro',
  advanced: 'Advanced',
  enterprise: 'Enterprise',
}
