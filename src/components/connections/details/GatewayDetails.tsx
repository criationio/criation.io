'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import type { GatewayDetailPayload } from '../types'
import { DetailField, DetailGrid } from './DetailGrid'

const PROVIDER_DESCRIPTIONS: Record<GatewayDetailPayload['provider'], string> = {
  hotmart: 'Postback v2 com HOTTOK + HMAC. Vendas, refunds, chargebacks e assinaturas.',
  kiwify: 'Webhook v1 com HMAC-SHA1 via query signature. Vendas e assinaturas.',
  eduzz: 'Webhook v3 com HMAC-SHA256 no header x-signature. Faturas, contratos e comissões.',
  generic:
    'Webhook canônico via Make / n8n / Zapier. Use para Monetizze, Ticto, Cakto, Greenn e outras plataformas.',
}

export function GatewayDetails({ payload }: { payload: GatewayDetailPayload }) {
  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--color-fg-muted)]">
        {PROVIDER_DESCRIPTIONS[payload.provider]}
      </p>

      {payload.webhookUrl && <WebhookUrlBox url={payload.webhookUrl} />}

      <DetailGrid>
        <DetailField label="Versão webhook" mono>
          {payload.webhookVersion ?? '—'}
        </DetailField>
        <DetailField label="Conectado desde">
          {new Date(payload.createdAt).toLocaleDateString('pt-BR')}
        </DetailField>
        <DetailField label="Último evento recebido">
          {payload.lastWebhookEventAt
            ? new Date(payload.lastWebhookEventAt).toLocaleString('pt-BR')
            : 'Nenhum ainda'}
        </DetailField>
        <DetailField label="Falhas (24h)">
          <span
            className={
              payload.webhookFailures24h > 0
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-fg)]'
            }
          >
            {payload.webhookFailures24h}
          </span>
        </DetailField>
        {payload.lastWebhookEventId && (
          <DetailField label="ID último evento" mono>
            <span className="break-all">{payload.lastWebhookEventId}</span>
          </DetailField>
        )}
      </DetailGrid>
    </div>
  )
}

function WebhookUrlBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        Webhook URL
      </p>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
        <code className="flex-1 truncate font-mono text-[11px] text-[var(--color-fg)]">{url}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-[10px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
