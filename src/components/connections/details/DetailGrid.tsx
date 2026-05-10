import { cn } from '@/lib/utils'

export function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-xs">{children}</dl>
}

export function DetailField({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="mb-1 text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </dt>
      <dd className={cn('text-[var(--color-fg)]', mono && 'font-mono')} data-tabular>
        {children}
      </dd>
    </div>
  )
}
