'use client'

import { useEffect, useState } from 'react'

/**
 * Revela `text` progressivamente (efeito máquina de escrever, Sessão 1.10).
 * O texto já está completo no cliente — é só uma animação de entrada que dá
 * sensação de "resultado chegando". Respeita prefers-reduced-motion (mostra
 * tudo de imediato). Para resetar quando o texto muda, passe `key={text}` no
 * ponto de uso (remonta o componente → count volta a 0).
 */
export function Typewriter({
  text,
  speedMs = 12,
  charsPerTick = 2,
  className,
}: {
  text: string
  speedMs?: number
  charsPerTick?: number
  className?: string
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!text) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      const t = setTimeout(() => setCount(text.length), 0)
      return () => clearTimeout(t)
    }
    const id = setInterval(() => {
      setCount((prev) => {
        const next = prev + charsPerTick
        if (next >= text.length) {
          clearInterval(id)
          return text.length
        }
        return next
      })
    }, speedMs)
    return () => clearInterval(id)
  }, [text, speedMs, charsPerTick])

  return <span className={className}>{text.slice(0, count)}</span>
}
