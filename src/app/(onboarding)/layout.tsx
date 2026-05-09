import { redirect } from 'next/navigation'

import { Toaster } from '@/components/ui/sonner'
import { getUser } from '@/lib/supabase/server'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="flex h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-6">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-fg-on-accent)]"
            aria-hidden
          >
            C
          </span>
          Criation
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
