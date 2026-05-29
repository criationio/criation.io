'use client'

import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Baixa o resultado da análise como JSON (Sessão 1.11). Export PDF fica pra
 * Fase 2. Client-only (cria Blob + dispara download).
 */
export function ExportJsonButton({ data, fileName }: { data: unknown; fileName: string }) {
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="ghost" size="sm" onClick={download} className="gap-1.5">
      <Download className="h-4 w-4" /> Exportar JSON
    </Button>
  )
}
