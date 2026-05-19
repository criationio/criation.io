import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent)]/80',
        secondary:
          'border-transparent bg-[var(--color-bg-elevated)] text-[var(--color-fg)] hover:bg-[var(--color-bg-elevated)]/80',
        destructive:
          'border-transparent bg-[var(--color-danger)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-danger)]/80',
        outline: 'text-[var(--color-fg)]',
        'bottleneck-creative':
          'bg-[var(--color-bottleneck-creative-bg)] text-[var(--color-bottleneck-creative)] border border-[var(--color-bottleneck-creative-border)]',
        'bottleneck-page':
          'bg-[var(--color-bottleneck-page-bg)] text-[var(--color-bottleneck-page)] border border-[var(--color-bottleneck-page-border)]',
        'bottleneck-audience':
          'bg-[var(--color-bottleneck-audience-bg)] text-[var(--color-bottleneck-audience)] border border-[var(--color-bottleneck-audience-border)]',
        'bottleneck-offer':
          'bg-[var(--color-bottleneck-offer-bg)] text-[var(--color-bottleneck-offer)] border border-[var(--color-bottleneck-offer-border)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
