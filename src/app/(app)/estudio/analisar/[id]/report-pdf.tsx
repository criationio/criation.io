import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'

import type { ReportData } from './report-data'

/**
 * Builder do PDF do relatório (Sessão 1.11.1 — export multi-formato). Carregado
 * sob demanda (dynamic import) pelo DownloadMenu. Fontes padrão do @react-pdf
 * (Helvetica) cobrem acentos pt-BR (WinAnsi). Sem emojis (regra do produto).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1a1a1a', lineHeight: 1.5 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 9, color: '#777', marginBottom: 14 },
  badgeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  badge: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 4 },
  p: { marginBottom: 4 },
  li: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 12 },
  liText: { flex: 1 },
  row: { flexDirection: 'row', borderBottom: '1px solid #eee', paddingVertical: 3 },
  cellLabel: { width: '50%', color: '#555' },
  cellValue: { width: '50%', fontFamily: 'Helvetica-Bold' },
  copy: { marginTop: 6, color: '#444', fontStyle: 'italic' },
})

function List({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <View style={styles.li} key={i}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.liText}>{it}</Text>
        </View>
      ))}
    </View>
  )
}

function ReportDoc({ r }: { r: ReportData }) {
  return (
    <Document title={r.title}>
      <Page style={styles.page} wrap>
        <Text style={styles.title}>{r.title}</Text>
        <Text style={styles.meta}>Análise de criativo · Quick · {r.generatedAt}</Text>

        <View style={styles.badgeRow}>
          <Text style={styles.badge}>Veredito: {r.verdict}</Text>
          <Text style={styles.badge}>Score: {r.score}/100</Text>
          <Text style={styles.badge}>
            Gargalo: {r.bottleneck.stage} ({r.bottleneck.severity})
          </Text>
        </View>

        <Text style={styles.h2}>Resumo estratégico</Text>
        <Text style={styles.p}>{r.summary}</Text>

        <Text style={styles.h2}>Maior gargalo · {r.bottleneck.stage}</Text>
        <Text style={styles.p}>{r.bottleneck.explanation}</Text>

        {r.strengths.length > 0 && (
          <>
            <Text style={styles.h2}>Pontos fortes</Text>
            <List items={r.strengths} />
          </>
        )}

        {r.weaknesses.length > 0 && (
          <>
            <Text style={styles.h2}>Pontos fracos</Text>
            <List items={r.weaknesses} />
          </>
        )}

        {r.recommendations.length > 0 && (
          <>
            <Text style={styles.h2}>Sugestões priorizadas</Text>
            <List items={r.recommendations.map((rec, i) => `P${Math.min(i + 1, 3)}: ${rec}`)} />
          </>
        )}

        {r.funnel.length > 0 && (
          <>
            <Text style={styles.h2}>Dados que a IA analisou</Text>
            {r.campaignName && <Text style={styles.meta}>{r.campaignName}</Text>}
            {r.funnel.map((row) => (
              <View style={styles.row} key={row.label}>
                <Text style={styles.cellLabel}>{row.label}</Text>
                <Text style={styles.cellValue}>{row.value}</Text>
              </View>
            ))}
            {r.copyText && <Text style={styles.copy}>{r.copyText}</Text>}
          </>
        )}
      </Page>
    </Document>
  )
}

export async function buildAnalysisPdf(r: ReportData): Promise<Blob> {
  return pdf(<ReportDoc r={r} />).toBlob()
}
