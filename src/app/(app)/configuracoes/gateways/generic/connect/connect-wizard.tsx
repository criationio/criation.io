'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { connectGeneric } from '@/lib/actions/gateway-connections'

const COMMON_PROVIDERS = [
  'Monetizze',
  'Ticto',
  'Cakto',
  'Greenn',
  'Yampi',
  'Perfect Pay',
  'Braip',
  'Lastlink',
  'Disrupty',
  'Outro',
] as const

const SAMPLE_PAYLOAD = `{
  "event_type": "PURCHASE_APPROVED",
  "provider_event_id": "<id-da-venda-original>",
  "occurred_at": "2026-05-10T12:00:00Z",
  "amount_cents": 4990,
  "currency": "BRL",
  "product_id": "prod-uuid",
  "product_name": "Curso X",
  "payment_method": "CREDIT_CARD",
  "installments": 12,
  "subscriber_code": "<id-da-subscription-se-houver>",
  "buyer": {
    "email": "comprador@email.com",
    "phone": "+5511987654321",
    "document": "12345678910",
    "country": "BR"
  },
  "tracking": {
    "external_code": "<visitor_id>",
    "utm_source": "facebook",
    "utm_campaign": "lancamento",
    "fbclid": "<fbclid>"
  }
}`

function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function ConnectWizard() {
  const initialToken = useMemo(() => generateToken(), [])
  const [token, setToken] = useState(initialToken)
  const [sourceProvider, setSourceProvider] = useState<string>('Monetizze')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    webhookUrl: string
    token: string
    sourceProvider?: string
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await connectGeneric({
        webhookToken: token,
        sourceProvider: sourceProvider === 'Outro' ? undefined : sourceProvider,
      })
      if (r.ok) {
        toast.success('Conexão criada')
        setResult(r.data)
      } else {
        setError(r.error.message)
      }
    })
  }

  function copy(field: string, value: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  if (!result) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Selecione a plataforma de origem e geramos URL+token. Você cria um flow Make/n8n que
          escuta seu gateway, transforma os dados pro nosso shape canônico, e envia pra URL.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <div className="grid gap-1">
            <label className="text-label text-[10px]">Plataforma de origem</label>
            <select
              value={sourceProvider}
              onChange={(e) => setSourceProvider(e.target.value)}
              className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]"
            >
              {COMMON_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-label text-[10px]">Token (gerado pra você)</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
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
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Gerar URL e token
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
        <h2 className="text-base font-medium">Conexão criada</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Configure no Make/n8n: trigger no seu gateway → transform pro shape abaixo → POST pra esta
        URL com header de autenticação.
      </p>

      <div className="mt-4 grid gap-3">
        <Field
          label="Webhook URL"
          value={result.webhookUrl}
          field="url"
          copy={copy}
          copied={copiedField === 'url'}
        />
        <Field
          label="Header x-criation-token"
          value={result.token}
          field="token"
          copy={copy}
          copied={copiedField === 'token'}
        />
      </div>

      <details className="mt-6 text-xs text-[var(--color-fg-muted)]" open>
        <summary className="cursor-pointer font-medium">
          Schema do payload (cole no Make/n8n)
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-[10px] text-[var(--color-fg)]">
          {SAMPLE_PAYLOAD}
        </pre>
        <button
          type="button"
          onClick={() => copy('sample', SAMPLE_PAYLOAD)}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          {copiedField === 'sample' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiedField === 'sample' ? 'Copiado' : 'Copiar shape'}
        </button>
      </details>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3 text-xs text-[var(--color-info)]">
        <strong>Dica:</strong> use <code className="font-mono">event_type</code> nos valores
        canônicos: <code>PURCHASE_APPROVED</code>, <code>PURCHASE_REFUNDED</code>,{' '}
        <code>PURCHASE_CHARGEBACK</code>, <code>SUBSCRIPTION_CANCELLATION</code>,{' '}
        <code>SUBSCRIPTION_RENEWED</code>, <code>SUBSCRIPTION_LATE</code>,{' '}
        <code>PIX_GENERATED</code>, <code>PURCHASE_BILLET_PRINTED</code>,{' '}
        <code>PURCHASE_OUT_OF_SHOPPING_CART</code>.
      </div>

      <div className="mt-6 flex justify-end">
        <Link
          href="/configuracoes/gateways/generic"
          onClick={() => router.refresh()}
          className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Concluído — ver status
        </Link>
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  field,
  copy,
  copied,
}: {
  label: string
  value: string
  field: string
  copy: (field: string, value: string) => void
  copied: boolean
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="text-label mb-2 text-[10px]">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <code className="font-mono text-xs break-all text-[var(--color-fg)]">{value}</code>
        <button
          type="button"
          onClick={() => copy(field, value)}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
