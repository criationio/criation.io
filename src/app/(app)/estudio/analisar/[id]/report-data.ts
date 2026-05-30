/**
 * Forma serializável do relatório passada do Server Component pro DownloadMenu
 * e pros builders de PDF/DOCX (carregados sob demanda). Tudo já formatado em
 * string pra os builders só diagramarem.
 */
export interface ReportData {
  title: string
  generatedAt: string
  verdict: string
  score: number
  summary: string
  bottleneck: { stage: string; explanation: string; severity: string }
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  /** Métricas do funil do snapshot (label → valor formatado). Vazio se ausente. */
  funnel: Array<{ label: string; value: string }>
  campaignName: string | null
  copyText: string | null
}
