'use client'

import { useState } from 'react'
import { Download, FileJson, FileText, FileType, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { ReportData } from './report-data'

/**
 * Botão "Baixar" com seleção de formato (Sessão 1.11.1): JSON / PDF / DOCX.
 * JSON é o result_data cru; PDF/DOCX são o relatório legível. As libs de
 * PDF (@react-pdf/renderer) e DOCX (docx) são carregadas sob demanda (dynamic
 * import) — não pesam o carregamento da página.
 */
export function DownloadMenu({
  report,
  rawJson,
  fileBase,
}: {
  report: ReportData
  rawJson: unknown
  fileBase: string
}) {
  const [busy, setBusy] = useState<null | 'json' | 'pdf' | 'docx'>(null)

  function triggerDownload(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadJson() {
    setBusy('json')
    try {
      triggerDownload(
        new Blob([JSON.stringify(rawJson, null, 2)], { type: 'application/json' }),
        'json'
      )
    } finally {
      setBusy(null)
    }
  }

  async function downloadPdf() {
    setBusy('pdf')
    try {
      const { buildAnalysisPdf } = await import('./report-pdf')
      triggerDownload(await buildAnalysisPdf(report), 'pdf')
    } finally {
      setBusy(null)
    }
  }

  async function downloadDocx() {
    setBusy('docx')
    try {
      const { buildAnalysisDocx } = await import('./report-docx')
      triggerDownload(await buildAnalysisDocx(report), 'docx')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" disabled={busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={downloadPdf}>
          <FileType className="h-4 w-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadDocx}>
          <FileText className="h-4 w-4" /> Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadJson}>
          <FileJson className="h-4 w-4" /> JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
