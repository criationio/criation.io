# Auditoria Google API / Ads / GA4 / Tag Manager — vs arquitetura v0.6 + ADR-014 (CDP)

**Data:** 2026-05-08
**Sessão de origem:** 2.10 (Google Ads integration), com refluxo para 1.4.9 (fanout) e 1.4.A (CDP capture)
**Conduzida por:** agente de pesquisa (consultor de tracking)
**Fontes:** developers.google.com (Google Ads API release notes/access levels/conversions/customer match/quotas), GA4 Measurement Protocol & Data API, Tag Manager API v2, Consent Mode v2, Google OAuth verification + arquitetura v0.6 + schema atual + ADR-013 (Meta) + ADR-014 (CDP).

> Este documento é o equivalente Google do `META_API_2026-05.md`. Onde houver conflito com a v0.6, este documento vence. Decisões formais devem ser registradas em **ADR-015 (Decisões de plataforma Google)** quando Sessão 2.10 entrar em prep — ver justificativa no fim.

---

## 1. Stack Google correto em 2026

| Produto                                                | Versão / estado atual                                                                                                                                                                              | Nota crítica                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Google Ads API**                                     | **v24** (released abr/2026); v23 (jan/2026), v22 (out/2025), v21 (ago/2025) ainda aceitas. Cadência ~3 meses.                                                                                      | v0.6 não pinpoint versão. Adotar `v24` mínima e env var `GOOGLE_ADS_API_VERSION` por paridade com Meta.                     |
| **Developer Token Tiers (Access Levels)**              | Test (auto, só test accounts) → Basic (~2 dias úteis, **15k ops/dia**) → Standard (~10 dias úteis, "ilimitado").                                                                                   | v0.6 não menciona — gap **P1**. SaaS multi-tenant **precisa Standard** desde Fase 2 (Basic não escala para 50+ workspaces). |
| **OAuth Scope `adwords`**                              | Sensitive scope. App verification obrigatória para sair do limite de **100 test users**.                                                                                                           | v0.6 silencia. Verification do consent screen tem timeline **2-6 semanas**, similar ao Business Verification do Meta.       |
| **Manager Account (MCC) + `login_customer_id` header** | Padrão para SaaS managing client accounts. Header obrigatório quando token é gerado em conta MCC.                                                                                                  | v0.6 ignora — gap arquitetural **P1**.                                                                                      |
| **Enhanced Conversions for Web (EC Web)**              | Setup via Google Tag, GTM, ou Google Ads API (`ConversionAdjustmentUploadService`, `adjustment_type=ENHANCEMENT`). API permite envio em até 24h pós-conversão.                                     | A escolha certa pra fanout server-side de e-commerce/checkout.                                                              |
| **Enhanced Conversions for Leads (EC Leads)**          | Via `ConversionUploadService.UploadClickConversions` com `user_identifiers` hashed + `consent`. Substitui legacy offline conversion imports.                                                       | Para infoproduto com lead gen (form submit → checkout offline), é **mais relevante** que EC Web em muitos casos.            |
| **Offline Click Conversions**                          | Mesma API (`UploadClickConversions`). Conversion action precisa ser tipo `UPLOAD_CLICKS`. Precisa de `gclid` OU `user_identifiers` (preferir ambos).                                               | Use quando a conversão acontece fora do site.                                                                               |
| **GCLID expiration**                                   | **90 dias.** gbraid/wbraid sem janela formal documentada — comportar como gclid.                                                                                                                   | v0.6 omite — gap **P1**. Job de match precisa filtrar `seen_at < 90d`.                                                      |
| **Customer Match**                                     | SHA-256 + normalização. **Membership life span máx 540d** (era infinito até abr/2025). Min seed **5.000 ativos** (não 100 como Meta). Consent obrigatório.                                         | v0.6 não detalha. **5k mínimo** muda pricing — só faz sentido como feature de plano Agency.                                 |
| **OfflineUserDataJobService / UserDataService**        | **Em sunset.** A partir de **1-abr-2026**, requests falham se developer token não tem histórico prévio de Customer Match. Google empurra migração para **Data Manager API**.                       | **P1 crítico:** se vamos codar Customer Match em 2026, **não construir contra UserDataService.**                            |
| **Data Manager API**                                   | Nova superfície (2025+) que unifica Customer Match + Enhanced Conversions + Offline Conversions.                                                                                                   | **Avaliar antes de Fase 2.** Possivelmente é o "endpoint canônico" pra fanout Google.                                       |
| **GA4 Measurement Protocol**                           | `/mp/collect` com `measurement_id` + `api_secret`. Suplementa gtag, **não substitui**. Sem gtag, "partial reporting only".                                                                         | Para nosso CDP: enviar **opcionalmente** se cliente quiser GA4 alimentado, mas o produto core **não depende** dele.         |
| **GA4 Data API v1**                                    | OAuth scope `analytics.readonly`. `runReport`, `runRealtimeReport`, `runFunnelReport`, `batchRunReports`.                                                                                          | Útil **apenas** se decidirmos puxar GA4 como input de dashboard. Não é canal de fanout.                                     |
| **GA4 Admin API v1**                                   | OAuth scope `analytics.edit` ou `analytics.readonly`. CRUD de properties, data streams, conversion events.                                                                                         | Marginal para nosso caso.                                                                                                   |
| **Tag Manager API v2**                                 | OAuth scopes `tagmanager.edit.containers`, `tagmanager.publish`. CRUD em containers/tags/triggers.                                                                                                 | **Não integrar.** Antithesis de SaaS multi-tenant (mesmo argumento que GTM SS no ADR-013/ADR-014).                          |
| **Consent Mode v2**                                    | 4 sinais: `ad_storage`, `analytics_storage`, `ad_user_data` (novo v2), `ad_personalization` (novo v2). Default **denied**. **Obrigatório EEA**. Server-side: `consent` field em `ClickConversion`. | v0.6 acerta nos 4 sinais mas não menciona o **field `consent` no payload server-side** (gap **P1** em fanout).              |
| **sGTM (server-side GTM)**                             | Hosted Cloud Run / App Engine. **NÃO integrar.**                                                                                                                                                   | Co-existe se cliente trouxer.                                                                                               |

---

## 2. Gaps de arquitetura

| Gap                                                                   | Severidade | Sessão sugerida   | Descrição                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Versão Google Ads API não pinada**                                  | **P1**     | 2.10              | Pinar `v24` em env var `GOOGLE_ADS_API_VERSION`. Per-tenant override em `google_connections.ads_api_version`.                                                                                                                                       |
| **Developer Token tier não modelado**                                 | **P1**     | 2.10              | `google_connections.developer_token_tier` (Test/Basic/Explorer/Standard). UI mostra warning se Basic em workspace de produção.                                                                                                                      |
| **MCC + login_customer_id ausentes**                                  | **P1**     | 2.10              | Toda chamada Ads precisa do header `login-customer-id` quando o operating customer é gerenciado por MCC. Sem isso, agências não funcionam.                                                                                                          |
| **OAuth verification não planejada**                                  | **P1**     | 2.10 / pré-launch | Scope `adwords` é sensitive. Limite **100 test users** até verification aprovada. Submit logo (privacy + branding + demo video). 2-6 semanas.                                                                                                       |
| **Único developer token compartilhado entre clientes**                | **P1**     | 2.10 + ADR-015    | Diferente do Meta (cada client app tem app_id próprio), Google Ads API usa **um developer token da Criation** que faz proxy para todos os customers. **Quota 15k/dia (Basic) é global.** Implicação: rate limiting **por workspace** no nosso lado. |
| **EC Web vs EC Leads vs Offline Conversions — política não definida** | **P1**     | 1.4.9 (fanout)    | Default sugerido: sempre `UploadClickConversions` com `gclid` (quando disponível) **+** `user_identifiers` (sempre). Google trata como Offline + Enhanced atomicamente.                                                                             |
| **Customer Match — definir como produto**                             | P2         | Fase 3 / Agency   | Min 5k seed + max 540d membership + Data Manager API. Faz sentido só pra plano Agency com base ≥ 5k buyers. **Não para MVP**.                                                                                                                       |
| **Data Manager API — investigar agora**                               | **P1**     | 2.10 + ADR-015    | UserDataService deprecando 1-abr-2026 para tokens novos. Spike de 2-3h pra validar Data Manager API antes de decidir o endpoint do fanout.                                                                                                          |
| **GA4 fanout — opcional ou produto?**                                 | P2         | 1.4.9 + ADR-015   | Recomendação: **opcional, off por default**. Cliente que tem GA4 ativa flag → enviamos via Measurement Protocol em paralelo. Sessão nova **2.10.5** (~2h).                                                                                          |
| **Tag Manager API — não integrar**                                    | P3         | —                 | Mesmo argumento ADR-013/ADR-014. UI de tag building não é nossa área.                                                                                                                                                                               |
| **Click IDs faltando em `tracking_events`**                           | **P1**     | 1.4.A             | ADR-014 já planeja `gclid, wbraid, gbraid`. **Adicionar também `gad_source`** (Google Ads/AdSense/DV360) **e `srsltid`** (Search Results Listing Token, Performance Max).                                                                           |
| **Consent field server-side ausente**                                 | **P1**     | 1.4.9             | Toda chamada Google Ads API server-side aceita `consent { ad_user_data, ad_personalization }`. Sem enviar, default = denied. Propagar `consent_state` de `tracking_events` para o payload.                                                          |
| **Cross-domain tracking**                                             | P2         | 1.4.A / 1.4.B     | CDP precisa lidar com cliente que tem checkout em domínio diferente. Nosso `c.js` precisa fazer equivalente do `_ga` linker (passar visitor_id + click IDs cross-domain via query param).                                                           |
| **Cross-device measurement**                                          | P2         | Fase 3            | Para MVP basta `external_id_hash` em conversion uploads (Google faz cross-device pelo lado dele).                                                                                                                                                   |
| **sGTM coexistência**                                                 | P3         | —                 | Cliente que já tem sGTM: aceitar mesmo `event_id` + `gclid`. Não vendemos sGTM.                                                                                                                                                                     |
| **Webhook do gateway sem `gclid`**                                    | **P1**     | 1.4.B (matching)  | Gateway raramente passa gclid no webhook. UTM Stitcher 2.0 precisa correlacionar `tracking_events` recente da mesma sessão/visitor_id que tinha gclid e injetar no fanout.                                                                          |
| **Conversion Action ID não modelado**                                 | **P1**     | 2.10              | Cada conversão Google Ads tem `conversion_action`. Cliente tem N conversion actions. Schema precisa mapear nosso `event_name` → `conversion_action_id` por workspace. Sem isso, fanout falha 100%.                                                  |

---

## 3. Gaps de schema

### `google_connections` — schema atual é minimal demais; deltas (P1)

```diff
+ grantedScopes jsonb
+ managerCustomerId text
+ loginCustomerIdHeader text
+ developerTokenTier text default 'basic'  -- 'test'|'basic'|'explorer'|'standard'
+ adsApiVersion text default 'v24'
+ oauthClientVerificationStatus text default 'unverified'
+ googleUserId text
+ googleUserEmail text
+ googleUserName text
+ lastTokenRefreshAt timestamptz
+ tokenRefreshFailures integer default 0
+ refreshTokenInvalidatedAt timestamptz
+ partnerAgent text default 'criation-io-v1'
+ testAccountFlag boolean default false
- customerId text                -- DEPRECATED, vai pra google_ads_accounts (1:N)
- customerName text               -- idem
```

### Nova tabela `google_ads_accounts` (1:N de `google_connections`)

```sql
google_ads_accounts (
  id uuid pk,
  connection_id uuid fk → google_connections(id) on delete cascade,
  customer_id text not null,
  customer_descriptive_name text,
  manager_customer_id text,
  login_customer_id text,
  currency_code text,
  time_zone text,
  status integer,
  is_test_account boolean default false,
  is_manager boolean default false,
  is_default boolean default false,
  conversion_actions jsonb,
  last_sync_at timestamptz,
  ...
  unique(connection_id, customer_id)
)
```

### Nova tabela `google_conversion_action_mappings`

```sql
google_conversion_action_mappings (
  id uuid pk,
  workspace_id uuid fk,
  google_ads_account_id uuid fk,
  internal_event_name text,
  conversion_action_resource_name text,
  conversion_action_type text,
  is_primary boolean default false,
  unique(workspace_id, google_ads_account_id, internal_event_name)
)
```

### `tracking_events` (a ser criada em 1.4.A — ADR-014)

ADR-014 já lista `gclid, wbraid, gbraid`. **Adicionar:**

- `gad_source text`
- `srsltid text`

### `capi_events` (vira log de fanout)

```diff
+ google_customer_id text
+ google_conversion_action_resource_name text
+ google_click_id_used text
+ google_click_id_type text                    -- 'gclid'|'wbraid'|'gbraid'|'none'
+ google_user_identifiers_count integer
+ google_consent_ad_user_data text             -- 'GRANTED'|'DENIED'|'UNSPECIFIED'
+ google_consent_ad_personalization text
+ google_order_id text
+ google_adjustment_type text
```

Renomear conceitualmente: `capi_events` → `outgoing_fanout_events` (rename real adiar pra hardening).

### Nova tabela `google_audience_lists` (Customer Match — Fase 3)

```sql
google_audience_lists (
  id uuid pk,
  workspace_id uuid fk,
  google_ads_account_id uuid fk,
  user_list_resource_name text,
  name text,
  upload_key_type text,
  membership_life_span_days integer default 540,
  active_user_count_estimate integer,
  last_uploaded_at timestamptz,
  status text default 'active'
)
```

---

## 4. Riscos críticos

1. **Developer Token Standard timeline (~10 dias úteis) + Basic limita 15k ops/dia globais.** Em 50 workspaces ativos, 15k/dia = 300 ops/workspace/dia. Conversion uploads em batches caem rápido. **Aplicar Standard antes da Fase 2 launch.**
2. **OAuth client verification não aprovada → 100 test users limit.** Trava growth real.
3. **OfflineUserDataJobService deprecando para tokens novos em abr/2026.** Spike obrigatório antes de fechar 2.10.
4. **Refresh tokens Google podem ser invalidados:** quando user revoga, quando 6 meses sem uso, quando cliente atinge limite de 50 refresh tokens (em apps unverified). Refresh job + re-auth UX obrigatórios.
5. **`adwords` é sensitive scope.** Privacy policy precisa endereçar dados de campanha + conversões. Demo video do consent screen.
6. **Quota global compartilhada (Basic = 15k ops/dia para nosso developer token inteiro)** — precisa rate limiter por workspace, fila Trigger.dev priorizada por plano e backoff agressivo em `RESOURCE_EXHAUSTED`.
7. **Per-customer rate limits adicionais** (Conversion Upload máx 2.000 conversions/request; KeywordPlanIdeaService 1 QPS/customer).
8. **GCLID > 90d → silently rejected** (sem error). Job de match precisa filtrar; alertar se taxa de drop > 5%.
9. **Consent field default = UNSPECIFIED tratado como DENIED em EEA.** Mandar sempre o que `tracking_events.consent_state` capturou.
10. **PII em logs:** `user_identifiers` plain antes do hash. Garantir hash acontece no service, **antes** do logger ver o payload.
11. **LGPD vs GDPR:** Google Ads API não diferencia. **Sempre tratamos como se fosse GDPR.**
12. **Manager account loop:** se cliente conecta com user que está em múltiplos MCCs, callback precisa lidar.
13. **`order_id` mismatch:** se cliente tem Google Tag client-side com `transaction_id=X` e nós enviamos `order_id=Y`, Google **não dedupa**. Schema precisa garantir `order_id` enviado == `transaction_id` que o site usa.

---

## 5. Compliance LGPD / iOS / Consent Mode v2 — específico Google

**Diferenças vs Meta:**

- **Meta:** LDU é flag binária (`['LDU']`, country=0, state=0). Server-side ainda envia request, Meta filtra.
- **Google:** Consent Mode v2 expõe **4 sinais granulares** + payload server-side aceita `consent { ad_user_data, ad_personalization }`. Se denied, conversão entra modelada. UNSPECIFIED em EEA = DENIED. Customer Match em EEA sem `ad_user_data=GRANTED` não personaliza.

**Implicação arquitetural:** `tracking_events.consent_state jsonb` precisa carregar os 4 sinais explicitamente. Service de fanout traduz `consent_state.ad_user_data` → `consent.ad_user_data` no payload Google e separadamente em `data_processing_options=['LDU']` para Meta.

**iOS específico Google: wbraid e gbraid**

- **gclid**: web → web.
- **gbraid**: web → iOS app.
- **wbraid**: iOS app → web.
- iOS 14+ ATT: quando user nega tracking, **Google não emite gclid**, emite **wbraid**. Privacy-preserving. Custom variables não funcionam com wbraid/gbraid.

**LGPD nuances:** LGPD aceita legítimo interesse, GDPR pressupõe consent explícito. Para mercado BR puro: opt-out é tecnicamente válido se DPIA documenta. **Mas** Google Ads optimization degrada se mandarmos UNSPECIFIED. Recomendar opt-in mesmo em BR.

**Endpoint público de erasure (LGPD):** Google **não tem callback formal** equivalente ao Meta Data Deletion Callback. Erasure é responsabilidade nossa.

---

## 6. GA4 vs Google Ads vs nossa solução

**Pergunta:** integramos GA4 ou ignoramos?

**Tese:** Google Ads e GA4 são produtos diferentes. O fanout core é **Google Ads**. GA4 é destination opcional.

| Aspecto              | Google Ads (core)                            | GA4 (opcional)                           |
| -------------------- | -------------------------------------------- | ---------------------------------------- |
| Para quê             | Otimização de bidding + atribuição           | Analytics geral                          |
| Endpoint server-side | `ConversionUploadService` / Data Manager API | Measurement Protocol                     |
| OAuth scope          | `adwords` (sensitive)                        | `analytics.readonly` ou `analytics.edit` |
| Para nosso produto   | **Obrigatório**                              | **Opcional**                             |
| Risco se ignorarmos  | Cliente Google Ads não otimiza               | Cliente diz "vocês não falam com GA4"    |

**Recomendação:**

- **Sessão 2.10 = só Google Ads.** GA4 fica fora.
- **Sessão 2.10.5 (nova, ~2h):** "Send to GA4 toggle" — Measurement Protocol fanout opcional. Não bloqueante.
- **Não consumimos GA4 Data API** no MVP. Considerar em Fase 3.

**Pegadinha não-óbvia:** Google Ads conversion uploads **não chegam** em GA4. São coisas separadas. Cliente que liga só Google Ads vai ver conversões otimizando no Google Ads UI mas zero em GA4. Educar no copy.

---

## 7. Recomendações concretas para Sessão 2.10 (Google Ads integration)

1. **Scopes OAuth:** `https://www.googleapis.com/auth/adwords` (suficiente). **NÃO** pedir `analytics.*` em 2.10.
2. **Submeter OAuth client verification em paralelo ao código** — não no fim. 2-6 semanas.
3. **Aplicar Basic Access imediatamente.** Aplicar Standard quando tivermos 5+ workspaces ativos com volume real.
4. **Endpoints a chamar no callback OAuth:**
   - `GET /v24/customers:listAccessibleCustomers`
   - Para cada `manager=true`: `SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.test_account, customer_client.currency_code, customer_client.time_zone FROM customer_client`
   - Para cada non-manager customer: `SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.category FROM conversion_action WHERE conversion_action.status='ENABLED'`
5. **Persistir:** ver schema deltas seção 3.
6. **Refresh strategy:** Google refresh tokens **não expiram por tempo** (até user revogar ou inatividade 6 meses). Refresh job 1x/24h mantém vivo + detecta `invalid_grant` cedo.
7. **Multi-account UX:** tela picker pós-OAuth lista customers (não MCCs). Cliente seleciona N. Primeiro = `is_default`.
8. **Conversion action mapping UI:** sub-tela "para cada evento Criation, qual conversion action Google?". Sem mapping, fanout pula evento + warning.
9. **Header `login-customer-id`** em toda chamada para customer gerenciado por MCC. Helper centralizado.
10. **`partner_agent='criation-io-v1'`** equivalente.
11. **Spike de 2-3h:** Data Manager API. Decidir se 2.10 já usa ou se mantém ConversionUploadService e migra Customer Match em Fase 3.
12. **Token storage:** mesmo padrão Meta. ADR-010 (envelope encryption) ainda adiado.
13. **Telemetria:** `criation_oauth_google_completed` com `customer_count`, `manager_customer_count`, `conversion_actions_count`, `granted_scopes`, `is_test_account`.
14. **Dashboard de fanout (sessão 2.4.5):** consultar `customer.conversion_action.status_summary` para mostrar "% de gclid match".
15. **Test events flow:** Google não tem `test_event_code`. Tem **test accounts** (MCC test). UX precisa ensinar.
16. **Não suportar Tag Manager API.** Não suportar sGTM. Co-existir via `order_id` dedup quando cliente já tem Google Tag rodando.
17. **CTWA equivalente Google?** Não existe oficial. Google tem **Lead Form Ads** (Performance Max + DemandGen) que reportam via EC Leads — coberto.
18. **Mercado BR:** Customer Match em BR funciona normal. Google Ads aceita PIX desde 2024 — irrelevante técnico, relevante copy.

---

## Resumo executivo

Antes de codar 2.10:

- **Pinar Google Ads API v24** + env var + per-tenant override.
- **Schema delta P1 em `google_connections`:** 14 colunas novas (granted_scopes, manager_customer_id, login_customer_id_header, developer_token_tier, oauth_client_verification_status, ads_api_version, last_token_refresh_at, refresh_token_invalidated_at, etc.)
- **Criar tabela `google_ads_accounts`** (1:N) — Agency multi-customer não funciona com schema atual.
- **Criar tabela `google_conversion_action_mappings`** — sem mapping, fanout falha 100%.
- **Aplicar OAuth verification + Standard developer token agora**, não pré-launch — timelines somam 4-8 semanas.
- **Spike Data Manager API (2-3h)** antes de fechar scope: UserDataService deprecando para tokens novos em 1-abr-2026.
- **`tracking_events` (em 1.4.A)** ganha `gad_source` e `srsltid` além do `gclid/wbraid/gbraid` já planejado pelo ADR-014.
- **`capi_events`** vira `outgoing_fanout_events` conceitualmente; ganha 9 colunas Google-specific.
- **Consent Mode v2 server-side propagation:** o `consent` field do payload Google Ads é P1 e está ausente em v0.6.

Dívidas/descobertas para o ROADMAP:

- **Customer Match:** sai do MVP, vira feature de plano Agency em Fase 3 (min seed 5k, max life 540d, Data Manager API).
- **GA4 fanout:** sessão nova **2.10.5** (~2h), opcional, off por default.
- **Tag Manager API + sGTM:** decisão "não integrar" precisa entrar em ADR-015 (e na cópia de marketing).

---

## Sugestão de ADR-015

**Sim, escrever ADR-015 separado** (não estender ADR-013).

Justificativa:

1. **Volume de decisões:** 8+ decisões formais de plataforma Google.
2. **Cadência de revisão diferente:** Meta versiona trimestral, Google versiona ~3x ao ano.
3. **Trigger de upgrade diferente:** Meta tem App Review + Business Verification; Google tem OAuth verification + developer token Standard.
4. **Cross-reference limpa:** ADR-014 referencia ADR-013. Adicionar ADR-015 mantém o grafo: ADR-014 → ADR-013 (Meta) + ADR-015 (Google).
5. **Consistência:** se TikTok Events API entrar, vira ADR-016. O padrão "1 ADR por plataforma de fanout" escala.

**Quando escrever:** durante prep de Sessão 2.10 (Fase 2). Decisões evoluem; documentar agora pode virar legacy.
