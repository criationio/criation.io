'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

import { updatePasswordAction, type ActionResult } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ActionResult | null = null

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return updatePasswordAction(formData)
}

export function ApplyResetForm() {
  const [state, formAction, pending] = useActionState(action, initialState)
  const router = useRouter()

  useEffect(() => {
    if (state?.ok && state.data?.redirectTo) {
      router.push(state.data.redirectTo)
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">Confirme</Label>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          autoComplete="new-password"
        />
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
        {pending ? 'Salvando...' : 'Salvar nova senha'}
      </Button>
    </form>
  )
}
