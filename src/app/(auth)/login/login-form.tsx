'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { loginAction, requestMagicLinkAction, type ActionResult } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ActionResult | null = null

async function passwordAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  return loginAction(formData)
}

async function magicAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return requestMagicLinkAction(formData)
}

type Mode = 'password' | 'magic'

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('password')
  const [pwState, pwAction, pwPending] = useActionState(passwordAction, initialState)
  const [magicState, magicFormAction, magicPending] = useActionState(magicAction, initialState)
  const router = useRouter()

  useEffect(() => {
    if (pwState?.ok && pwState.data?.redirectTo) {
      router.push(pwState.data.redirectTo)
    }
  }, [pwState, router])

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Metodo de login"
        className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          onClick={() => setMode('password')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            mode === 'password'
              ? 'bg-[var(--color-bg-emphasis)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-muted)]'
          }`}
        >
          Senha
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'magic'}
          onClick={() => setMode('magic')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
            mode === 'magic'
              ? 'bg-[var(--color-bg-emphasis)] text-[var(--color-fg)]'
              : 'text-[var(--color-fg-muted)]'
          }`}
        >
          Link magico
        </button>
      </div>

      {mode === 'password' ? (
        <form action={pwAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {pwState?.ok === false && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
            >
              {pwState.error.message}
            </div>
          )}
          <Button type="submit" disabled={pwPending} className="w-full">
            {pwPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      ) : (
        <form action={magicFormAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-magic">Email</Label>
            <Input id="email-magic" name="email" type="email" required autoComplete="email" />
          </div>
          {magicState?.ok && magicState.data?.message && (
            <div
              role="status"
              className="rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-3 py-2 text-sm text-[var(--color-info)]"
            >
              {magicState.data.message}
            </div>
          )}
          {magicState?.ok === false && (
            <div
              role="alert"
              className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
            >
              {magicState.error.message}
            </div>
          )}
          <Button type="submit" disabled={magicPending} className="w-full">
            {magicPending ? 'Enviando...' : 'Receber link'}
          </Button>
        </form>
      )}
    </div>
  )
}
