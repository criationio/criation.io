import { redirect } from 'next/navigation'

import { getUser } from '@/lib/supabase/server'
import { env } from '@/env'

import { ScriptSnippet } from './script-snippet'

export default async function TrackingScriptPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const baseUrl = (env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const scriptUrl = `${baseUrl}/criation-tracking.js`
  const snippet = `<script async src="${scriptUrl}"></script>`

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Script de rastreamento</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Cole este script no <code className="font-mono">&lt;head&gt;</code> das páginas que
          recebem tráfego pago (landing pages, blog, qualquer página que linke pra checkout). Ele
          captura UTMs, persiste por 90 dias em cookie first-party e enriquece automaticamente os
          links de checkout pra preservar atribuição.
        </p>
      </header>

      <section className="space-y-8">
        <div>
          <h2 className="mb-3 text-base font-medium">1. Snippet</h2>
          <ScriptSnippet snippet={snippet} />
        </div>

        <div>
          <h2 className="mb-3 text-base font-medium">2. O que ele faz</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
            <li>
              Captura UTMs (
              <code className="font-mono">utm_source/medium/campaign/content/term</code> + click IDs{' '}
              <code className="font-mono">fbclid/gclid/ttclid/msclkid</code>) da URL atual e do{' '}
              <code className="font-mono">document.referrer</code>.
            </li>
            <li>
              Persiste em cookie first-party <code className="font-mono">_cio_utms</code> por 90
              dias — usuário que volta sem UTM mantém atribuição original.
            </li>
            <li>
              Enriquece automaticamente links que apontam pra Hotmart, Kiwify, Eduzz, Monetizze,
              Ticto, Cakto, Greenn e Yampi. Outros links permanecem intocados.
            </li>
            <li>
              Suporta SPAs (React/Next/Vue) — re-aplica enrichment quando rota muda via{' '}
              <code className="font-mono">pushState</code>.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-base font-medium">3. Checkout custom</h2>
          <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
            Se você usa checkout próprio fora dos domínios conhecidos, adicione o atributo{' '}
            <code className="font-mono">data-criation-checkout</code> nos links pra forçar
            enrichment:
          </p>
          <pre className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 font-mono text-xs">
            {`<a href="https://meucheckout.com.br/produto" data-criation-checkout>
  Comprar agora
</a>`}
          </pre>
        </div>

        <div>
          <h2 className="mb-3 text-base font-medium">4. Verificar funcionamento</h2>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Abra a página com UTMs (ex:{' '}
            <code className="font-mono">?utm_source=meta&amp;utm_campaign=teste</code>), abra
            DevTools → Console e digite <code className="font-mono">__cioTracking.getUtms()</code>.
            Deve retornar o objeto com as UTMs capturadas. Inspecione um link de checkout — a URL
            deve incluir os parâmetros UTM injetados.
          </p>
        </div>
      </section>
    </main>
  )
}
