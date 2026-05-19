# ADR-019 — Meta-tabela `connections` + adapters por vertical

**Status:** Aceito
**Data:** 2026-05-10
**Sessão:** sub-1.4 (refactor estrutural antes de novas verticals)

## Contexto

Hoje temos `gateway_connections` (renomeada via esta ADR pra `connections`) + adapters em `src/lib/services/gateways/` cobrindo Hotmart, Kiwify, Eduzz e Generic. No futuro entrarão outras verticals — CRM (HubSpot, RD Station, Pipedrive), email marketing (Mailchimp, Brevo), analytics (Mixpanel, PostHog), helpdesk (Zendesk, Intercom), comunicação (WhatsApp Business, Telegram).

Cada vertical tem schema de eventos próprio e radicalmente diferente:

- Gateway: `gateway_events` com `event_type`, `amount_cents`, `subscriber_code`
- CRM: contacts, deals, pipelines, activities (modelo relacional rico)
- Email: lists, campaigns, opens, clicks (analytics-style)
- Analytics: events com properties dinâmicas

**Forçar uma tabela única `events` polimórfica com `data jsonb`** perde semântica e queryability. Cada vertical merece schema especializado.

**MAS** todas compartilham primitives:

- Encrypt/decrypt de credenciais
- Webhook secret validation (HMAC ou plain)
- Telemetria de saúde (`lastWebhookEventAt`, `webhookFailures24h`)
- UI status badge (pending/active/failing/stale)
- Soft delete + UNIQUE parcial por (workspace, type, provider)

## Drivers de decisão

- UI única de "Conexões" (cliente vê tudo num hub central, não 5 menus separados)
- Schema específico por vertical preservado (queries otimizadas, type-safe)
- Refactor moderado AGORA (~1h) evita refactor pesado quando 1ª nova vertical entrar
- Não introduzir verticals novas sem feature concreta (YAGNI)

## Opções consideradas

### 1. Estrutura de dados

a. Tabela única `integrations` + `events` polimórfica com `data jsonb`.
b. Tabelas separadas por vertical (`gateway_connections`, `crm_connections`, `email_connections`).
c. **Meta-tabela `connections` + tabelas específicas de eventos por vertical.**

**Escolhido:** (c). Cliente vê hub único, schema preservado, primitives compartilhados.

### 2. Coluna discriminadora

a. `provider` carrega tudo (`hotmart`, `hubspot`, `mailchimp`).
b. **`type` separado de `provider`** (`type='gateway'` + `provider='hotmart'`; `type='crm'` + `provider='hubspot'`).

**Escolhido:** (b). Permite:

- UI agrupada por type (cliente filtra "Gateways" / "CRMs" / "Email" no hub)
- UNIQUE constraint `(workspace, type, provider)` permite ex: `gateway:hotmart` E `crm:hotmart` futuramente sem colisão
- Queries genéricas por type sem precisar de `WHERE provider IN (...)` listando providers de cada vertical

### 3. Endpoint de webhook

a. Endpoint único `/api/webhooks/[type]/[provider]/[connection_id]`.
b. Endpoints separados por vertical (`/api/webhooks/gateway/...`, `/api/webhooks/crm/...`).

**Escolhido:** (b) — manter como está. Razão: URLs já configuradas em produção (Hotmart, Kiwify, Eduzz). Mudar pra `/api/webhooks/gateway/...` (com prefix `gateway`) quebraria todos os webhooks ativos. Adicionar nova vertical = novo endpoint paralelo.

### 4. Migration strategy

a. Drop + create (rápido mas perde dados das connections existentes).
b. **Rename + add column** (preserva UUIDs existentes — webhooks ativos continuam funcionando).

**Escolhido:** (b). Preserva os 7 UUIDs de connections existentes. Hotmart/Kiwify/Eduzz/Generic continuam ativos sem reconfiguração.

### 5. Adapter pattern

a. `BaseAdapter` interface única + cada vertical estende com métodos próprios.
b. **Interfaces específicas por vertical** (`GatewayAdapter`, `CrmAdapter`, `EmailAdapter`) sem hierarquia comum forçada.

**Escolhido:** (b). Cada vertical tem semântica diferente (`GatewayAdapter.normalizeEvent` retorna `NormalizedGatewayEvent`; futuro `CrmAdapter.normalizeContact` vai retornar `NormalizedContact`). Forçar `BaseAdapter` daria interface vazia ou genérica demais.

## Decisão

**Schema:**

- `connections` (meta-tabela): `id, workspace_id, type, provider, encrypted_credentials, webhook_secret, api_credentials jsonb, webhook_version, provider_subaccount_id, last_webhook_event_at, last_webhook_event_id, webhook_failures_24h, status, last_sync_at, created_at, updated_at, deleted_at`
- `type` valores válidos: `'gateway' | 'crm' | 'email' | 'ad_network' | 'analytics' | 'helpdesk' | 'communication'`
- UNIQUE `(workspace_id, type, provider)` WHERE `deleted_at IS NULL`
- Tabelas específicas (`gateway_events`, futuro `crm_contacts`/`crm_deals`, futuro `email_lists`/`email_campaigns`) referenciam via `connection_id` FK

**Código:**

- `src/lib/db/schema/connections.ts`: export `connections` (renomeado de `gatewayConnections`). **Alias deprecated removido em commit `bc2e07b`** — confundia o Drizzle Query Builder (`db.query.connections.findMany` retornava undefined quando o alias coexistia).
- `src/lib/db/queries/connections.ts`: substituí `gateway-connections.ts`. Novo parâmetro opcional `type` em `getActiveConnection(workspaceId, provider, type='gateway')` e `listActiveConnections({type, provider})`.
- `src/lib/services/gateways/`: pasta mantida (não mexer adapters — específicos por vertical). Quando CRM entrar: `src/lib/services/crm/hubspot/`, etc.
- Endpoint webhook gateway: `/api/webhooks/gateway/[provider]/[connection_id]` mantido. Novo: `/api/webhooks/generic/[connection_id]` mantido. Quando CRM entrar: `/api/webhooks/crm/[provider]/[connection_id]` paralelo.

**UI:**

- Hub central `/configuracoes/conexoes` implementado em commit `0155ed0` (TD-070 antecipado). Cards compactos agrupados por type (Plataformas de anúncios, Gateways de pagamento, Outras integrações). Click abre Dialog centralizado com detalhes específicos por kind. Arquitetura: Server Component monta `ConnectionDescriptor[]` serializável, Client Component (`ConnectionsHub`) renderiza grid + dialog.
- Entry "Gateways" removida do menu lateral; `/configuracoes/gateways` raiz redireciona pra `/configuracoes/conexoes`. Detail pages por provider (`/configuracoes/gateways/[provider]/connect`) seguem ativas pro fluxo de conexão.
- Component `ConnectionStatusBadge` continua vertical-agnostic — `deriveConnectionHealth(connection)` deriva health (pending/active/failing/stale) baseado em `lastWebhookEventAt` + `webhookFailures24h`.

## Consequências

**Positivo:**

- Refactor barato agora (~1h) evita migration pesada quando 1ª vertical nova entrar.
- UI/health/encryption/webhook router compartilhados — DRY real.
- 7 connections existentes preservadas (zero downtime, zero reconfiguração de webhooks).
- Schema específico por vertical mantém type-safety (Drizzle types preservados).

**Negativo:**

- `gateway-connections.ts` (queries) renomeado pra `connections.ts` — todos imports refatorados.
- Endpoints webhook ainda especializados (`/api/webhooks/gateway/...` vs `/api/webhooks/generic/...`) — quando CRM entrar, mais um endpoint paralelo. Aceito (URLs em produção não devem mudar).
- Drizzle-kit não conseguiu auto-gerar a migration (rename precisa prompt interativo). Aplicada manualmente via Supabase MCP.

**Coisas que não decidimos aqui (TODO):**

- ~~**TD-070**~~: ✅ Entregue em `0155ed0` (2026-05-10) — hub central implementado antes do previsto.
- **TD-071**: 1ª nova vertical (provavelmente CRM — RD Station ou HubSpot, mais usados em BR infoprodutor).
- **TD-072**: Campo `type` Zod enum vs string — manter string permissivo agora, restringir via Zod quando catálogo estabilizar.
- **TD-073**: Snapshot drizzle-kit — próximo `db:generate` pode gerar migration spurious tentando "criar" connections (já existe). Lidar quando pegar.

## Referências

- [ADR-016](./ADR-016-plataforma-hotmart.md), [ADR-017](./ADR-017-plataforma-kiwify.md), [ADR-018](./ADR-018-plataforma-eduzz-e-webhook-generico.md) — adapters por gateway
- Schema: `src/lib/db/schema/connections.ts`
- Queries: `src/lib/db/queries/connections.ts`
- Component compartilhado: `src/components/gateways/ConnectionStatusBadge.tsx`
