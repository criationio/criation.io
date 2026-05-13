# ADR-015 — Decisões de plataforma Google (2026)

**Status:** Aceito
**Data:** 2026-05-13
**Sessão:** 1.4.9.B (Google EC fanout + OAuth Google antecipado) — antes de codar
**Substitui parcialmente:** sugestões da auditoria [GOOGLE_API_2026-05.md](../audits/GOOGLE_API_2026-05.md) §7 (Recomendações concretas) onde diverge — Data Manager API é o caminho canônico, não `ConversionUploadService`.

---

## Contexto

A auditoria de 2026-05-08 ([GOOGLE_API_2026-05.md](../audits/GOOGLE_API_2026-05.md)) recomendava `ConversionUploadService.UploadClickConversions` como endpoint canônico para o fanout server-side da 1.4.9.B, com **spike obrigatório de 2-3h** para validar a Data Manager API antes de fechar o escopo (audit §4 risco #3 + §7 item 11).

Esta ADR é o resultado desse spike, executado em 2026-05-13. O mundo mudou desde a auditoria de 5 dias atrás:

1. **2 fev 2026 — restrição já em vigor:** o Google Ads API parou de aceitar **novas implementações** que enviem `session_attributes` ou `IP address data` em `UploadClickConversions`. Developers existentes têm grandfathering por tempo indefinido; **novos developers ficam imediatamente sob a restrição** (`CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE`).
2. **Outubro 2025 — Data Manager API em GA** (v1.3). Versão atual **v1.6 lançada 2026-05-07** (1 semana atrás).
3. **Abril 2026 — unificação de fontes:** o Google Ads aceita simultaneamente user-provided data de website tags + Data Manager + API connections sem precisar escolher o método.
4. **Recomendação oficial Google ("Manage offline conversions"):** _"We recommend upgrading offline conversions workflows to the Data Manager API for an improved developer experience and access to additional features, and don't recommend implementing new offline conversion workflows using the Google Ads API."_
5. **Criation = NEW developer.** Nunca submetemos OAuth Google, nunca enviamos conversão. Caímos na restrição imediata, não no grandfathering.

A decisão entre **manter o plano original (`ConversionUploadService`)** e **migrar para Data Manager API agora** define schema, OAuth flow, scopes, services, payload builders e UI inteira de 1.4.9.B. Não dá pra resolver depois — qualquer dia de implementação numa direção é dia jogado fora se invertermos.

---

## Drivers de decisão

- **Sustentabilidade:** queremos construir para 12+ meses sem refactor forçado. Build em endpoint que Google diz "don't recommend for new implementations" tem prazo de validade.
- **Restrição de 2 fev 2026:** afeta a Criation imediatamente como new developer. Build em `ConversionUploadService` significa rodar sob endpoint mutilado.
- **Feature parity:** o que precisa estar disponível para a 1.4.9.B funcionar — Enhanced Conversions for Leads (caso primário do infoprodutor com lead magnet → checkout offline), Enhanced Conversions for Web (caso checkout digital), gclid/wbraid/gbraid, consent v2, dedup com pixel via `transactionId`, hashed user_data, batch.
- **Complexidade de auth:** OAuth verification timeline + sensitive scope review somam 2-6 semanas — quanto antes começar, melhor. Mas mudar de scope no meio da App Review reinicia o relógio. **Escolher scope UMA vez.**
- **B2B SaaS multi-tenant:** Criation acessa contas de cliente. Precisa de Partner Link flow ou login_customer_id header equivalente.
- **EMQ + match rate:** Google explicitamente fala em "richer data signals and better match rates" como vantagem da Data Manager API. Para nosso produto, match rate ≥60% é gate.
- **Custo de manutenção:** menos código duplicado entre Customer Match (Fase 3) e Conversion Upload (1.4.9.B) se mesma API.

---

## Opções consideradas

### 1. Endpoint canônico para Google fanout

**a. Google Ads API → `ConversionUploadService.UploadClickConversions`** (plano original do audit).

- **Pros:** documentação abundante, comunidade Stack Overflow, biblioteca `google-ads-node` madura, padrão histórico.
- **Cons:** explicitamente desencorajado pelo Google para novas integrações; restrição de 2-fev-2026 afeta a Criation como new developer (sem grandfathering); inevitável migração para Data Manager API em ≤12 meses; Customer Match em Fase 3 precisará obrigatoriamente da Data Manager API (`UserDataService` deprecando 1-abr-2026 para tokens novos) → 2 paths Google diferentes; developer token tier (Basic 15k ops/dia) é gargalo conhecido.
- **Esforço:** ~5h em 1.4.9.B + 6-8h de migração futura.

**b. Data Manager API → `POST /v1/events:ingest`** (recomendada).

- **Pros:** GA desde out/2025, recomendação oficial Google para novas integrações; endpoint único cobre Enhanced Conversions for Leads + Web + Store Sales + (futuramente) Customer Match → unifica 1.4.9.B com Customer Match (Fase 3); sem developer token + sem tier system; suporte nativo a gclid/wbraid/gbraid, hashed user_data, `consent.adUserData`/`adPersonalization`, `transactionId` para dedup com pixel client-side, `validateOnly: true` (modo teste equivalente ao `test_event_code` da Meta); batch até 2000 events/request; single call pode rotear para múltiplos `destinations` (Google Ads + GA4 no mesmo POST, útil para 2.10.5 GA4 opcional).
- **Cons:** API nova (v1.6 com 1 semana), menos comunidade; scope `https://www.googleapis.com/auth/datamanager` é sensitive (verification obrigatória, mas mesmo timeline que `adwords`); quotas não publicadas oficialmente (precisa monitorar em prod); requer também `auth/cloud-platform` scope (super-amplo — justificativa de OAuth review mais robusta).
- **Esforço:** ~6h em 1.4.9.B + zero migração futura para Customer Match.

**c. Híbrido — Data Manager API para Conversions + Google Ads API só para metadata (listAccessibleCustomers, conversion_actions, customer_client).**

- **Pros:** metadata via Google Ads API REST `v25` é endpoint estável e simples para popular `google_ads_accounts`; o fanout em si usa Data Manager API.
- **Cons:** 2 scopes (`adwords` + `datamanager`) na consent screen — UX mais ruim no consent + OAuth review mais complexo.

**Escolhido:** **(c) Híbrido** — Data Manager API para o fanout (POST events:ingest), Google Ads API REST `v25` apenas para descoberta de contas e conversion_actions no OAuth callback (essas APIs não estão na Data Manager API; precisamos delas para popular `google_ads_accounts` e `google_conversion_action_mappings` que o usuário escolhe no wizard). Pedimos ambos scopes `adwords` e `datamanager` (mais `cloud-platform`) na MESMA consent screen na 1.4.9.B — uma OAuth review, prazo único.

### 2. Auth — Partner Link vs OAuth direto do user

**a. Partner Link flow** (Data Manager API tem `accountTypes.accounts.partnerLinks` endpoints) — cliente concede permissão à Criation via flow específico no Data Manager.

- **Pros:** modelo "B2B SaaS data partner" oficial.
- **Cons:** ainda em fase de adoção; cliente precisa entrar no Data Manager UI para autorizar; UX mais distante do "1-clique OAuth Google".

**b. OAuth direto do user com `loginAccount` no payload** — cliente faz OAuth Google Ads padrão; Criation atua em nome dele via `operatingAccount`+`loginAccount` (equivalente ao `login_customer_id` header do Google Ads API para MCC).

**Escolhido:** **(b)**. Mesma UX que Meta OAuth (1 clique → callback → picker de contas). Partner Link reavaliado em Fase 2 quando tivermos ≥10 workspaces para reduzir fricção de novos clientes.

### 3. Versão da Data Manager API + override per-tenant

a. Hard-code `v1` em código.
b. Env var `GOOGLE_DATA_MANAGER_API_VERSION` central + per-tenant override em `google_connections.data_manager_api_version`.

**Escolhido:** **(b)**. Paridade com ADR-013 padrão Meta. v1.6 inclusive — promote a `v1` quando next stable sair (provavelmente v2 em 2027).

### 4. Versão da Google Ads API para metadata (account discovery, conversion_actions list)

a. Pinar `v25` (próxima release prevista para jun/2026 — v24 hoje).
b. Pinar `v24` (atual em maio/2026) + env var override.

**Escolhido:** **(b)**. v24 GA hoje. Env var `GOOGLE_ADS_API_VERSION` + per-tenant override em `google_connections.ads_api_version`. Trimestral (cadência Google) controlado.

### 5. Developer Token

a. Aplicar developer token Basic agora.
b. **Não solicitar developer token.** Data Manager API não usa.

**Escolhido:** **(b)**. Data Manager API **não tem developer token**. Eliminamos o item P1 do audit "Developer Token tier" inteiro. Quotas globais 15k/dia também desaparecem do nosso modelo de rate limit. Sobra rate limit per workspace via Trigger.dev concurrency limit (que já temos no `fanout-meta-capi`).

Para as chamadas Google Ads API REST de metadata (account discovery), precisamos sim de developer token Basic — mas é uma chamada inicial por workspace (uma vez no OAuth callback) + renovação esporádica, não está no hot path do fanout. Quota 15k/dia é mais que suficiente para metadata.

### 6. Customer Match em Fase 3 — caminho

a. `OfflineUserDataJobService` (Google Ads API) — deprecating 1-abr-2026 para new developers.
b. Data Manager API `audienceMembers:ingest` desde Fase 1.

**Escolhido:** **(b)**. Como já vamos integrar Data Manager API em 1.4.9.B, Customer Match em Fase 3 reusa o mesmo OAuth + scope + service. Schema `google_audience_lists` já planejado pela auditoria (§3) cabe sem mudança.

### 7. GA4 fanout (sessão 2.10.5)

a. Measurement Protocol `/mp/collect` direto.
b. Data Manager API `events:ingest` com `destination.accountType=GOOGLE_ANALYTICS_PROPERTY`.

**Escolhido:** **(b)**. Mesma chamada que envia para Google Ads pode rotear para GA4 via `destinations[]` array. Reduz código duplicado. Measurement Protocol adiado para "se Data Manager não suportar evento específico que precisamos" (não é o caso hoje).

### 8. Test mode (equivalente Meta `test_event_code`)

a. Test accounts MCC + flag `is_test_account` em `google_ads_accounts`.
b. `validateOnly: true` no payload (modo teste nativo da Data Manager API).

**Escolhido:** **(b)** + (a) como complemento. `validateOnly: true` valida o request sem persistir conversão (toggle global no wizard `/configuracoes/google/conversoes` enquanto cliente está testando). Test accounts permanecem como opção para clientes que queiram testar com conta separada.

### 9. Encryption envelope (KEK/DEK) para Google tokens

ADR-010 prevê envelope encryption. Implementação atual é single-key versionada (mesmo padrão Meta da ADR-013 §5).

**Escolhido:** Single-key AES-256-GCM com versionamento (idêntico ADR-013). Migração envelope vira tarefa de 2.15.5 / 3.11.5.

### 10. Granularidade do schema vs audit original

Audit §3 propõe 14 colunas em `google_connections` + tabelas `google_ads_accounts` + `google_conversion_action_mappings` + `google_audience_lists` + 9 colunas Google em `capi_events`. Algumas dessas colunas foram pensadas para `ConversionUploadService`. Decisão precisa revisar:

- `developer_token_tier` → **removido**. Data Manager API não usa.
- `ads_api_version` → **mantido** (usado para REST metadata calls).
- **NOVO:** `data_manager_api_version` (string, default `'v1'`).
- **NOVO:** `granted_data_manager_scope` (boolean) — flag de qual scope o user aprovou no OAuth (se ele revogar `datamanager` mas manter `adwords`, fanout falha graciosamente).
- `capi_events.google_click_id_used` → mantido, mapeia para `adIdentifiers.gclid|gbraid|wbraid`.
- `capi_events.google_conversion_action_resource_name` → renomear para `google_product_destination_id` (vocabulário Data Manager API).
- **NOVO:** `capi_events.google_request_id` (string) — `requestId` da resposta Data Manager API (para rastrear no Diagnostic Report).
- **NOVO:** `capi_events.google_validate_only` (boolean) — flag se foi modo teste.
- `google_conversion_action_mappings.conversion_action_resource_name` → renomear `product_destination_id` (vocabulário Data Manager API). É o mesmo ID numérico de Google Ads conversion action — só muda o nome do campo.

**Escolhido:** schema revisado conforme acima. Esta lista vira a referência para a migration de 1.4.9.B.

---

## Decisão

**A integração Google da Criation é construída sobre Data Manager API.** Concretamente:

1. **Fanout server-side de conversões:** `POST https://datamanager.googleapis.com/v1/events:ingest`. Suporta EC for Web + EC for Leads + Offline Conversions + (futuramente) Customer Match + GA4 destination com a mesma estrutura.
2. **Metadata (descoberta de Customer accounts + conversion actions):** Google Ads API REST `v24` — endpoints `customers:listAccessibleCustomers`, `customer_client` query, `conversion_action` query. Executados 1x no OAuth callback + renovação periódica.
3. **OAuth scopes pedidos na mesma consent screen:** `https://www.googleapis.com/auth/datamanager` + `https://www.googleapis.com/auth/adwords` + `https://www.googleapis.com/auth/cloud-platform`. **Sensitive scopes** — verification obrigatória (timeline 2-6 semanas), submeter em paralelo à 1.4.9.B.
4. **Sem developer token no hot path** do fanout (Data Manager API não usa). Developer token Basic apenas para Google Ads API REST de metadata.
5. **Versão Data Manager API:** env var `GOOGLE_DATA_MANAGER_API_VERSION='v1'` + per-tenant override em `google_connections.data_manager_api_version`.
6. **Versão Google Ads API:** env var `GOOGLE_ADS_API_VERSION='v24'` + per-tenant override em `google_connections.ads_api_version`.
7. **Schema delta vs audit §3:**
   - **Removido:** `google_connections.developer_token_tier` (Data Manager API não usa tiering).
   - **Adicionado:** `google_connections.data_manager_api_version text default 'v1'`, `google_connections.granted_data_manager_scope boolean default false`, `google_connections.granted_ads_scope boolean default false`.
   - **Renomeado:** `google_conversion_action_mappings.conversion_action_resource_name` → `product_destination_id`; `capi_events.google_conversion_action_resource_name` → `google_product_destination_id`.
   - **Adicionado em `capi_events`:** `google_request_id text` (resposta Data Manager API), `google_validate_only boolean default false`.
8. **Test mode:** `validateOnly: true` no payload (toggle global no wizard `/configuracoes/google/conversoes` enquanto cliente está testando antes de produção). Test accounts MCC permanecem como caminho complementar.
9. **`tracking_events`** ganha colunas adicionais conforme audit §3 sem mudança: `gad_source text`, `srsltid text`.
10. **`fanout-google-data-manager.ts`** (não `fanout-google-ads.ts`) — nomenclatura reflete o endpoint real para evitar drift mental futuro.
11. **Rate limit per workspace via Trigger.dev concurrency** (sem developer token global compartilhado). Batch até 2000 events por request. Backoff agressivo em `RESOURCE_EXHAUSTED` (Google não publica quota oficial — monitorar em produção e ajustar concurrency).
12. **Consent payload:** `consent.adUserData` e `consent.adPersonalization` populados de `tracking_events.consent_state` (campos `ad_user_data` e `ad_personalization` do Consent Mode v2). Default `CONSENT_UNSPECIFIED` se ausente.
13. **Dedup com pixel client-side:** sempre enviar `transactionId` = `event_id` Criation (mesmo valor usado no `eventID` do Meta CAPI 1.4.9). Google dedup quando match com pixel client-side via `transaction_id` (atualizando valor, ignorando outros campos conforme spec) — comportamento documentado.
14. **Partner Link flow** adiado para Fase 2 (reavaliar quando ≥10 workspaces ativos). OAuth direto do user é o caminho de 1.4.9.B.

---

## Consequências

**Positivas:**

- Sem migração forçada em ≤12 meses (Data Manager API é o long-term path do Google).
- Customer Match em Fase 3 reusa OAuth + scope + service de 1.4.9.B → ~6h economizadas em Fase 3.
- GA4 fanout opcional (sessão 2.10.5) é trivial — só adicionar destination ao `destinations[]` array do mesmo request.
- Sem o gargalo de developer token Basic 15k ops/dia global compartilhado. Rate limit fica no nosso lado (Trigger.dev concurrency), escalável por plano.
- Single sensitive scope OAuth review (Data Manager + Ads + Cloud Platform na mesma consent screen) — 1 ciclo de verificação Google, não 2.
- `validateOnly: true` nativo simplifica wizard test mode (sem necessidade de test accounts MCC obrigatórios).
- `transactionId` dedup nativo com pixel client-side — sem chance de double-count em conversions report do cliente.

**Negativas / Risco:**

- Data Manager API é nova (GA out/2025). Comunidade Stack Overflow pequena, biblioteca client Node.js oficial ainda não publicada em npm (precisa REST direto via `fetch` ou googleapis genérica). **Aceito** — pattern é equivalente ao que fizemos para Meta CAPI v25.
- Quotas oficiais não publicadas. **Mitigação:** monitorar 7d em shadow validation (1.4.9.5), ajustar Trigger.dev concurrency com base em rate de `RESOURCE_EXHAUSTED` real.
- Scope `cloud-platform` é super-amplo e gera fricção em OAuth review. **Mitigação:** justificativa explícita no submit ("required by Data Manager API per Google official docs"), demo video mostrando que só usamos endpoint Data Manager.
- Recomendação Google pode mudar (improvável, mas Google muda em ciclos curtos). **Mitigação:** ADR é versionada — se Data Manager API tiver problema material, abrir ADR-015.1 com nova decisão.
- Cliente que já tem Google Tag client-side com `transaction_id=X` precisa que o site envie EXATAMENTE o mesmo ID. **Mitigação:** docs do CDP Criation já dizem que `criation('track', 'purchase', {orderId})` precisa receber o `orderId` correto; mesmo padrão aplica ao `transaction_id` do Google Tag.

**Itens removidos do escopo da 1.4.9.B vs audit original:**

- ~~`developer_token_tier` column~~ (não aplicável a Data Manager API).
- ~~Standard developer token application path~~ (sem developer token no hot path).
- ~~"15k ops/dia global compartilhado" como gargalo P1~~ (não existe na Data Manager API).
- ~~Tier-warning UI~~ (idem).
- ~~Spike Data Manager API~~ (concluído neste ADR).

**Itens adicionados no escopo da 1.4.9.B vs audit original:**

- Scope `auth/cloud-platform` no OAuth submit (Data Manager API requer).
- Colunas `data_manager_api_version`, `granted_data_manager_scope`, `granted_ads_scope` em `google_connections`.
- Colunas `google_request_id`, `google_validate_only` em `capi_events`.
- `fanout-google-data-manager.ts` (renomeado de `fanout-google-ads.ts`).
- `validateOnly: true` toggle no wizard `/configuracoes/google/conversoes`.

---

## Referências

- [Data Manager API — overview](https://developers.google.com/data-manager/api)
- [Method: events.ingest](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest)
- [Send events guide](https://developers.google.com/data-manager/api/devguides/events/send-events)
- [Quickstart: Set up access](https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access)
- [Manage offline conversions (Google Ads API — quote about Data Manager preference)](https://developers.google.com/google-ads/api/docs/conversions/upload-offline)
- [ALM Corp: Feb 2026 conversion data restrictions](https://almcorp.com/blog/google-ads-api-conversion-data-changes-2026/)
- [ALM Corp: Data Manager API store sales 2026](https://almcorp.com/blog/google-ads-data-manager-api-store-sales-event-ingestion-guide/)
- [Google Ads Developer Blog — May 2026 store sales support](https://ads-developers.googleblog.com/2026/05/data-manager-api-introducing-support.html)
- [Auditoria Google 2026-05](../audits/GOOGLE_API_2026-05.md) — esta ADR refina e substitui §4 e §7 onde diverge.
- [ADR-013 — plataforma Meta 2026](./ADR-013-meta-platform-2026.md) — referência para o padrão de versionamento per-tenant.
- [ADR-014 — Criation como CDP](./ADR-014-criation-as-cdp.md) — promete fanout multi-platform desde Fase 1; esta ADR cumpre a parte Google.

---

## Quando reavaliar

- Se Google publicar quotas oficiais da Data Manager API → ajustar concurrency Trigger.dev por workspace.
- Se shadow validation (1.4.9.5) revelar match rate <60% → investigar se há campos extras na payload que melhoram (sessão `userProperties`, `eventDeviceInfo`).
- Se OAuth review demorar >8 semanas → considerar se `cloud-platform` scope pode ser reduzido (Google ocasionalmente quebra Data Manager API em scope mais granular — checar a cada release).
- Se Customer Match (Fase 3) revelar requisito de `OfflineUserDataJobService` específico não coberto por Data Manager → ADR-015.1 com nova decisão.
- Se outra plataforma de fanout (TikTok Events API) entrar → ADR-016 separado seguindo padrão "1 ADR por plataforma".
