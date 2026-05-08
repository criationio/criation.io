import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUser } from '@/lib/supabase/server'

export default async function VerificarEmailPage() {
  const user = await getUser()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirme seu email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Enviamos um link de confirmacao para{' '}
          <span className="text-[var(--color-fg)]">{user?.email ?? 'seu email'}</span>. Confira sua
          caixa de entrada — pode estar em spam.
        </p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Apos confirmar, voce ganha 50 creditos para experimentar.
        </p>
      </CardContent>
    </Card>
  )
}
