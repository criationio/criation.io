import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="text-2xl font-bold text-[var(--color-fg)]">
            Criation
          </Link>
        </div>
        {children}
      </div>
    </main>
  )
}
