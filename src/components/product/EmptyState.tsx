import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  cta?: { label: string; onClick?: () => void; href?: string }
  size?: 'sm' | 'md' | 'lg'
}

const sizing = {
  sm: { icon: 32, padding: 'py-8', titleSize: 'text-base', iconWrap: 'h-12 w-12' },
  md: { icon: 40, padding: 'py-12', titleSize: 'text-md', iconWrap: 'h-16 w-16' },
  lg: { icon: 48, padding: 'py-16', titleSize: 'text-lg', iconWrap: 'h-20 w-20' },
}

export function EmptyState({ icon: Icon, title, description, cta, size = 'md' }: EmptyStateProps) {
  const s = sizing[size]
  return (
    <div className={`flex flex-col items-center text-center ${s.padding} px-4`}>
      <div
        className={`${s.iconWrap} mb-4 flex items-center justify-center rounded-full`}
        style={{ backgroundColor: 'var(--color-accent-muted)' }}
      >
        <Icon size={s.icon} style={{ color: 'var(--color-accent)' }} />
      </div>
      <h3 className={`${s.titleSize} mb-1.5 font-semibold text-[var(--color-fg)]`}>{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-[var(--color-fg-muted)]">{description}</p>
      {cta &&
        (cta.href ? (
          <Button asChild variant="primary">
            <a href={cta.href}>{cta.label}</a>
          </Button>
        ) : (
          <Button variant="primary" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ))}
    </div>
  )
}
