'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef } from 'react'

import { signupAction, type ActionResult } from '@/lib/actions/auth'
import { getFingerprint } from '@/lib/security/fingerprint'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HoneypotField } from '@/components/auth/honeypot'

const initialState: ActionResult | null = null

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return signupAction(formData)
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(action, initialState)
  const router = useRouter()
  const fingerprintRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const fp = await getFingerprint()
      if (fp && fingerprintRef.current) fingerprintRef.current.value = fp
    })()
  }, [])

  useEffect(() => {
    if (state?.ok && state.data?.redirectTo) {
      router.push(state.data.redirectTo)
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      <input ref={fingerprintRef} type="hidden" name="fingerprint" defaultValue="" />
      <HoneypotField />

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
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
        />
        <p className="text-xs text-[var(--color-fg-muted)]">
          Minimo 10 caracteres, com letras e numeros.
        </p>
      </div>

      {state?.ok === false && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
        >
          {state.error.message}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Criando...' : 'Criar conta'}
      </Button>
    </form>
  )
}
