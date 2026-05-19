# ADR-016 — Decisões de plataforma Hotmart (2026)

**Status:** Aceito (revisado 2026-05-09 com simplificação MVP — ver §"Revisão MVP")
**Data:** 2026-05-09
**Sessão:** 1.4.5 (Gateway adapter base + Hotmart integration) — antes de codar

## Revisão MVP (2026-05-09, mesmo dia)

Após implementação inicial, fundador identificou que o fluxo de cliente ficou complexo demais para o MVP (3 credenciais a copiar, smoke test bloqueante, wizard 3 telas). **Decisão:** simplificar para usar apenas o webhook (sem REST API/OAuth) na 1.4.5; reativar REST quando alguém pedir backfill ou quando MRR/churn dashboard precisar de leitura proativa de subscriptions.

**Mudanças:**

- Removido OAuth client_credentials, REST client (`/sales`, `/subscriptions`, `/products`), throttler, smoke test, backfill 90d task.
- Adapter `GatewayAdapter` mantém interface estável; métodos `fetchAccessToken/fetchSalesHistory/fetchSubscriptions/fetchProducts` viraram **opcionais** (HotmartAdapter MVP não implementa).
- Wizard reduzido para **1 tela**: cliente cola HOTTOK, sistema devolve URL gerada, cliente registra no painel postback.
- `connectHotmart` action: input `{hottok, sandbox}` apenas. Sem validação prévia da credencial — primeiro webhook que chega valida.
- Schema mantido (colunas `apiCredentials`, `provider_subaccount_id` ficam para evolução futura).

**Trade-offs aceitos:**

- ❌ Sem backfill 90d (cliente começa do "agora")
- ❌ Sem sync proativa de subscriptions inativas (`OVERDUE`/`DELAYED` sem evento ativo continuam invisíveis até cliente cancelar — TD-040 polling adia mais ainda)
- ❌ Sem validação prévia de credencial — cliente só descobre que errou se nenhum webhook chega
- ✅ Setup em 30 segundos
- ✅ Cliente não precisa criar OAuth credential no painel dev
- ✅ Reduz superfície de código em ~600 LOC

Quando reativar REST: implementar `fetchAccessToken`+`fetchSalesHistory` no `hotmartAdapter`, adicionar wizard secundário "Importar histórico" que pede Client ID/Secret, expor backfill task. Toda a infraestrutura de tipos já existe.

---

## Contexto

Auditoria de plataforma Hotmart realizada em 2026-05-09 (ver [docs/audits/HOTMART_API_2026-05.md](../audits/HOTMART_API_2026-05.md)) mapeou o stack atual (Postback v1/v2, REST API por domínio versionado, OAuth client*credentials, painel de webhooks) versus o que a v0.6 §3.2 e o schema atual `gateway*\*` comportam. Foram identificados 17+ riscos práticos, dos quais 4 são P1 (bloqueiam o webhook funcionar ou geram retrabalho de semanas):

1. `gateway_connections.webhook_secret_hash` impossibilita HMAC. Para validar `x-hotmart-signature` ou `x-hotmart-hottok` precisamos do secret em **plain cifrado**, não hash.
2. Postback v2 traz envelope estruturado + `event.id` UUID (idempotência forte); v1 é form-urlencoded plano sem id confiável. Adapter precisa suportar ambos mas onboarding deve forçar v2.
3. Renovação de subscription **não emite evento próprio** — vem como `PURCHASE_APPROVED` com `recurrence_number > 1`. Lógica de créditos precisa diferenciar para alocar no ciclo da subscription, não como nova venda.
4. Hotmart é **fraco em UTM tracking**. Renovação não carrega UTMs novas (herda da venda inicial). Sem mecanismo de matching determinístico via `xcode = visitor_id`, atribuição degrada para probabilística em casos de checkout direto.

Esta ADR formaliza decisões e é o **template para ADR-017 (Kiwify), ADR-018 (Eduzz), ADR-019 (Monetizze), ADR-020 (Ticto)** — sessões 1.4.6 e 1.4.7 herdam o mesmo `GatewayAdapter` interface + `NormalizedGatewayEvent` schema.

## Drivers de decisão

- Webhook funcional em < 5 minutos do "colei credencial" do cliente.
- Idempotência forte para sobreviver a 5 retries automatic do Hotmart sem dup de crédito.
- Cobertura de matching visitor↔buyer alta o suficiente para 1.4.B/1.4.9 entregarem CAPI fanout com EMQ aceitável.
- Reuso para 1.4.6/1.4.7: 4 outros adapters herdam interface; investimento agora paga 4x.
- Conformidade LGPD em PII de buyer (email, CPF, telefone, endereço).
- Compatibilidade com clientes legados ainda em Postback v1.

## Opções consideradas

### 1. Postback version strategy

a. Suportar só v2; cliente legado precisa migrar manualmente no painel.
b. Suportar v1 e v2; onboarding força v2 (default), v1 detectado e processado com warning visual.
c. Suportar só v1 (mais comum em contas antigas); skipa v2.

**Escolhido:** (b). v2 é a base (envelope + `event.id` UUID + `tracking.external_code`). v1 fica em `legacyParser.ts` isolado, com flag de warning no admin se cliente registrou v1. Forward path: deprecar v1 quando todos os clientes tiverem migrado (data não agendada).

### 2. Validação de assinatura

a. Confiar só em `payload.hottok` (campo no JSON) e ignorar headers HMAC.
b. Validar **ambos**: HOTTOK no payload + HMAC `x-hotmart-signature`/`x-hotmart-hottok`. Aceita se qualquer um bate; fail closed se nenhum valida.
c. Confiar só em HMAC header (mais seguro, mas algumas contas antigas não enviam o header).

**Escolhido:** (b). Documentação Hotmart é vaga sobre quando cada modo é enviado; comunidade reporta os dois coexistindo. Defesa em camadas: tenta HOTTOK primeiro (mais barato), HMAC depois. **HMAC validado contra o raw body string**, não contra `JSON.stringify(parsed)` — causa #1 de signature mismatch em integrações Node.

### 3. Webhook secret storage

a. Manter `webhook_secret_hash` (atual) e fazer "comparar hash" — funciona só para HOTTOK-no-payload.
b. Substituir por `webhook_secret` em **plain cifrado** (`encrypt()` versionado, decryptable em runtime para HMAC).
c. Usar Vault externo (HashiCorp Vault, AWS Secrets Manager) para o secret.

**Escolhido:** (b). Single-key AES-256-GCM versionada (ADR-010 + `src/lib/encryption.ts`) já é segura para o estágio. Vault externo é overkill para piloto. Migração aditiva: PR (a) adiciona `webhook_secret`, PR (b)/(c) remove `webhook_secret_hash` quando 1.4.6 confirmar pattern. **Bloqueia HMAC sem isso.**

### 4. Visitor↔Buyer matching mechanism

a. Confiar só em `xcode = visitor_id` injetado no link de checkout. Determinístico, mas falha quando cliente compartilha link sem nosso script tocar (Hotmart Pages, link copy-paste).
b. UTM Stitcher por janela temporal — correlaciona `gateway_event` com `tracking_event` recente do mesmo email/IP. Probabilístico, falha em compras de invitados.
c. **Defesa em camadas**: `xcode = visitor_id` primário (quando disponível) + UTM Stitcher como fallback. Implementado por 1.4.B.

**Escolhido:** (c). `xcode` cabe no limite 30 chars usando `nanoid(20)`. Quando presente, matching é 1:1. Quando ausente (Hotmart Pages, link bruto), Stitcher tenta janela 30min. Cobertura esperada: 70-85% determinístico + 10-20% probabilístico = ~95% atribuído.

### 5. Refund parcial em créditos

a. Revoke proporcional: se 50% reembolsado, revoga 50% dos créditos.
b. All-or-nothing: só revoga em `PURCHASE_REFUNDED` total. Parcial é log-only.
c. Adiar decisão e não tratar parcial agora.

**Escolhido:** (b). Hotmart **não tem evento webhook dedicado para parcial** — chega como `PURCHASE_REFUNDED` ambigüo (precisa comparar `price.value` vs original). MVP não tem caso real ainda; revisitar com cliente beta. TD-045 documenta backlog.

### 6. Subscription state: tabela materializada vs event-sourced

a. Tudo em `gateway_events`; calcular subscription state on-demand.
b. Tabela `gateway_subscriptions` materializada, sincronizada por `processGatewayEvent`.

**Escolhido:** (b). Dashboards de MRR, churn rate, renovações ativas precisam de leitura barata. Scan de `gateway_events` por workspace + group by subscriber_code escala mal. Custo de manter materialização: 1 UPSERT por webhook. Vale a troca.

### 7. Wizard de webhook registration

a. Construir Chrome extension que automatiza registro no painel Hotmart.
b. Cliente registra manualmente no painel; nós entregamos URL + Loom passo-a-passo.
c. Pedir cliente para mandar prints + ajudar via suporte.

**Escolhido:** (b). Hotmart **não tem API pública para criar webhook** programaticamente. Extension exige instalação + manutenção contínua quando UI Hotmart muda. Loom + URL copy-paste é padrão de mercado (Stape, Triplewhale fazem assim). Revisitar se beta reclamar.

### 8. Sandbox vs prod smoke test

a. Só sandbox no smoke test (sem custo, sem risco).
b. Sandbox para validação OAuth + webhook ping; prod com R$ 5 + reembolso imediato para smoke real.
c. Só prod, sem sandbox.

**Escolhido:** (b). Sandbox Hotmart tem cobertura parcial (não cobre Sparkle affiliate flow, refund flow completo). Smoke real **obriga** transação R$ 5 — é o teste que pega problema de conta em verificação KYC pendente. Documentado em onboarding.

### 9. OAuth token caching

a. Sem cache; cada request troca credencial.
b. Cache em memória (LRU) + Redis Upstash com TTL 23h por workspace.
c. Persistir token cifrado em DB com TTL 23h.

**Escolhido:** (b). Token TTL 24h, sem refresh_token. Cache memória (per-instance) reduz latency crítica; Redis serve para fan-out entre instances Vercel. DB persistence é overkill para algo que dura 1 dia. TTL 23h conservador (1h margem).

### 10. Backfill 90d strategy

a. Sync cíclíco no `processGatewayEvent` (cada webhook puxa histórico se faltando).
b. Trigger.dev one-shot ao conectar, pulled via cursor pagination, INSERT ON CONFLICT DO NOTHING.
c. Não fazer backfill; começar do "agora".

**Escolhido:** (b). One-shot é controlável, throttler 8 req/s respeita rate limit Hotmart 500/min global, e o estado fica "ligado para frente" sem intercalar com webhooks live. Backfill marca `allocation_status='backfill_skipped'` — **não aloca créditos retroativos** (v0.6 §4 explicit; créditos só contam para vendas a partir do conectar).

## Decisão

**Plataforma:**

- **Postback v2** como default; v1 suportado em `legacyParser.ts` com warning admin.
- **Dual signature validation:** HOTTOK no payload + HMAC `x-hotmart-signature`/`x-hotmart-hottok`. `timingSafeEqual` em ambos. Validar HMAC contra **raw body**, nunca re-stringified.
- **OAuth client_credentials** via `POST https://api-sec-vlc.hotmart.com/security/oauth/token`. TTL 24h, sem refresh. Cache LRU memória + Redis Upstash key `hotmart:oauth:${workspaceId}` TTL 23h. Sandbox e prod não intercambiáveis (credencial gerada em um modo nunca funciona no outro).
- **Rate limit:** 500 req/min por credencial **global**. Throttler Redis sliding window 8 req/s por `client_id` para evitar 429 em backfill paralelo.
- **REST API por domínio versionado:** `/payments/api/v1/sales/...`, `/subscription/rest/v1/...`, `/product/rest/v2/...`. Adapter mapeia endpoint→versão por domínio (não assume versão global).
- **Eventos MVP processados:** `PURCHASE_APPROVED`, `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `SUBSCRIPTION_CANCELLATION`, `PURCHASE_OUT_OF_SHOPPING_CART`, `PURCHASE_BILLET_PRINTED`, `PURCHASE_DELAYED`, `PURCHASE_EXPIRED`. Demais eventos persistem em `gateway_events` com `processedAt` set sem ação.
- **Renovação de subscription:** detectada por `recurrence_number > 1` no `PURCHASE_APPROVED`. Aloca créditos para o ciclo novo da subscription, não como nova venda. Atribuição herda da venda inicial (`gateway_subscriptions.origin`).
- **PII redaction:** parser hasheia email/document/phone **antes** do INSERT em `gateway_events.raw_payload`. Plain só vive em memória do parser. Logger pino redact list expandida.

**Schema deltas (Sessão 1.4.5):**

- `gateway_connections`: adicionar `webhook_secret text` (cifrado plain), `api_credentials jsonb` (`{client_id, encrypted_client_secret, sandbox, basic_token?}`), `webhook_version text default 'v2'`, `provider_subaccount_id text`, `last_webhook_event_at timestamptz`, `last_webhook_event_id text`, `webhook_failures_24h integer default 0`. Marcar `webhook_secret_hash` `@deprecated` (purge em PR (b)/(c) na 1.4.6).
- `gateway_events`: adicionar `provider_event_version`, `recurrence_number`, `subscriber_code`, `subscription_status`, `plan_id`, `payment_method`, `installments_number`, `fee_cents`, `producer_net_cents`, `commission_affiliate_cents`, `affiliate_email_hash`, `affiliate_source`, `origin jsonb`, `external_code`, `buyer_country`, `buyer_document_hash`, `creation_date_ms bigint`, `allocation_status text default 'pending'`, `allocation_idempotency_key text`.
- `gateway_products`: adicionar `ucode text`, `format text`, `is_subscription boolean`, `warranty_days integer`, `default_currency text`.
- Nova tabela `gateway_subscriptions`: `id`, `workspace_id`, `connection_id`, `subscriber_code`, `plan_id`, `product_id`, `status` (`ACTIVE`/`CANCELLED`/`OVERDUE`/`DELAYED`), `accession_date`, `end_accession_date`, `next_charge_date`, `current_recurrence integer default 1`, `cancellation_reason text`, `monthly_value_cents integer`, `currency text`, `origin jsonb` (snapshot da venda inicial), `identified_visitor_id text`, timestamps. UNIQUE `(workspace_id, connection_id, subscriber_code)`.

**Adapter pattern (genérico para 1.4.6/1.4.7):**

- `src/lib/services/gateways/types.ts`: `GatewayAdapter` interface, `NormalizedGatewayEvent`, `NormalizedSubscription`, `NormalizedProduct`, `GatewayCredentials`.
- `src/lib/services/gateways/hotmart/`: `HotmartAdapter implements GatewayAdapter`. Kiwify/Eduzz/Monetizze/Ticto criam pasta irmã e implementam só `validateSignature` + `parseWebhook` + `normalizeEvent`.

**Endpoint webhook único:**

- `POST /api/webhooks/gateway/[provider]/[connection_id]` — provider routing no controller, valida assinatura via adapter, dedup via `processed_webhook_events` UNIQUE `(provider, event_id)`, INSERT em `gateway_events`, enfileira Trigger.dev `processGatewayEvent`. Retorna 200 em < 5s **sempre** (Hotmart abandona após 5x retry).

**Wizard UX:**

- 3 telas: (1) "gere credenciais aqui" (link `app.hotmart.com/tools/dev-credentials`) + Loom 30s; (2) cole 3 fields + smoke test; (3) "registre webhook aqui" (link `app-postback.hotmart.com`) com URL copy-paste + Loom passo-a-passo. **Manual.** Não automatizável — Hotmart não tem API para criar webhook.

## Consequências

**Positivo:**

- Sessão 1.4.5 entrega webhook funcional com idempotência forte e PII compliance.
- 1.4.6 (Kiwify), 1.4.7 (Eduzz/Monetizze/Ticto) reusam interface; cada adapter ~200 LOC.
- 1.4.B (Visitor↔Buyer matching) tem `external_code` no payload para fechar o loop determinístico.
- 1.4.9 (CAPI fanout) recebe `gateway_events` com PII pre-hashed pronta para Meta CAPI Conversions API.

**Negativo:**

- Sessão 1.4.5 cresce de ~5h para ~6-7h (schema migration aditivo + dual signature + tabela `gateway_subscriptions` + wizard 3 telas + Loom embed placeholders).
- `webhook_secret_hash` legacy deprecado precisa de PR (b)/(c) cleanup na 1.4.6.
- Wizard 100% manual gera fricção; aceitável para piloto, revisitar para escala.
- Single-key encryption permanece (consistente com ADR-013 dec.5); migração envelope adiada para 2.15.5.

**Coisas que não decidimos aqui (TODO):**

- **TD-040**: Polling OVERDUE 1x/dia — cartão recusado em renovação não emite webhook. Sem isso, churn por falha de pagamento só detectado quando cliente cancela ativamente.
- **TD-041**: Sparkle deep attribution + UI no dashboard — quando afiliado Sparkle ganha comissão, quem aparece como "fonte da venda" (UTM cliente vs afiliado)?
- **TD-042**: Hotmart Club events (`CLUB_FIRST_ACCESS`, `CLUB_MODULE_COMPLETED`) → CAPI Custom Events para engagement.
- **TD-043**: Coupons API integration (Fase 2 — dashboards de pricing).
- **TD-044**: Multi-moeda display conversion (BRL/USD/EUR → BRL no dashboard com câmbio de display).
- **TD-045**: Partial refund proportional credit revoke (revisitar com casos reais do beta).
- **TD-046**: Purge job `gateway_events_dlq` retention 30d (PII compliance).
- **TD-047**: Renovação failed-payment detection via API REST polling.
- **TD-048**: PR (b)/(c) — remover `webhook_secret_hash` deprecated da `gateway_connections`.

## Referências

- [docs/audits/HOTMART_API_2026-05.md](../audits/HOTMART_API_2026-05.md) — auditoria detalhada (495 linhas)
- [ADR-003](./ADR-003-gateway-como-fonte-da-verdade.md) — gateway como fonte canon de receita
- [ADR-005](./ADR-005-utm-stitcher-cascata.md) — UTM Stitcher cascade strategy (1.4.8)
- [ADR-010](./ADR-010-envelope-encryption-kek-dek.md) — encryption strategy (relacionado, dívida adiada)
- [ADR-013](./ADR-013-meta-platform-2026.md) — Meta platform decisions (mesmo formato)
- [ADR-014](./ADR-014-criation-as-cdp.md) — Criation como CDP, sustenta `xcode = visitor_id`
- v0.6 §3.2, §4.0–§4.16 — modelo de créditos consumido por `processGatewayEventTask`
- [ROADMAP.md](../../ROADMAP.md) — sessões 1.4.5–1.4.9, 1.7.5 referenciam esta ADR
