import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <SignupForm />
        <p className="text-sm text-[var(--color-fg-muted)]">
          Ja tem conta?{' '}
          <Link
            href="/login"
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
