'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { getAnalysisStatus } from '@/lib/actions/analysis'

const TERMINAL = new Set(['completed', 'failed'])

/**
 * Observa o status da análise enquanto ela roda e atualiza a página sozinha
 * quando termina (Sessão 1.10 — substitui o refresh manual). Renderizado apenas
 * no estado running; quando o status vira completed/failed, faz router.refresh()
 * pra o Server Component re-renderizar com o resultado. Não renderiza UI.
 */
export function RunningWatcher({ analysisId }: { analysisId: string }) {
  const router = useRouter()

  const { data: status } = useQuery({
    queryKey: ['analysis-status', analysisId],
    queryFn: async () => {
      const res = await getAnalysisStatus(analysisId)
      return res.ok ? res.data.status : 'running'
    },
    // Pára o polling assim que chega num estado terminal.
    refetchInterval: (query) => (TERMINAL.has(query.state.data ?? '') ? false : 2500),
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (status && TERMINAL.has(status)) router.refresh()
  }, [status, router])

  return null
}
