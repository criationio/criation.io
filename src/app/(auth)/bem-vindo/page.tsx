import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import { workspaceMembers } from '@/lib/db/schema/auth'
import { getBalanceForWorkspace } from '@/lib/db/queries/credits'
import { getUser } from '@/lib/supabase/server'

export default async function BemVindoPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const member = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
    columns: { workspaceId: true },
  })

  const balance = member ? await getBalanceForWorkspace(member.workspaceId) : null
  const signupBalance = balance?.signupBalance ?? 0
  const expiresAt = balance?.signupExpiresAt
  const expiresIn = expiresAt ? daysUntil(expiresAt) : 90

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bem-vindo!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base text-[var(--color-fg)]">
          Voce ganhou{' '}
          <strong className="text-[var(--color-accent)]">{signupBalance} creditos</strong> para
          comecar.
        </p>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Esses creditos expiram em {expiresIn} dias. Use para sua primeira analise.
        </p>
        <Button asChild className="w-full">
          <Link href="/estudio">Fazer primeira analise</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}
