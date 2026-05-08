import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { LoginForm } from './login-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ResetBanner promise={searchParams} />
        <LoginForm />
        <div className="flex flex-col gap-2 text-sm text-[var(--color-fg-muted)]">
          <Link
            href="/redefinir-senha"
            className="text-[var(--color-accent)] underline-offset-4 hover:underline"
          >
            Esqueci a senha
          </Link>
          <p>
            Nao tem conta?{' '}
            <Link
              href="/signup"
              className="text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

async function ResetBanner({ promise }: { promise: Promise<{ reset?: string; error?: string }> }) {
  const params = await promise
  if (params.reset === 'ok') {
    return (
      <div
        role="status"
        className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]"
      >
        Senha atualizada. Faca login com a nova senha.
      </div>
    )
  }
  if (params.error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]"
      >
        Falha ao processar link. Tente novamente.
      </div>
    )
  }
  return null
}
