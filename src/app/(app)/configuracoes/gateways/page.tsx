import { redirect } from 'next/navigation'

/**
 * Hub central de gateways foi unificado em `/configuracoes/conexoes` (ADR-019,
 * TD-070 antecipado). Esta rota raiz redireciona; as detail pages por provider
 * (`/configuracoes/gateways/[provider]` e `[provider]/connect`) seguem ativas.
 */
export default function GatewaysIndexPage(): never {
  redirect('/configuracoes/conexoes')
}
