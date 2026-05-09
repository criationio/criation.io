# Auditoria Meta API / CAPI / Pixel — vs arquitetura v0.6

**Data:** 2026-05-08
**Sessão de origem:** 1.3 (OAuth Meta Ads)
**Conduzida por:** agente de pesquisa (consultor de tracking)
**Fontes:** developers.facebook.com (Marketing API, CAPI, Pixel, AEM, Customer Match, Data Processing Options, Data Deletion Callback) + arquitetura v0.6 + schema atual.

> Este documento substitui referências da arquitetura v0.6 onde houver conflito. Decisões formalizadas em [ADR-013](../adr/ADR-013-meta-platform-2026.md).

---

## 1. Stack Meta correto em 2026

| Produto                                      | Versão / estado atual                                                                                                                                                              | Nota crítica                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Marketing API / Graph API**                | **v24.0** mínima. Deadline 9-jun-2026 para qualquer chamada com versão anterior. v22 e v23 já fora desde set/2025.                                                                 | v0.6 referencia `graph.facebook.com/v18.0/...` — **deprecated há ~2 anos**. Usar `v24.0`.                       |
| **Conversions API (CAPI)**                   | Endpoint estável `/{pixel_id}/events`. Mesmo versionamento da Marketing API.                                                                                                       | OK.                                                                                                             |
| **Meta Pixel**                               | base_code unchanged. `fbq('consent', 'grant'\|'revoke')` é o gate oficial Consent Mode v2. fbp/fbc são plain text, **nunca hashed**.                                               | v0.6 acerta.                                                                                                    |
| **AEM (Aggregated Event Measurement)**       | **Cap de 8 eventos foi REMOVIDO em jun/2025.** Meta agora aceita ilimitados; algoritmo prioriza automaticamente.                                                                   | **v0.6 desatualizada** — wizard "AEM priority order" virou conceito legado.                                     |
| **Customer Match**                           | SHA-256 obrigatório, normalização (lowercase, E.164). Min seed 100 matches; lookalike value-based pede 1000+.                                                                      | v0.6 menciona apenas em 3.12 sem detalhamento — OK para Fase 3.                                                 |
| **Predicted LTV**                            | Não é "API Meta" — input que o anunciante calcula (`value` no Purchase reflete pLTV). Combina com Value-Based Lookalike.                                                           | v0.6 é vaga. Spec deve clarificar: "pLTV = nosso modelo, enviamos como `custom_data.value` quando flag ligada". |
| **LDU / Data Processing Options**            | 3 colunas obrigatórias desde 30-set-2023: `data_processing_options=['LDU']`, `data_processing_options_country=0`, `data_processing_options_state=0` (geolocaliza automaticamente). | v0.6 acerta.                                                                                                    |
| **Consent Mode v2**                          | 4 sinais (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`). Default = **denied**.                                                                          | v0.6 acerta (Sessão 1.14.5).                                                                                    |
| **Domain Verification**                      | Pré-requisito para AEM e qualquer otimização para conversões iOS 14.5+. 3 métodos: meta-tag, HTML upload, **DNS TXT (recomendado)**.                                               | Mencionado mas sem implementação concreta no schema.                                                            |
| **Data Deletion Callback**                   | Webhook obrigatório para apps que pedem permissões com PII. Recebe `signed_request` HMAC-SHA256 com `app_scoped_user_id`. **Bloqueia App Review se ausente.**                      | **Não existe na v0.6 nem no schema.** Gap P1.                                                                   |
| **Marketing API Access Tier** (ex-AMSA)      | Renomeado em mai/2026. Define rate limits e features avançadas.                                                                                                                    | v0.6 não menciona.                                                                                              |
| **CAPI Gateway / CAPI one-click** (abr/2026) | Alternativas hosted da Meta.                                                                                                                                                       | **NÃO usar** — perde controle e diferenciação. Manter implementação direta.                                     |

---

## 2. Gaps de arquitetura

| Gap                                                             | Severidade | Sessão sugerida     | Descrição                                                                                                                                                              |
| --------------------------------------------------------------- | ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versão API hard-coded `v18.0` em pseudo-código                  | **P1**     | 1.4.9               | Trocar para `v24.0` e centralizar em `META_GRAPH_VERSION` env var. Plano de upgrade trimestral documentado.                                                            |
| **Data Deletion Callback endpoint**                             | **P1**     | 1.3                 | Endpoint público `/api/meta/data-deletion` que valida `signed_request` HMAC e enfileira job de purge. Sem isso, App Review nega.                                       |
| **AEM "priority order" mental model obsoleto**                  | P2         | 1.4.9 / wizard CAPI | Reescrever copy do wizard: "Configure os eventos de conversão" sem conceito de top 8. Usar prioridade só como hint visual de funil.                                    |
| Falta `external_id` policy explícita                            | **P1**     | 1.4.9               | Definir source-of-truth: `external_id = sha256(workspace_id + buyer_email)` ou `users.id` quando logado. Alavanca #1 de EMQ depois de email.                           |
| Falta `client_ip_address` + `client_user_agent` no payload CAPI | **P1**     | 1.4.9               | v0.6 só menciona "user_data: { email_hash, phone_hash }". Sem IP+UA, EMQ trava em ~5. Capturar do webhook gateway (não do server da Criation — IP do server é inútil). |
| Falta `event_source_url`                                        | **P1**     | 1.4.9               | Obrigatório para `action_source=website`. Vir do webhook ou inferir via UTM Stitcher.                                                                                  |
| Falta `action_source` enumerado                                 | P2         | 1.4.9               | Mapear: gateway purchase → `website`; Lead manual → `system_generated`; CTWA → `business_messaging`.                                                                   |
| **CTWA (Click-to-WhatsApp) tracking**                           | P2         | 3.12 ou nova 2.x    | Mercado BR de infoprodutor usa MUITO CTWA. Capturar `ctwa_clid` + enviar com `action_source=business_messaging` é diferencial competitivo.                             |
| **Test Events flow** (`test_event_code`)                        | P2         | 1.4.9               | Wizard precisa de modo "teste" antes de produção. Salvar `test_event_code` em `meta_connections` (nullable).                                                           |
| **Dataset Quality API monitoring**                              | P2         | 2.4.5               | Endpoint Meta para puxar EMQ histórico. Dashboard admin deveria consumir isso, não só calcular do nosso lado.                                                          |
| Sem rate limiting / retry budget formal                         | P2         | 1.4.9               | Meta = 1000 events/request, ~2000 calls/h por ad account. Trigger.dev job precisa rate limiter por workspace.                                                          |
| Sem **Business Verification** no fluxo de onboarding            | **P1**     | 1.3                 | App da Criation precisa ser Business-verified e App-Reviewed (ads_management Advanced). Documentar timeline (4-12 semanas) no roadmap.                                 |
| Falta wiring de `partner_agent`                                 | P3         | 1.4.9               | Identifica nossa app no Events Manager. Definir `partner_agent='criation-io-v1'`.                                                                                      |
| Sem tabela de **deduplicação cross-channel**                    | P2         | 1.4.9               | Mesmo Purchase chega via Pixel (browser) e CAPI (server). `event_id` resolve no Meta, mas não temos audit trail nosso para quando dedupe falha.                        |

---

## 3. Gaps de schema

### `meta_connections` — adicionar

- `pixel_access_token` (encrypted) — separado do user token; preferir System User Token (não expira) sobre user token (60d).
- `system_user_id` + `is_system_user_token boolean` — marca quando token é estável.
- `business_verification_status` (enum: `not_started`/`pending`/`verified`/`rejected`).
- `app_review_status` + `granted_scopes jsonb` — usuário pode negar parcialmente; registrar.
- `domain_verification_status jsonb` (mapping `domain → verified|pending`).
- `aem_config_url` ou flag `events_configured_at` — confirmação de setup no Events Manager.
- `test_event_code` (text, nullable, encrypted opcional).
- `last_token_refresh_at`, `token_refresh_failures int`.
- `marketing_api_version text default 'v24.0'` — permite per-tenant pinning.
- `partner_agent text` (default global na config).
- **Ad account não é único.** Schema permite só 1 ad_account por workspace. Agências querem múltiplos. Criar `meta_ad_accounts` 1:N abaixo.

### `capi_events` — adicionar (várias **P1**)

- `event_source_url text` — obrigatório para website events.
- `action_source text not null` — enum-like.
- `client_ip_address inet` (em claro — Meta dedupa por IP).
- `client_user_agent text` (claro).
- `fbc text`, `fbp text` (claro, NÃO hashear).
- `external_id_hash text` — separado de `user_data` jsonb para indexação.
- `data_processing_options jsonb` + `data_processing_options_country smallint` + `data_processing_options_state smallint`.
- `opt_out boolean default false`.
- `pixel_id text not null` — qual pixel recebeu (cliente pode ter múltiplos).
- `partner_agent text`, `test_event_code text`.
- `attribution_window text` (1d_click, 7d_click, etc — para auditoria).
- `dedup_status text` (enum `unique`/`duplicate_with_pixel`/`unknown`) preenchido por job que consulta Dataset Quality API.
- `messaging_channel text`, `ctwa_clid text` (para CTWA).
- **Particionar por mês** — sem partição → tabela explode em 6 meses.

### `click_id_store` — adicionar

- `fbc text` — versão completa formatada `fb.1.{ts}.{fbclid}`. Hoje só guardamos `fbclid` cru; precisamos do `fbc` formatado para enviar ao CAPI.
- `fbp text` — captura também o `_fbp` da request quando disponível.
- `wbraid text`, `gbraid text` (Google iOS click IDs novos).
- `ctwa_clid text`.
- `fbclid_seen_at timestamptz` — Meta rejeita fbclid > 90d.
- `landing_referer text`.
- `consent_state jsonb` no momento da captura.
- TTL deve ser **enforced server-side** (job de cleanup), não só cookie 90d.

### Nova tabela `meta_data_deletion_requests`

```
id, signed_request_payload jsonb, app_scoped_user_id text, status,
processed_at, confirmation_code text, request_url text, created_at
```

**P1 — sem isso App Review é negado.**

### Nova tabela `meta_ad_accounts` (1:N de `meta_connections`)

Cliente típico tem múltiplos pixels e ad accounts (testes, prod, conta espelho). Schema atual força 1.

---

## 4. Riscos críticos (App Review / bloqueio Meta)

1. **Sem Data Deletion Callback** → App Review reprovada. **P1, fix antes do submit.**
2. **Pedindo `ads_management` (Advanced) sem Business Verification** → submit recusado automaticamente.
3. **`v18.0` em código** → Meta retorna 400 desde set/2025; chamadas falharão silenciosamente em prod.
4. **Token storage** — user tokens expiram 60d. Sem refresh, app quebra para todo cliente em 60d.
5. **EMQ baixo crônico** — sem `client_ip_address`, `client_user_agent`, `external_id`, `fbc`, `fbp` enviados, EMQ máximo é ~5.
6. **PII em logs** — Sessão 1.14.5 pega isso, mas Sessão 1.4.9 (que vem antes em ordem) precisa do mesmo cuidado.
7. **Domain verification não automatizada** — cliente esquece e descobre 30d depois com CPA dobrado.
8. **Hard-cap 1000 events/request** — sem batching, Black Friday quebra.
9. **Webhook do gateway sem IP/UA** — validar parser. Se não vier, capturar via Pixel client-side no checkout-iniciado.
10. **fbclid > 90d** — Meta rejeita silenciosamente. Job de match precisa filtrar por idade do click.

---

## 5. Compliance LGPD / iOS 14+

**LDU (formato exato — Meta atual):**

```json
{
  "data_processing_options": ["LDU"],
  "data_processing_options_country": 0,
  "data_processing_options_state": 0
}
```

`0/0` = Meta geolocaliza. `1/1000` força "US, todos estados".

- **LDU é Meta-only** — não cobre LGPD por si. Para BR: **não envie a request** quando consent revogado, OU envie com user_data sem PII (só fbp/fbc/external_id_hash). v0.6 (linha 5185) acerta.

**AEM:** cap de 8 não existe mais. **Domain verification continua obrigatória** para qualquer otimização web em iOS.

**ATT prompt iOS:** Criation não tem app iOS própria. Não precisamos. Mas cliente tem que entender que browsers iOS já vivem com signal degradado independente do que façamos.

**Data Subject Rights LGPD:**

- Endpoint público de erasure (separado do Meta callback).
- Job que limpa `gateway_events.buyer_email_hash` e relacionados em N dias.
- Auditar `consent_logs` para responder "minha base legal era qual?".

---

## 6. Integração GTM server-side — vale ou não?

**Recomendação: NÃO usar GTM SS para o produto Criation.**

| Aspecto                      | CAPI direto                                   | GTM Server-side                                     |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Custo de infra               | Zero adicional                                | $50-150/mês container hosted                        |
| Latência                     | 1 hop                                         | 2 hops                                              |
| Controle de payload          | Total                                         | Mediado por templates GTM                           |
| Multi-platform fan-out       | Implementação própria, ~1 sessão              | Built-in                                            |
| Observabilidade              | Nossa stack (capi_event_log, dashboard 2.4.5) | UI do GTM, fora do produto                          |
| Diferenciação para o cliente | "tracking premium incluído"                   | "ainda dá pra fazer no GTM, por que pago Criation?" |

CAPI direto **é a feature do produto.** GTM SS seria útil só se Criation fosse setup de agência manual — mas como SaaS multi-tenant, GTM SS é a antithesis (1 container por cliente vira pesadelo operacional).

**Edge case:** se cliente exige GTM SS (já paga Stape), Criation **co-existe**: aceitar mesmo `event_id` em ambos canais e Meta dedupa. Não bloqueamos, mas não vendemos.

---

## 7. Recomendações concretas para Sessão 1.3 (OAuth Meta — agora)

Para evitar retrabalho em 1.4 e 1.4.9:

1. **Scopes corretos:** `ads_read`, `ads_management`, `business_management`, `read_insights`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `email`, `public_profile`. **Não pedir** `pages_manage_ads` no MVP.

2. **Capturar Advanced Access:** chamar `/me/permissions` logo após token exchange. Persistir em `meta_connections.granted_scopes jsonb`. Se `ads_management` veio standard, marcar `tier='standard'` e mostrar warning.

3. **System User Token upgrade flow:** doc rápido no wizard "para tokens estáveis (60d → permanente), conecte via Business Manager". Schema deve suportar (`is_system_user_token boolean`).

4. **Listar TODOS os ad accounts e pixels do BM** — não só o primeiro. Tela pós-OAuth deixa cliente escolher (ou todos). Schema 1:N (`meta_ad_accounts`).

5. **Capturar businesses + domains verified do BM:** `/me/businesses?fields=verification_status,owned_domains{verified}`. Persistir em `business_verification_status` e `verified_domains jsonb`.

6. **Capturar pixel(s) e CAPI access token:** `/{pixel_id}?fields=name,creation_time,id,last_fired_time,owner_business`. Confirma permissão de escrita.

7. **Token refresh job** — agendar refresh a cada 30d (60d expiry, 30d safety). Falha → status `expired` + email cliente. **Implementar agora**, não em 1.4.9.

8. **Encryption envelope KEK/DEK** — schema já tem `encryption_key_version`. Confirmar que decrypt suporta versões antigas. Testar em 1.3.

9. **Endpoints que valem capturar e cachear no callback:**
   - `/me/businesses`
   - `/{business_id}/owned_ad_accounts`
   - `/{business_id}/owned_pixels` ou `/{ad_account}/adspixels`
   - `/{business_id}/owned_domains`
   - `/me/permissions`
   - `/{pixel_id}/dataset_quality?period=...` (opcional)

10. **Marketing API version pinning:** `META_GRAPH_VERSION=v24.0` env var, e `meta_connections.marketing_api_version` para per-tenant override. Code reviews bloqueiam strings literais de versão.

11. **Data Deletion Callback URL** — deixar endpoint criado e respondendo (`POST /api/meta/data-deletion`) com handler mínimo + signed_request validation. Sem isso, App Review trava no submit.

12. **Domain verification UX** — adicionar tela "domínios detectados" pós-OAuth, marcando quais já estão verified.

13. **Telemetria:** logar `criation_oauth_meta_completed` com `granted_scope_count`, `ad_account_count`, `pixel_count`, `domains_verified_count`.

14. **Não confiar em `me?fields=email`** — não fazer match silencioso; mostrar e pedir confirmação.

---

## Resumo executivo

Antes do merge da 1.3:

- Trocar `v18.0` por `v24.0` em qualquer pseudo-código herdado.
- Schema `meta_connections`: adicionar `granted_scopes`, `system_user_id`, `is_system_user_token`, `business_verification_status`, `verified_domains`, `marketing_api_version`, `last_token_refresh_at`.
- Criar tabela `meta_ad_accounts` (1:N).
- Criar tabela `meta_data_deletion_requests` e endpoint `/api/meta/data-deletion`.
- Capturar IP/UA dos webhooks de gateway desde o dia 1.
- Reescrever a parte "AEM priority order" da v0.6 — o cap de 8 morreu em 2025.
