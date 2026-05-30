'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Provider único do TanStack Query (server state + cache). Primeira adoção real
 * (Sessão 1.10 — polling de status de análise). QueryClient criado uma vez por
 * mount via useState pra não recriar a cada render.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
