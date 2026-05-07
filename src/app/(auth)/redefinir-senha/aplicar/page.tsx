import { redirect } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getUser } from '@/lib/supabase/server'

import { ApplyResetForm } from './apply-reset-form'

export default async function ApplyResetPage() {
  // PKCE flow: callback handler ja exchanged code -> session.
  // Sem session aqui = link expirado ou usuario nunca passou pelo callback.
  const user = await getUser()
  if (!user) {
    redirect('/redefinir-senha?expired=1')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
      </CardHeader>
      <CardContent>
        <ApplyResetForm />
      </CardContent>
    </Card>
  )
}
