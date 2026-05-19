import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'

interface MetaConnectPageProps {
  searchParams: Promise<{
    status?: string
    reason?: string
    returnTo?: string
  }>
}

const REASON_LABELS: Record<string, string> = {
  expired_state: 'O link de conexão expirou. Tente novamente.',
  missing_params: 'Resposta inválida do Meta. Tente novamente.',
  internal: 'Algo inesperado aconteceu. Tente novamente em instantes.',
}

function reasonLabel(reason: string | undefined): string {
  if (!reason) return 'Algo deu errado. Tente novamente.'
  if (REASON_LABELS[reason]) return REASON_LABELS[reason]!
  if (reason.startsWith('meta:'))
    return `O Meta retornou um erro (código ${reason.slice(5)}). Tente novamente.`
  return reason
}

export default async function MetaConnectPage({ searchParams }: MetaConnectPageProps) {
  const sp = await searchParams
  const status = sp.status
  const startUrl = `/api/oauth/meta/start${sp.returnTo ? `?returnTo=${encodeURIComponent(sp.returnTo)}` : ''}`

  return (
    <div>
      <span className="text-label text-[10px]">Passo 1 de 3</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Conecte sua conta Meta Ads</h1>
      <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
        Vamos abrir o login do Facebook para você autorizar a Criation a ler suas campanhas e enviar
        conversões via Conversions API.
      </p>

      {status === 'denied' && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          Você cancelou a autorização no Facebook. Sem essa conexão, não conseguimos sincronizar
          campanhas.
        </div>
      )}

      {(status === 'invalid' || status === 'failed') && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {reasonLabel(sp.reason)}
        </div>
      )}

      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
        <div className="text-label text-[10px]">O que vamos pedir de acesso</div>
        <ul className="mt-3 space-y-2 text-sm text-[var(--color-fg-muted)]">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <span>
              <strong className="font-medium text-[var(--color-fg)]">Leitura de anúncios</strong> —
              campanhas, conjuntos, criativos e métricas históricas
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <span>
              <strong className="font-medium text-[var(--color-fg)]">
                Gerenciamento de anúncios
              </strong>{' '}
              — necessário para enviar conversões via API
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
            <span>
              <strong className="font-medium text-[var(--color-fg)]">Business Manager</strong> —
              para ler suas contas de anúncio e pixel
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-[var(--color-fg-subtle)]">
          Token criptografado em AES-256-GCM no banco. Nunca armazenamos sua senha. Você pode
          desconectar a qualquer momento em Configurações → Conexões.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <a
          href={startUrl}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
        >
          Conectar com Facebook
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <div className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
        Já conectou e voltou aqui?{' '}
        <Link href="/configuracoes/conexoes" className="text-[var(--color-accent)] hover:underline">
          Ver suas conexões
        </Link>
      </div>
    </div>
  )
}
