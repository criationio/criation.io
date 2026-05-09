# ADR-013 — Decisões de plataforma Meta (2026)

**Status:** Aceito
**Data:** 2026-05-08 (atualizado 2026-05-09: v24 → v25 após Meta promover v25 a GA durante a Sessão 1.3)
**Sessão:** 1.3 (OAuth Meta Ads) — antes de codar

## Contexto

Auditoria realizada em 2026-05-08 (ver [docs/audits/META_API_2026-05.md](../audits/META_API_2026-05.md)) comparou o que a documentação Meta atual exige versus o que a arquitetura v0.6 especifica e o que o schema atual comporta. Foram identificados 14+ gaps, dos quais 6 são P1 (bloqueiam launch ou geram retrabalho de semanas).

A v0.6 referencia `Marketing API v18.0` em pseudo-código (deprecated desde set/2025), descreve o conceito "AEM priority order" (cap de 8 eventos foi removido em jun/2025), e omite o **Data Deletion Callback** que é obrigatório para App Review da Meta.

Esta ADR formaliza as decisões de plataforma para evitar que sessões futuras incidam nos mesmos erros.

## Drivers de decisão

- App Review da Meta sem retrabalho (alguns gates bloqueiam o submit).
- EMQ ≥ 7.0 sustentável (meta da arquitetura).
- Estabilidade dos tokens OAuth (user token expira em 60d).
- Suporte a clientes Agency com múltiplos ad accounts e pixels.
- Conformidade LGPD + iOS 14+ (LDU, Consent Mode v2).
- Diferenciação competitiva no mercado BR de infoprodutor (CTWA).

## Opções consideradas

### 1. Marketing API version pinning

a. Hard-code `v25.0` em código → manutenção manual a cada release Meta.
b. Env var `META_GRAPH_VERSION` central + per-tenant override em `meta_connections.marketing_api_version` → upgrade trimestral controlado.
c. Sempre usar última versão dinâmica → risco de breaking change não testado.

**Escolhido:** (b). Trimestral é a cadência Meta de releases; dá tempo para testar em staging.

### 2. Multi ad-account por workspace

a. Manter 1:1 (`meta_connections.ad_account_id`) e refatorar quando Agency entrar (Fase 3).
b. Tabela `meta_ad_accounts` separada (1:N abaixo de `meta_connections`) desde já.

**Escolhido:** (b). Custo agora ~30min de schema; refatorar depois com clientes em produção é vetado pela regra 16 (migrations zero-downtime).

### 3. Token type strategy

a. Apenas user OAuth tokens (60d, requer refresh).
b. System User Token (SUT, não expira) preferido, com fallback para user token.

**Escolhido:** (b). Schema marca `is_system_user_token boolean`. UI sugere SUT mas aceita user token. Refresh automático para user token implementado em 1.3 (não 1.4.9), via Trigger.dev task com cron 30d (margem antes do vencimento de 60d).

### 4. Data Deletion Callback

a. Implementar handler completo na 1.3.
b. Implementar stub (validação `signed_request` + insert em `meta_data_deletion_requests`) na 1.3, processamento real depois.
c. Adiar para sessão de hardening.

**Escolhido:** (b). Stub respondendo é suficiente para App Review submit. Job de processamento (purge real de PII associada ao `app_scoped_user_id`) entra junto com DPIA-LGPD em 3.13.5.

### 5. Encryption envelope (KEK/DEK)

ADR-010 prevê envelope encryption como migração obrigatória "antes da Sessão 1.3 (primeiro token OAuth persistido)". Implementação atual é single-key versionada (`encryption.ts`).

a. Bloquear 1.3 e migrar agora.
b. Seguir com single-key versionada e migrar em 2.15.5 ou 3.11.5 (hardening / DR runbook).

**Escolhido:** (b). Single-key AES-256-GCM com versionamento já é seguro para o estágio. Migração envelope vira tarefa de 2.15.5 (threat model + hardening). Riscos: nenhum cliente em produção até lá; rotação de chave manual ainda funciona via `ENCRYPTION_KEY_V1`.

### 6. AEM mental model

a. Manter wizard "priority order" da v0.6 (top 8 eventos).
b. Reescrever wizard como "Configure os eventos de conversão" sem cap, prioridade vira hint visual de funil.

**Escolhido:** (b). Cap removido em jun/2025; manter UX legada confunde cliente.

### 7. GTM Server-side container

a. Suportar como alternativa nativa.
b. Não suportar; CAPI direto é a feature do produto. Co-existir se cliente trouxer GTM SS dele (Meta dedupa por `event_id`).

**Escolhido:** (b). GTM SS é antithesis de SaaS multi-tenant.

## Decisão

**Plataforma:**

- **Marketing API v25.0** mínima. Env var `META_GRAPH_VERSION=v25.0` + `meta_connections.marketing_api_version` para per-tenant override. Code review bloqueia strings literais de versão.
- **Scopes pedidos:** `ads_read`, `ads_management`, `business_management`, `read_insights`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `email`, `public_profile`. **Não pedir** `pages_manage_ads` no MVP.
- **Persistir scopes concedidos** em `meta_connections.granted_scopes jsonb` — usuário pode negar parcial.
- **partner_agent global:** `criation-io-v1`. Identifica nossa app no Events Manager e ajuda Dataset Quality.
- **Data Deletion Callback:** endpoint `/api/meta/data-deletion` validando `signed_request` HMAC com App Secret. Stub responde 200 + `confirmation_code`; processamento real (purge de PII por `app_scoped_user_id`) entra em 3.13.5.

**Schema deltas (Sessão 1.3):**

- `meta_connections`: adicionar `granted_scopes jsonb`, `system_user_id text`, `is_system_user_token boolean default false`, `business_verification_status text`, `verified_domains jsonb`, `marketing_api_version text default 'v25.0'`, `last_token_refresh_at timestamptz`, `token_refresh_failures int default 0`, `partner_agent text default 'criation-io-v1'`.
- Nova tabela `meta_ad_accounts` (1:N de `meta_connections`): `id`, `connection_id` FK, `ad_account_id text`, `name`, `business_id`, `currency`, `timezone_name`, `account_status int`, `is_default boolean`, `created_at`, `updated_at`, `deleted_at`.
- Nova tabela `meta_data_deletion_requests`: `id`, `app_scoped_user_id text`, `signed_request_payload jsonb`, `confirmation_code text`, `status` (`pending`/`processing`/`completed`/`failed`), `processed_at`, `created_at`. Sem RLS (endpoint público).

**Schema deltas (Sessão 1.4.9 — apontados, não implementados agora):**

- `capi_events`: `event_source_url`, `action_source`, `client_ip_address inet`, `client_user_agent`, `fbc`, `fbp`, `external_id_hash`, `data_processing_options jsonb` + `_country` + `_state`, `opt_out`, `pixel_id`, `partner_agent`, `test_event_code`, `attribution_window`, `dedup_status`, `messaging_channel`, `ctwa_clid`. Particionamento mensal.
- `click_id_store`: `fbc text` formatado, `fbp`, `wbraid`, `gbraid`, `ctwa_clid`, `fbclid_seen_at`, `landing_referer`, `consent_state jsonb`. Job de cleanup TTL.

**Token refresh strategy:**

- User token (60d): refresh job Trigger.dev cron 30d (margem 50%). Falha 3x consecutivas → `status='expired'` + email cliente.
- System User Token: não expira. Renovação só se cliente regenerar manualmente no Business Manager.

**Multi ad-account UX:**

- Pós-OAuth, callback lista TODOS os ad accounts e pixels do BM via `/me/businesses` + `/{business_id}/owned_ad_accounts` + `/{business_id}/owned_pixels`.
- Tela picker em `/(onboarding)/bem-vindo/meta/escolher-conta` permite seleção múltipla (checkboxes).
- Primeira selecionada vira `is_default=true`.

**Integração GTM Server-side:**

- Não oferecida como produto. Co-existência aceita: aceitar mesmo `event_id` em ambos canais; Meta dedupa.

## Consequências

**Positivo:**

- Sessão 1.4.9 (CAPI sender) entra com schema pronto para EMQ ≥ 7.0.
- App Review submit não trava por falta de Data Deletion endpoint.
- Agências funcionam desde Fase 1 (multi ad-account).
- Refactor evitado: `marketing_api_version` permite upgrade gradual quando v25.0 sair.

**Negativo:**

- Sessão 1.3 cresce de ~3h para ~5h (schema migration + Data Deletion stub + multi-account picker + token refresh job).
- Ainda dependemos de Business Verification (Criation app) que tem timeline 4-12 semanas — adicionar ao README e ao ROADMAP como item bloqueante para go-live.
- Single-key encryption permanece até 2.15.5; aceitável para ≤ 50 clientes piloto.

**Coisas que não decidimos aqui (TODO):**

- Suporte a CTWA (Click-to-WhatsApp) — diferencial BR, mas pode entrar em sessão dedicada na Fase 2 ou 3.12.
- Dashboard Quality API integration — em 2.4.5.
- App Review submission timeline — depende de Business Verification.

## Referências

- [docs/audits/META_API_2026-05.md](../audits/META_API_2026-05.md) — auditoria detalhada
- [ADR-010](./ADR-010-envelope-encryption-kek-dek.md) — encryption strategy (relacionado, dívida adiada)
- v0.6 §1.4.9, §3.12, §1.14.5 — seções de tracking que recebem updates
- [ROADMAP.md](../../ROADMAP.md) — sessões 1.3, 1.4.9, 2.4.5, 3.12 referenciam esta ADR
