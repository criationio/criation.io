import { Sparkles, Globe, Users, Tag, type LucideIcon } from 'lucide-react'

export type BottleneckType = 'creative' | 'page' | 'audience' | 'offer'

interface BottleneckBadgeProps {
  type: BottleneckType
  size?: 'sm' | 'md'
  showIcon?: boolean
}

const config: Record<BottleneckType, { label: string; icon: LucideIcon; varSuffix: string }> = {
  creative: { label: 'Criativo', icon: Sparkles, varSuffix: 'creative' },
  page: { label: 'Landing', icon: Globe, varSuffix: 'page' },
  audience: { label: 'Audiência', icon: Users, varSuffix: 'audience' },
  offer: { label: 'Oferta', icon: Tag, varSuffix: 'offer' },
}

export function BottleneckBadge({ type, size = 'md', showIcon = true }: BottleneckBadgeProps) {
  const { label, icon: Icon, varSuffix } = config[type]
  const sizeClass = size === 'sm' ? 'text-2xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  const iconSize = size === 'sm' ? 10 : 12

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sizeClass}`}
      style={{
        backgroundColor: `var(--color-bottleneck-${varSuffix}-bg)`,
        color: `var(--color-bottleneck-${varSuffix})`,
        border: `1px solid var(--color-bottleneck-${varSuffix}-border)`,
      }}
    >
      {showIcon && <Icon size={iconSize} />}
      {label}
    </span>
  )
}
