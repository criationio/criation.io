'use client'

import { useCallback, useState } from 'react'

const COOKIE_NAME = 'sidebar_collapsed'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function writeCookie(collapsed: boolean) {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=${collapsed ? '1' : '0'}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`
}

/**
 * Estado inicial vem do server via cookie (lido no layout). Toggle escreve
 * de volta no cookie para sobreviver entre navegacoes.
 */
export function useSidebarCollapse(initial = false) {
  const [collapsed, setCollapsed] = useState(initial)

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      writeCookie(next)
      return next
    })
  }, [])

  return { collapsed, toggle }
}
