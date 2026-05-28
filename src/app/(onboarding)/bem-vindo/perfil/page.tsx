import { redirect } from 'next/navigation'

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getOnboardingState } from '@/lib/db/queries/users'
import { users } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import {
  PerfilForm,
  type GatewayKey,
  type MonthlyAdSpend,
  type MonthlyRevenue,
} from './perfil-form'

const GATEWAY_KEYS: ReadonlyArray<GatewayKey> = [
  'hotmart',
  'kiwify',
  'eduzz',
  'monetizze',
  'ticto',
  'cakto',
  'outro',
  'nenhum',
]
const REVENUE_KEYS: ReadonlyArray<MonthlyRevenue> = [
  'lt100k',
  '100k_300k',
  '300k_1m',
  '1m_5m',
  'gt5m',
]
const AD_SPEND_KEYS: ReadonlyArray<MonthlyAdSpend> = [
  'lt10k',
  '10k_50k',
  '50k_100k',
  '100k_300k',
  'gt300k',
]

/**
 * Step 1/7 — perfil. Coleta nome (obrigatorio), nicho, gateways usados,
 * faturamento mensal e investimento em ads (todos opcionais). Persiste em
 * users.name + users.profile_context. Step nao-pulavel.
 */
export default async function PerfilStepPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const state = await getOnboardingState(user.id)
  if (!state) redirect('/login')
  if (state.step === 'completed') redirect('/dashboard')

  if (state.step !== 'perfil') {
    redirect(`/bem-vindo/${state.step}`)
  }

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { name: true },
  })

  const ctx = state.profileContext
  const rawGateways = Array.isArray(ctx.gateways) ? ctx.gateways : []
  const defaultGateways = rawGateways.filter(
    (g): g is GatewayKey =>
      typeof g === 'string' && (GATEWAY_KEYS as ReadonlyArray<string>).includes(g)
  )
  const monthlyRevenue =
    typeof ctx.monthlyRevenue === 'string' &&
    (REVENUE_KEYS as ReadonlyArray<string>).includes(ctx.monthlyRevenue)
      ? (ctx.monthlyRevenue as MonthlyRevenue)
      : ''
  const monthlyAdSpend =
    typeof ctx.monthlyAdSpend === 'string' &&
    (AD_SPEND_KEYS as ReadonlyArray<string>).includes(ctx.monthlyAdSpend)
      ? (ctx.monthlyAdSpend as MonthlyAdSpend)
      : ''

  return (
    <div>
      <span className="text-label text-[10px]">Passo 1</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Vamos te conhecer</h1>
      <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
        Algumas perguntas rapidas pra Criation se adaptar ao seu contexto.
      </p>

      <div className="mt-8">
        <PerfilForm
          defaultName={userRow?.name ?? ''}
          defaultNiche={typeof ctx.niche === 'string' ? ctx.niche : ''}
          defaultGateways={defaultGateways}
          defaultMonthlyRevenue={monthlyRevenue}
          defaultMonthlyAdSpend={monthlyAdSpend}
        />
      </div>
    </div>
  )
}
