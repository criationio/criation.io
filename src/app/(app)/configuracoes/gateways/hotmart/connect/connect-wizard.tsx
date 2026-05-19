'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { connectHotmart } from '@/lib/actions/gateway-connections'

const REQUIRED_EVENTS = [
  'PURCHASE_APPROVED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'PURCHASE_BILLET_PRINTED',
  'PURCHASE_DELAYED',
  'PURCHASE_EXPIRED',
  'PURCHASE_OUT_OF_SHOPPING_CART',
  'SUBSCRIPTION_CANCELLATION',
] as const

export function ConnectWizard() {
  const [hottok, setHottok] = useState('')
  const [sandbox, setSandbox] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await connectHotmart({ hottok, sandbox })
      if (result.ok) {
        toast.success('Conexão criada')
        setWebhookUrl(result.data.webhookUrl)
      } else {
        setError(result.error.message)
      }
    })
  }

  function copy() {
    if (!webhookUrl) return
    void navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Estado 1 — form
  if (!webhookUrl) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Cole seu HOTTOK abaixo. Você encontra em{' '}
          <a
            href="https://app-postback.hotmart.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            app-postback.hotmart.com <ExternalLink className="h-3 w-3" />
          </a>{' '}
          (menu da conta → Token de segurança).
        </p>

        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <div className="grid gap-1">
            <label className="text-label text-[10px]">HOTTOK</label>
            <input
              type="password"
              value={hottok}
              onChange={(e) => setHottok(e.target.value)}
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="Cole o HOTTOK aqui"
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 font-mono text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)]">
            <input
              type="checkbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
              className="h-3 w-3"
            />
            Esta conta é Sandbox (teste)
          </label>

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

  // Estado 2 — sucesso com URL + instrucoes
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-[var(--color-success)]" />
        <h2 className="text-base font-medium">Conexão criada</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Falta um passo: registrar a URL abaixo no painel da Hotmart. O primeiro evento que chegar
        confirma que está tudo certo.
      </p>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="text-label mb-2 text-[10px]">Webhook URL</div>
        <div className="flex items-center justify-between gap-2">
          <code className="font-mono text-xs break-all text-[var(--color-fg)]">{webhookUrl}</code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[var(--color-fg-muted)]">
        <li>
          Abra{' '}
          <a
            href="https://app-postback.hotmart.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
          >
            app-postback.hotmart.com <ExternalLink className="h-3 w-3" />
          </a>
        </li>
        <li>
          Clique em <span className="font-medium">+ Cadastrar URL</span> e cole a URL acima em{' '}
          <span className="font-medium">URL de envio</span>.
        </li>
        <li>
          Marque os eventos abaixo:
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {REQUIRED_EVENTS.map((ev) => (
              <li key={ev} className="flex items-center gap-1">
                <Check className="h-3 w-3 text-[var(--color-success)]" />
                <code className="font-mono">{ev}</code>
              </li>
            ))}
          </ul>
        </li>
        <li>Selecione &ldquo;todos os produtos&rdquo; (ou os produtos específicos).</li>
        <li>Salve. Hotmart manda um ping de teste em alguns segundos.</li>
      </ol>

      <div className="mt-6 flex justify-end gap-2">
        <Link
          href="/configuracoes/gateways/hotmart"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Concluído — ver status
        </Link>
      </div>
    </section>
  )
}
