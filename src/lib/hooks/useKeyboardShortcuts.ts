'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useCommandPaletteStore } from './useCommandPalette'

interface ChordTarget {
  /** Sequence keys, ja em lowercase. Ex: ['g', 'd']. */
  keys: readonly string[]
  /** Callback executado ao completar a sequencia. */
  run: () => void
}

const CHORD_TIMEOUT_MS = 1200

function shouldIgnoreEvent(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * Atalhos globais por sequencia de teclas (chords). Ex:
 *  - g, d  -> /dashboard
 *  - g, c  -> /campanhas
 *  - n, a  -> /estudio/analisar/nova
 *
 * Ignorado quando foco esta em input/textarea/contenteditable, ou
 * quando o command palette esta aberto.
 */
export function useShellShortcuts() {
  const router = useRouter()
  const paletteOpen = useCommandPaletteStore((s) => s.open)
  const buffer = useRef<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const targets: readonly ChordTarget[] = [
    { keys: ['g', 'd'], run: () => router.push('/dashboard') },
    { keys: ['g', 'c'], run: () => router.push('/campanhas') },
    { keys: ['g', 'p'], run: () => router.push('/produtos') },
    { keys: ['g', 'e'], run: () => router.push('/estudio') },
    { keys: ['g', 'r'], run: () => router.push('/referencias') },
    { keys: ['g', 's'], run: () => router.push('/configuracoes') },
    { keys: ['n', 'a'], run: () => router.push('/estudio/analisar/nova') },
  ]

  useEffect(() => {
    function reset() {
      buffer.current = []
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (paletteOpen) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (shouldIgnoreEvent(e.target)) return

      const key = e.key.toLowerCase()
      if (!/^[a-z]$/.test(key)) {
        reset()
        return
      }

      buffer.current.push(key)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(reset, CHORD_TIMEOUT_MS)

      const bufferStr = buffer.current.join(',')
      const match = targets.find((t) => t.keys.join(',') === bufferStr)
      if (match) {
        e.preventDefault()
        reset()
        match.run()
        return
      }

      const partialMatch = targets.some((t) => t.keys.join(',').startsWith(bufferStr))
      if (!partialMatch) reset()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timer.current) clearTimeout(timer.current)
    }
    // targets contem closures de router que nao mudam; intencionalmente fora das deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, router])
}
