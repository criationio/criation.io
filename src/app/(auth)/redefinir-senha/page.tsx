import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { RedefinirForm } from './redefinir-form'

export default function RedefinirSenhaPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Informe seu email e voce vai receber um link para criar uma nova senha.
        </p>
        <RedefinirForm />
        <Link
          href="/login"
          className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Voltar ao login
        </Link>
      </CardContent>
    </Card>
  )
}
