import type { BrandProvider } from './BrandLogo'

/**
 * Snapshot serializavel de uma conexao para a UI do hub. Server Component
 * monta esse shape a partir das tabelas (`meta_connections` + `connections`)
 * e passa pro Client Component renderizar grid + dialog.
 */
export interface ConnectionDescriptor {
  /** Identificador estavel pra React key + open dialog. */
  key: string
  /** Tipo da conexao — controla qual conteudo de detalhe renderizar. */
  kind: 'meta' | 'google' | 'gateway' | 'tracking' | 'others'
  brand: BrandProvider
  name: string
  shortLabel: string
  /** Status normalizado pra badge. 'unset' = nao conectado. */
  status: 'active' | 'pending' | 'failing' | 'stale' | 'expired' | 'disconnected' | 'unset'
  /** Subtitulo curto exibido abaixo do nome no card (opcional). */
  subtitle?: string | null
  /** Onde levar o usuario quando ele clicar em "Conectar" no dialog (sem conexao). */
  connectHref?: string
  /** Quando conexao existe, link pra fluxo legado de detalhes (fallback). */
  manageHref?: string
  /** Detalhes especificos por kind — tipados via discriminated union. */
  details?: ConnectionDetails
}

export type ConnectionDetails =
  | { kind: 'meta'; payload: MetaDetailPayload }
  | { kind: 'gateway'; payload: GatewayDetailPayload }
  | { kind: 'tracking'; payload: TrackingDetailPayload }
  | { kind: 'google'; payload: GoogleDetailPayload | null }
  | { kind: 'others'; payload: null }

export interface TrackingDetailPayload {
  installed: boolean
  lastEventAt: string | null
  totalEvents24h: number
  originAllowlistCount: number
  scriptUrl: string
  configured: boolean
}

export interface MetaAdAccountOption {
  adAccountId: string
  adAccountName: string | null
  currency: string | null
  accountStatus: number | null
  isDefault: boolean
}

export interface MetaDetailPayload {
  metaUserName: string | null
  metaUserEmail: string | null
  isSystemUserToken: boolean
  tokenExpiresInDays: number | null
  marketingApiVersion: string
  pixelId: string | null
  businessVerificationStatus: string
  verifiedDomainsCount: number
  totalDomainsCount: number
  scopesCount: number
  adAccountsCount: number
  defaultAdAccountId: string | null
  adAccounts: MetaAdAccountOption[]
}

export interface GoogleDetailPayload {
  googleUserName: string | null
  googleUserEmail: string | null
  grantedDataManagerScope: boolean
  grantedAdsScope: boolean
  grantedCloudPlatformScope: boolean
  tokenExpiresInDays: number | null
  accountsCount: number
  defaultCustomerId: string | null
  testMode: boolean
  dataManagerApiVersion: string
  adsApiVersion: string
}

export interface GatewayDetailPayload {
  provider: 'hotmart' | 'kiwify' | 'eduzz' | 'generic'
  webhookUrl: string | null
  webhookVersion: string | null
  lastWebhookEventAt: string | null
  lastWebhookEventId: string | null
  webhookFailures24h: number
  createdAt: string
}
