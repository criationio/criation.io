'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitProfile } from '@/lib/actions/onboarding'

type ActionState = Awaited<ReturnType<typeof submitProfile>> | null

export type GatewayKey =
  | 'hotmart'
  | 'kiwify'
  | 'eduzz'
  | 'monetizze'
  | 'ticto'
  | 'cakto'
  | 'outro'
  | 'nenhum'

export type MonthlyRevenue = '' | 'lt100k' | '100k_300k' | '300k_1m' | '1m_5m' | 'gt5m'
export type MonthlyAdSpend = '' | 'lt10k' | '10k_50k' | '50k_100k' | '100k_300k' | 'gt300k'

interface PerfilFormProps {
  defaultName: string
  defaultNiche: string
  defaultGateways: ReadonlyArray<GatewayKey>
  defaultMonthlyRevenue: MonthlyRevenue
  defaultMonthlyAdSpend: MonthlyAdSpend
}

const GATEWAYS: { key: GatewayKey; label: string }[] = [
  { key: 'hotmart', label: 'Hotmart' },
  { key: 'kiwify', label: 'Kiwify' },
  { key: 'eduzz', label: 'Eduzz' },
  { key: 'monetizze', label: 'Monetizze' },
  { key: 'ticto', label: 'Ticto' },
  { key: 'cakto', label: 'Cakto' },
  { key: 'outro', label: 'Outro' },
  { key: 'nenhum', label: 'Não uso' },
]

const REVENUE_OPTS: { value: MonthlyRevenue; label: string }[] = [
  { value: '', label: 'Prefiro nao informar' },
  { value: 'lt100k', label: 'Abaixo de R$ 100 mil' },
  { value: '100k_300k', label: 'Entre R$ 100 mil e R$ 300 mil' },
  { value: '300k_1m', label: 'Entre R$ 300 mil e R$ 1 milhão' },
  { value: '1m_5m', label: 'Entre R$ 1 milhão e R$ 5 milhões' },
  { value: 'gt5m', label: 'Acima de R$ 5 milhões' },
]

const AD_SPEND_OPTS: { value: MonthlyAdSpend; label: string }[] = [
  { value: '', label: 'Prefiro nao informar' },
  { value: 'lt10k', label: 'Abaixo de R$ 10 mil' },
  { value: '10k_50k', label: 'Entre R$ 10 mil e R$ 50 mil' },
  { value: '50k_100k', label: 'Entre R$ 50 mil e R$ 100 mil' },
  { value: '100k_300k', label: 'Entre R$ 100 mil e R$ 300 mil' },
  { value: 'gt300k', label: 'Acima de R$ 300 mil' },
]

export function PerfilForm(props: PerfilFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitProfile, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.push(state.redirectTo)
    }
  }, [state, router])

  const defaultGatewaysSet = new Set<GatewayKey>(props.defaultGateways)

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">
          Como podemos te chamar? <span className="text-[var(--color-danger)]">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoFocus
          required
          maxLength={200}
          placeholder="Seu nome"
          defaultValue={props.defaultName}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="niche">Em qual nicho voce atua?</Label>
        <Input
          id="niche"
          name="niche"
          type="text"
          maxLength={100}
          placeholder="Ex: emagrecimento, finance, dev, beauty..."
          defaultValue={props.defaultNiche}
        />
        <p className="text-xs text-[var(--color-fg-subtle)]">
          Opcional — ajuda nossa IA a contextualizar análises.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-label text-[10px]">Quais gateways de venda você usa?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GATEWAYS.map((g) => (
            <label
              key={g.key}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm transition-colors has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent)]/5"
            >
              <input
                type="checkbox"
                name="gateways"
                value={g.key}
                defaultChecked={defaultGatewaysSet.has(g.key)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-[var(--color-fg-subtle)]">
          Pode selecionar mais de um. Opcional.
        </p>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="monthlyRevenue">Faturamento médio mensal</Label>
        <select
          id="monthlyRevenue"
          name="monthlyRevenue"
          defaultValue={props.defaultMonthlyRevenue}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          {REVENUE_OPTS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="monthlyAdSpend">Investimento mensal em ads</Label>
        <select
          id="monthlyAdSpend"
          name="monthlyAdSpend"
          defaultValue={props.defaultMonthlyAdSpend}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          {AD_SPEND_OPTS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {state?.ok === false && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {state.error.message}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Salvando...' : 'Continuar'}
      </Button>
    </form>
  )
}
