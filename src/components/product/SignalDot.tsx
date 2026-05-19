type SignalStatus = 'green' | 'amber' | 'red' | 'gray'

interface SignalDotProps {
  status: SignalStatus
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
}

const sizes = { sm: 6, md: 8, lg: 10 }

export function SignalDot({ status, size = 'md', pulse = false }: SignalDotProps) {
  const px = sizes[size]
  return (
    <span className="relative inline-flex" style={{ width: px, height: px }}>
      {pulse && (
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-60"
          style={{ backgroundColor: `var(--color-signal-${status})` }}
        />
      )}
      <span
        className="relative inline-block rounded-full"
        style={{ width: px, height: px, backgroundColor: `var(--color-signal-${status})` }}
      />
    </span>
  )
}
