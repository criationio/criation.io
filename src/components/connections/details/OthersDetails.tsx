export function OthersDetails() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-fg-muted)]">
        CRM (HubSpot, RD Station), email marketing (Mailchimp, Brevo), analytics (PostHog, Mixpanel)
        e helpdesk (Zendesk, Intercom) chegam em sessões futuras do roadmap.
      </p>
      <p className="text-xs text-[var(--color-fg-subtle)]">
        Estrutura de dados já preparada: a tabela{' '}
        <code className="rounded bg-[var(--color-bg-muted)] px-1 font-mono text-[var(--color-fg)]">
          connections
        </code>{' '}
        aceita qualquer tipo de integração via discriminador (ADR-019). Implementação por vertical
        segue o mesmo template de Hotmart/Kiwify.
      </p>
    </div>
  )
}
