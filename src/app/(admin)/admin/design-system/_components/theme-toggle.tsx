'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Carregando toggle de tema"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium whitespace-nowrap text-[var(--color-fg-muted)] opacity-0"
      >
        <Sun size={14} />
        <span>—</span>
      </button>
    )
  }

  const isDark = theme === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = isDark ? 'Light Mode' : 'Dark Mode'
  const next = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Mudar para ${label}`}
      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium whitespace-nowrap text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-hover)]"
    >
      <Icon size={14} />
      <span>&rarr; {label}</span>
    </button>
  )
}
