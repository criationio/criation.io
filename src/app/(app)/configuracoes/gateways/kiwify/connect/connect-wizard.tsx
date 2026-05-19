'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { connectKiwify } from '@/lib/actions/gateway-connections'

const REQUIRED_EVENTS = [
  'compra_aprovada',
  'compra_recusada',
  'compra_reembolsada',
  'chargeback',
  'boleto_gerado',
  'pix_gerado',
  'carrinho_abandonado',
  'subscription_canceled',
  'subscription_late',
  'subscription_renewed',
] as const

export function ConnectWizard() {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ webhookUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await connectKiwify({ webhookToken: token })
      if (r.ok) {
        toast.success('Conexão criada')
        setResult({ webhookUrl: r.data.webhookUrl })
      } else {
        setError(r.error.message)
      }
    })
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Estado 1 — instrucoes + form do token Kiwify
  if (!result) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <h2 className="text-base font-medium">1. Crie o webhook no painel Kiwify</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
          <li>
            Abra{' '}
            <a
              href="https://dashboard.kiwify.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              dashboard.kiwify.com.br <ExternalLink className="h-3 w-3" />
            </a>{' '}
            → <span className="font-medium">Apps → Webhooks → Criar Webhook</span>.
          </li>
          <li>
            Nome: &ldquo;Criation&rdquo;. Selecionar produto: &ldquo;Todos os produtos&rdquo;.
          </li>
          <li>
            Em <span className="font-medium">URL para envio de dados</span>: deixe em branco por
            enquanto (vamos preencher no passo 3).
          </li>
          <li>
            Marque os 10 eventos:{' '}
            <code className="font-mono text-xs">{REQUIRED_EVENTS.join(', ')}</code>
          </li>
          <li>
            Salve. A Kiwify vai gerar um <span className="font-medium">Token</span> automaticamente
            (string curta tipo <code className="font-mono">3x27zgg73o3</code>) — copie esse valor.
          </li>
        </ol>

        <h2 className="mt-8 text-base font-medium">2. Cole o token aqui</h2>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          Vamos validar webhooks futuros usando esse token via HMAC-SHA1.
        </p>

        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <div className="grid gap-1">
            <label className="text-label text-[10px]">Token Kiwify</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="Ex: 3x27zgg73o3"
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !token.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Gerar webhook URL
            </button>
          </div>
        </form>
      </section>
    )
  }

  // Estado 2 — URL gerada, instrucoes pra colar de volta na Kiwify
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-[var(--color-success)]" />
        <h2 className="text-base font-medium">3. Cole a URL no webhook que você criou</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Volte ao painel Kiwify, edite o webhook que você acabou de criar e cole esta URL no campo{' '}
        <span className="font-medium">URL para envio de dados</span>.
      </p>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="text-label mb-2 text-[10px]">Webhook URL</div>
        <div className="flex items-center justify-between gap-2">
          <code className="font-mono text-xs break-all text-[var(--color-fg)]">
            {result.webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(result.webhookUrl)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3 text-xs text-[var(--color-info)]">
        <strong>Validamos via HMAC-SHA1.</strong> A URL acima fica limpa (sem secret na query
        string). A Kiwify assina cada webhook com o token que você colou — verificamos a assinatura
        no recebimento. Mais seguro que esquema de token plain.
      </div>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
        <li>
          Volte ao painel Kiwify (
          <a
            href="https://dashboard.kiwify.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            dashboard.kiwify.com.br <ExternalLink className="h-3 w-3" />
          </a>
          ).
        </li>
        <li>Edite o webhook &ldquo;Criation&rdquo; criado no passo 1.</li>
        <li>Cole a URL acima no campo &ldquo;URL para envio de dados&rdquo;.</li>
        <li>Salve.</li>
        <li>Use &ldquo;Testar Webhook&rdquo; pra disparar um evento de teste.</li>
      </ol>

      <div className="mt-6 flex justify-end gap-2">
        <Link
          href="/configuracoes/gateways/kiwify"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Concluído — ver status
        </Link>
      </div>
    </section>
  )
}
