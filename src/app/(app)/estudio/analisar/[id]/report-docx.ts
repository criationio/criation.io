import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

import type { ReportData } from './report-data'

/**
 * Builder do DOCX do relatório (Sessão 1.11.1 — export multi-formato). Carregado
 * sob demanda pelo DownloadMenu. A lib `docx` gera o .docx programaticamente
 * (sem browser), com suporte nativo a acentos pt-BR.
 */

function bullets(items: string[]): Paragraph[] {
  return items.map(
    (it) => new Paragraph({ text: it, bullet: { level: 0 }, spacing: { after: 60 } })
  )
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
  })
}

export async function buildAnalysisDocx(r: ReportData): Promise<Blob> {
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: r.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({ text: `Análise de criativo · Quick · ${r.generatedAt}`, color: '777777' }),
      ],
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Veredito: ${r.verdict}   `, bold: true }),
        new TextRun({ text: `Score: ${r.score}/100   `, bold: true }),
        new TextRun({
          text: `Gargalo: ${r.bottleneck.stage} (${r.bottleneck.severity})`,
          bold: true,
        }),
      ],
      spacing: { after: 160 },
    }),

    heading('Resumo estratégico'),
    new Paragraph(r.summary),

    heading(`Maior gargalo · ${r.bottleneck.stage}`),
    new Paragraph(r.bottleneck.explanation),
  ]

  if (r.strengths.length > 0) {
    children.push(heading('Pontos fortes'), ...bullets(r.strengths))
  }
  if (r.weaknesses.length > 0) {
    children.push(heading('Pontos fracos'), ...bullets(r.weaknesses))
  }
  if (r.recommendations.length > 0) {
    children.push(
      heading('Sugestões priorizadas'),
      ...bullets(r.recommendations.map((rec, i) => `P${Math.min(i + 1, 3)}: ${rec}`))
    )
  }
  if (r.funnel.length > 0) {
    children.push(heading('Dados que a IA analisou'))
    if (r.campaignName) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: r.campaignName, color: '777777' })],
          spacing: { after: 80 },
        })
      )
    }
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: r.funnel.map(
          (row) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph(row.label)],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [
                    new Paragraph({ children: [new TextRun({ text: row.value, bold: true })] }),
                  ],
                  width: { size: 50, type: WidthType.PERCENTAGE },
                }),
              ],
            })
        ),
      })
    )
    if (r.copyText) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: r.copyText, italics: true, color: '444444' })],
          spacing: { before: 120 },
          alignment: AlignmentType.LEFT,
        })
      )
    }
  }

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBlob(doc)
}
