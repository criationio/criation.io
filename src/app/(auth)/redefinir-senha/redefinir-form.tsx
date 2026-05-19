'use client'

import { useActionState } from 'react'

import { requestPasswordResetAction, type ActionResult } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ActionResult | null = null

async function action(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return requestPasswordResetAction(formData)
}

export function RedefinirForm() {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      {state?.ok && state.data?.message && (
        <div
          role="status"
          className="rounded-lg border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-3 py-2 text-sm text-[var(--color-info)]"
        >
          {state.data.message}
        </div>
      )}
      {state?.ok === false && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
        >
          {state.error.message}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Enviando...' : 'Receber link'}
      </Button>
    </form>
  )
}
