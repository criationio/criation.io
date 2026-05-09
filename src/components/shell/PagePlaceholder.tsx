import { Construction } from 'lucide-react'

interface PagePlaceholderProps {
  title: string
  description?: string
  session?: string
}

export function PagePlaceholder({ title, description, session }: PagePlaceholderProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]">
          <Construction className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {description && <p className="mt-2 text-sm text-[var(--color-fg-muted)]">{description}</p>}
        {session && (
          <span className="mt-4 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 font-mono text-[10px] text-[var(--color-fg-subtle)]">
            {session}
          </span>
        )}
      </div>
    </main>
  )
}
