import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/product/MetricCard'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-8 pt-24 pb-16 text-center">
        <div className="text-label mb-4 inline-block">criation.io</div>
        <h1 className="mb-4 text-4xl font-semibold tracking-tight">
          Inteligência de marketing
          <br />
          com IA para infoprodutores
        </h1>
        <p className="text-md mx-auto mb-8 max-w-2xl text-[var(--color-fg-muted)]">
          Descubra gargalos no seu funil, otimize criativos e escale suas vendas com diagnóstico
          automático e copy gerado por IA.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg">Começar agora</Button>
          <Button size="lg" variant="secondary">
            Ver demonstração
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-8 py-16">
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Detecção de gargalos" value="4" unit="tipos" delta={{ value: 0 }} />
          <MetricCard label="Análises com IA" value="124" unit="/mês" delta={{ value: 18.2 }} />
          <MetricCard label="Tempo economizado" value="32" unit="h/mês" delta={{ value: 24.1 }} />
        </div>
      </section>
    </div>
  )
}
