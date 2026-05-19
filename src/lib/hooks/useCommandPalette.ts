'use client'

import { useEffect } from 'react'
import { create } from 'zustand'

interface CommandPaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))

/**
 * Liga Cmd+K (Mac) / Ctrl+K (Windows/Linux) globalmente.
 * Monte uma vez no shell — toda invocacao adicional e idempotente.
 */
export function useCommandPaletteShortcut() {
  const toggle = useCommandPaletteStore((s) => s.toggle)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}
