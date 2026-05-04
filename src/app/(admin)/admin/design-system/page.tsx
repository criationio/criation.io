'use client'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'

import { BottleneckBadge } from '@/components/product/BottleneckBadge'
import { SignalDot } from '@/components/product/SignalDot'
import { EmptyState } from '@/components/product/EmptyState'
import { MetricCard } from '@/components/product/MetricCard'
import { FunnelPyramid } from '@/components/product/FunnelPyramid'
import { SplashLogo } from '@/components/product/SplashLogo'
import { PageHeader } from '@/components/product/PageHeader'

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <PageHeader
        title="Design System"
        description="Referência viva de tokens, componentes e padrões do Criation.io"
        actions={
          <Button variant="secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '→ Light Mode' : '→ Dark Mode'}
          </Button>
        }
      />

      {/* 1. CORES */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Cores</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          Tokens semânticos. Use estas variáveis em todos os componentes.
        </p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { name: 'bg', var: '--color-bg' },
            { name: 'bg-elevated', var: '--color-bg-elevated' },
            { name: 'fg', var: '--color-fg' },
            { name: 'fg-muted', var: '--color-fg-muted' },
            { name: 'accent', var: '--color-accent' },
            { name: 'success', var: '--color-success' },
            { name: 'warning', var: '--color-warning' },
            { name: 'danger', var: '--color-danger' },
          ].map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-3"
            >
              <div
                className="h-10 w-10 rounded-md border border-[var(--color-border)]"
                style={{ background: `var(${c.var})` }}
              />
              <div>
                <div className="text-xs font-medium">{c.name}</div>
                <div className="text-2xs font-mono text-[var(--color-fg-muted)]">{c.var}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. TIPOGRAFIA */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Tipografia</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">Geist Sans + Geist Mono</p>
        <div className="space-y-3">
          <div className="text-4xl font-semibold tracking-tight">Inteligência de marketing</div>
          <div className="text-3xl font-semibold tracking-tight">Inteligência de marketing</div>
          <div className="text-2xl font-semibold tracking-tight">Inteligência de marketing</div>
          <div className="text-xl font-semibold">Inteligência de marketing</div>
          <div className="text-lg">Inteligência de marketing</div>
          <div className="text-md">Inteligência de marketing — body padrão</div>
          <div className="text-base">Inteligência de marketing — texto corrido</div>
          <div className="text-sm text-[var(--color-fg-muted)]">Texto secundário em SM</div>
          <div className="text-xs text-[var(--color-fg-muted)]">Caption em XS</div>
          <div className="font-mono text-sm">font-mono — R$ 1.234,56</div>
          <div className="font-tabular text-md">123,456,789.00 (tabular)</div>
        </div>
      </section>

      {/* 3. BUTTONS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Buttons</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">5 variantes × 4 tamanhos</p>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>
      </section>

      {/* 4. BADGES */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Badges</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          Funcionais + bottleneck (cores sagradas)
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <BottleneckBadge type="creative" />
            <BottleneckBadge type="page" />
            <BottleneckBadge type="audience" />
            <BottleneckBadge type="offer" />
          </div>
        </div>
      </section>

      {/* 5. SIGNAL DOTS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Signal Dots</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">Status de saúde / sincronização</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <SignalDot status="green" /> <span className="text-sm">Saudável</span>
          </div>
          <div className="flex items-center gap-2">
            <SignalDot status="amber" /> <span className="text-sm">Atenção</span>
          </div>
          <div className="flex items-center gap-2">
            <SignalDot status="red" /> <span className="text-sm">Crítico</span>
          </div>
          <div className="flex items-center gap-2">
            <SignalDot status="green" pulse /> <span className="text-sm">Sincronizando</span>
          </div>
        </div>
      </section>

      {/* 6. METRIC CARDS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Metric Cards</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">
          Cards de métrica com tabular numerals
        </p>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Receita Total"
            value="124.580"
            unit="R$"
            delta={{ value: 12.5, label: 'vs período anterior' }}
            sparkline={[10, 15, 13, 18, 22, 19, 25, 28, 24, 30, 35, 32, 38, 42]}
          />
          <MetricCard
            label="ROAS Real"
            value="3.42"
            unit="x"
            delta={{ value: -8.2, label: 'vs anterior' }}
            sparkline={[4, 4.2, 3.8, 3.5, 3.6, 3.4, 3.42]}
          />
          <MetricCard
            label="Vendas"
            value="2.847"
            delta={{ value: 24.1 }}
            sparkline={[100, 120, 140, 160, 180, 220, 280]}
          />
          <MetricCard label="CPA" value="42,30" unit="R$" delta={{ value: -3.2 }} />
        </div>
      </section>

      {/* 7. FUNNEL PYRAMID */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Funnel Pyramid</h2>
        <p className="mb-6 text-sm text-[var(--color-fg-muted)]">8 etapas em gradiente violeta</p>
        <FunnelPyramid
          stages={[
            { id: '1', label: 'Investimento', value: 50000 },
            { id: '2', label: 'Impressões', value: 1250000 },
            { id: '3', label: 'Cliques', value: 28500, conversionFromPrevious: 2.28 },
            { id: '4', label: 'Page Views', value: 24800, conversionFromPrevious: 87.0 },
            {
              id: '5',
              label: 'Initiated Checkouts',
              value: 4200,
              conversionFromPrevious: 16.9,
              bottleneckType: 'page',
            },
            { id: '6', label: 'Compras', value: 2847, conversionFromPrevious: 67.8 },
            { id: '7', label: 'Receita Bruta', value: 124580, conversionFromPrevious: 100 },
            { id: '8', label: 'Receita Líquida', value: 98750, conversionFromPrevious: 79.3 },
          ]}
        />
      </section>

      {/* 8. INPUTS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Inputs</h2>
        <div className="grid max-w-2xl grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" placeholder="seu@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dis">Disabled</Label>
            <Input id="dis" placeholder="Desabilitado" disabled />
          </div>
        </div>
      </section>

      {/* 9. CARDS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Cards</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <h3 className="mb-1 font-semibold">Card simples</h3>
            <p className="text-sm text-[var(--color-fg-muted)]">Conteúdo do card.</p>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Com header</h3>
              <SignalDot status="green" />
            </div>
            <p className="text-sm text-[var(--color-fg-muted)]">Status saudável.</p>
          </Card>
          <Card>
            <h3 className="mb-3 font-semibold">Com action</h3>
            <Button size="sm" variant="secondary">
              Ver mais
            </Button>
          </Card>
        </div>
      </section>

      {/* 10. TABS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Tabs</h2>
        <Tabs defaultValue="overview" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funis">Funis</TabsTrigger>
            <TabsTrigger value="utms">UTMs</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4 text-sm">
            Conteúdo da overview.
          </TabsContent>
          <TabsContent value="funis" className="mt-4 text-sm">
            Conteúdo dos funis.
          </TabsContent>
          <TabsContent value="utms" className="mt-4 text-sm">
            Conteúdo das UTMs.
          </TabsContent>
        </Tabs>
      </section>

      {/* 11. PROGRESS & SKELETON */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Loading & Progress</h2>
        <div className="max-w-md space-y-4">
          <Progress value={68} />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex items-center gap-3">
            <SplashLogo size={48} />
            <span className="text-sm text-[var(--color-fg-muted)]">Carregando dados...</span>
          </div>
        </div>
      </section>

      {/* 12. EMPTY STATES */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Empty States</h2>
        <div className="rounded-xl border border-[var(--color-border)]">
          <EmptyState
            icon={Plug}
            title="Conecte sua conta de anúncios"
            description="Para começar a analisar seus criativos, conecte uma conta do Meta Ads ou Google Ads."
            cta={{ label: 'Conectar Meta Ads', onClick: () => {} }}
          />
        </div>
      </section>

      {/* 13. METRIC CARDS LOADING */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Loading States</h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="" value="" loading />
          <MetricCard label="" value="" loading />
          <MetricCard label="" value="" loading />
          <MetricCard label="" value="" loading />
        </div>
      </section>

      {/* 14. ANIMATIONS */}
      <section className="mb-16">
        <h2 className="mb-1 text-lg font-semibold">Animations</h2>
        <AnimationDemo />
      </section>
    </div>
  )
}

function AnimationDemo() {
  const [key, setKey] = useState(0)
  return (
    <div className="space-y-4">
      <Button variant="secondary" onClick={() => setKey((k) => k + 1)}>
        Reproduzir animações
      </Button>
      <div key={key} className="grid grid-cols-3 gap-4">
        <Card className="animate-fade-in">fade-in</Card>
        <Card className="animate-slide-up">slide-up</Card>
        <Card className="animate-scale-in">scale-in</Card>
      </div>
    </div>
  )
}
