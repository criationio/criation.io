/**
 * Placeholder de logo por marca. Mostra inicial estilizada com cor oficial
 * da marca enquanto SVG real nao chega em `public/logos/<provider>.svg`.
 *
 * Quando o SVG existir, o componente prioriza ele automaticamente
 * (basta dropar o arquivo). Sem refactor.
 */
import Image from 'next/image'

import { cn } from '@/lib/utils'

export type BrandProvider =
  | 'meta'
  | 'google'
  | 'hotmart'
  | 'kiwify'
  | 'eduzz'
  | 'generic'
  | 'others'

interface BrandConfig {
  initial: string
  bg: string
  fg: string
  hasSvg: boolean
}

const BRANDS: Record<BrandProvider, BrandConfig> = {
  meta: { initial: 'M', bg: '#1877F2', fg: '#fff', hasSvg: false },
  google: { initial: 'G', bg: '#4285F4', fg: '#fff', hasSvg: false },
  hotmart: { initial: 'H', bg: '#EF4E23', fg: '#fff', hasSvg: false },
  kiwify: { initial: 'K', bg: '#08C44C', fg: '#fff', hasSvg: false },
  eduzz: { initial: 'E', bg: '#FFB300', fg: '#1a1a1a', hasSvg: false },
  generic: { initial: '⚙', bg: '#6B7280', fg: '#fff', hasSvg: false },
  others: { initial: '+', bg: 'transparent', fg: 'var(--color-fg-muted)', hasSvg: false },
}

interface BrandLogoProps {
  provider: BrandProvider
  size?: number
  className?: string
}

export function BrandLogo({ provider, size = 40, className }: BrandLogoProps) {
  const cfg = BRANDS[provider]

  if (cfg.hasSvg) {
    return (
      <Image
        src={`/logos/${provider}.svg`}
        alt={provider}
        width={size}
        height={size}
        className={cn('rounded-md', className)}
      />
    )
  }

  const isOthers = provider === 'others'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
        isOthers && 'border border-dashed border-[var(--color-border)]',
        className
      )}
      style={{
        width: size,
        height: size,
        background: cfg.bg,
        color: cfg.fg,
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
      }}
    >
      {cfg.initial}
    </span>
  )
}
