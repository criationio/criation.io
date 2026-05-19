'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { connectEduzz } from '@/lib/actions/gateway-connections'

const REQUIRED_EVENTS = [
  'myeduzz.invoice_paid',
  'myeduzz.invoice_refused',
  'myeduzz.invoice_refunded',
  'myeduzz.invoice_canceled',
  'myeduzz.invoice_expired',
  'myeduzz.invoice_overdue',
  'myeduzz.invoice_waiting_payment',
  'myeduzz.invoice_waiting_refund',
  'myeduzz.contract_created',
  'myeduzz.contract_updated',
  'myeduzz.contract_card_attempted',
] as const

export function ConnectWizard() {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ webhookUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await connectEduzz({ webhookKey: key })
      if (r.ok) {
        toast.success('Eduzz conectado')
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

  if (!result) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <h2 className="text-base font-medium">1. Crie webhook no painel Eduzz</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
          <li>
            Abra{' '}
            <a
              href="https://integrations.eduzz.com/webhook/configs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              integrations.eduzz.com/webhook/configs <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>
            Clique em <span className="font-medium">+ Nova configuração</span>. Nome:
            &ldquo;Criation&rdquo;.
          </li>
          <li>
            <span className="font-medium">Chave de acesso</span>: gere uma nova ou use uma
            existente. Copie o valor da chave.
          </li>
          <li>
            <span className="font-medium">URL de envio</span>: deixe em branco por enquanto
            (preencha no passo 3).
          </li>
          <li>
            Marque os eventos:{' '}
            <code className="font-mono text-xs">
              myeduzz.invoice_*, myeduzz.contract_*, myeduzz.commission_processed
            </code>{' '}
            (todos do MyEduzz). Opcional: <code className="font-mono text-xs">sun.cart_*</code>.
          </li>
          <li>Salve.</li>
        </ol>

        <h2 className="mt-8 text-base font-medium">2. Cole a chave aqui</h2>
        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <div className="grid gap-1">
            <label className="text-label text-[10px]">Webhook signing key</label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              spellCheck={false}
              autoComplete="off"
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
              disabled={isPending || !key.trim()}
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

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-[var(--color-success)]" />
        <h2 className="text-base font-medium">3. Cole a URL no webhook que você criou</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Volte ao painel Eduzz, edite o webhook e cole esta URL no campo{' '}
        <span className="font-medium">URL de envio</span>.
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
        <strong>Validamos via HMAC-SHA256.</strong> Eduzz assina cada webhook com a key que você
        colou — verificamos no recebimento. Padrão de mercado.
      </div>

      <details className="mt-4 text-xs text-[var(--color-fg-muted)]">
        <summary className="cursor-pointer">Eventos suportados ({REQUIRED_EVENTS.length})</summary>
        <ul className="mt-2 grid grid-cols-2 gap-1">
          {REQUIRED_EVENTS.map((ev) => (
            <li key={ev} className="flex items-center gap-1">
              <Check className="h-3 w-3 text-[var(--color-success)]" />
              <code className="font-mono">{ev}</code>
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-6 flex justify-end">
        <Link
          href="/configuracoes/gateways/eduzz"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Concluído — ver status
        </Link>
      </div>
    </section>
  )
}
