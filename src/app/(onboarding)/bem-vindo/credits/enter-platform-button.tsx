'use client'

import { useTransition } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { enterPlatform } from '@/lib/actions/onboarding'

/**
 * CTA "Acessar plataforma" da tela de credits. Action faz redirect interno
 * pro /dashboard; UI mostra "Indo..." durante a transition.
 */
export function EnterPlatformButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      onClick={() => startTransition(() => enterPlatform())}
      disabled={pending}
      className="gap-2 px-8 py-6 text-base"
    >
      {pending ? 'Indo...' : 'Acessar plataforma'}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  )
}
