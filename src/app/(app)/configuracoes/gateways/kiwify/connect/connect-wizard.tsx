'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
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

function generateToken(): string {
  // crypto.randomUUID disponivel em browsers modernos + Node 19+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback simples
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function ConnectWizard() {
  const initialToken = useMemo(() => generateToken(), [])
  const [token, setToken] = useState(initialToken)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ webhookUrl: string; token: string } | null>(null)
  const [copiedField, setCopiedField] = useState<'url' | 'token' | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function regenerate() {
    setToken(generateToken())
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await connectKiwify({ webhookToken: token })
      if (r.ok) {
        toast.success('Conexão criada')
        setResult({ webhookUrl: r.data.webhookUrl, token: r.data.token })
      } else {
        setError(r.error.message)
      }
    })
  }

  function copyField(field: 'url' | 'token', value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  // Estado 1 — form com token gerado
  if (!result) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Geramos um token único pra sua conexão. Você vai colar esse mesmo token no campo
          &ldquo;Token&rdquo; do painel Kiwify.
        </p>

        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <div className="grid gap-1">
            <label className="text-label flex items-center justify-between text-[10px]">
              <span>Token (gerado pra você)</span>
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Gerar outro
              </button>
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              spellCheck={false}
              autoComplete="off"
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
            <p className="text-[10px] text-[var(--color-fg-subtle)]">
              Você pode usar esse valor ou colar um próprio. Recomendamos manter o gerado.
            </p>
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] p-3 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
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

  // Estado 2 — sucesso com URL + token + instrucoes
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-[var(--color-success)]" />
        <h2 className="text-base font-medium">Conexão criada</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Falta cadastrar no painel Kiwify. Use a URL e o token abaixo.
      </p>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="text-label mb-2 text-[10px]">Webhook URL (já inclui o token)</div>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-xs break-all text-[var(--color-fg)]">
              {result.webhookUrl}
            </code>
            <button
              type="button"
              onClick={() => copyField('url', result.webhookUrl)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              {copiedField === 'url' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedField === 'url' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="text-label mb-2 text-[10px]">Token (campo separado no painel)</div>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-xs break-all text-[var(--color-fg)]">
              {result.token}
            </code>
            <button
              type="button"
              onClick={() => copyField('token', result.token)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              {copiedField === 'token' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copiedField === 'token' ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
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
          e vai em <span className="font-medium">Apps → Webhooks → Criar Webhook</span>.
        </li>
        <li>Nome: &ldquo;Criation&rdquo; (ou o que preferir).</li>
        <li>
          Selecionar produto: <span className="font-medium">Todos os produtos</span> (ou um
          específico).
        </li>
        <li>
          Cole a <span className="font-medium">Webhook URL</span> no campo de URL e o{' '}
          <span className="font-medium">Token</span> no campo Token.
        </li>
        <li>
          Marque os 10 eventos:
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {REQUIRED_EVENTS.map((ev) => (
              <li key={ev} className="flex items-center gap-1">
                <Check className="h-3 w-3 text-[var(--color-success)]" />
                <code className="font-mono">{ev}</code>
              </li>
            ))}
          </ul>
        </li>
        <li>Salve. Use &ldquo;Testar Webhook&rdquo; pra validar agora.</li>
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
