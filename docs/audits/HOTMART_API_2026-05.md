# Auditoria Hotmart Developers / Postback / API REST — Sessão 1.4.5

**Data:** 2026-05-09
**Sessão de origem:** 1.4.5 (Gateway adapter base + Hotmart integration)
**Conduzida por:** agente de pesquisa (consultor de tracking/atribuição)
**Fontes:** developers.hotmart.com (parcialmente bloqueado por CloudFront 403 ao agente; complementado por Hotmart Help Center, blog Hotmart, Erathos docs, Rollout integration guides, Hotmart-Python SDK e changelog público) + ROADMAP §1.4.5-1.4.9 + ADR-014 (CDP) + arquitetura v0.6 §4 (créditos) + schema atual `gateway_*` e `gatewayConnections`.

> Este documento é a fonte canônica para decisões de plataforma Hotmart. Decisões formais devem entrar em **ADR-016 (Plataforma Hotmart)** durante prep da Sessão 1.4.5. Onde houver conflito com a v0.6, este audit vence. Sessões 1.4.6 (Kiwify), 1.4.7 (Eduzz/Monetizze/Ticto) e 1.4.8/1.4.9 herdam o adapter pattern aqui definido — invista em qualidade de abstração agora, não depois.

---

## 1. Stack Hotmart correto em 2026 (resumo)

| Produto / endpoint                   | Versão / estado atual                                                                                                                                                                                                                                            | Nota crítica                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Webhook (Postback) v1**            | `developers.hotmart.com/docs/.../1.0.0/webhook/...` — payload **flat form-urlencoded** legacy.                                                                                                                                                                   | Mantido para backwards-compat. Não construir contra ele. Existe ainda em produção em muitas contas antigas.                               |
| **Webhook (Postback) v2**            | `2.0.0` — JSON com envelope `{id, creation_date, event, version, hottok, data}`. **Tracking object** `data.purchase.origin{src, sck, xcode}` agregado em changelog 2023-2024.                                                                                    | **Padrão a adotar.** Onboarding deve forçar cliente a registrar v2; v1 só como fallback.                                                  |
| **Hotmart REST API (HotConnect) v1** | `https://developers.hotmart.com/payments/api/v1/...` (sales) e `https://developers.hotmart.com/subscription/rest/v1/...` (subs); produtos em `/product/rest/v2/...` (sim, v1 e v2 coexistem por domínio).                                                        | API não é "v1 monolítica" — cada domínio tem seu próprio versionamento. v0.6 trata como única, gap conceitual.                            |
| **OAuth 2.0 client_credentials**     | `POST https://api-sec-vlc.hotmart.com/security/oauth/token` — body `grant_type=client_credentials`, header `Authorization: Basic <base64(client_id:client_secret)>` **OU** body `client_id` + `client_secret`. Token TTL **24h** (conservador: tratar como 23h). | **Não há refresh_token** — use token até expirar e re-troque com mesmas credenciais.                                                      |
| **Sandbox**                          | Credenciais separadas, geradas no painel marcando "Sandbox". `sandbox=true` flag no SDK oficial / mesmo endpoint `api-sec-vlc.hotmart.com`. **Sandbox e prod não são intercambiáveis** — credencial gerada num modo nunca funciona no outro.                     | Cobertura do sandbox é parcial (não dá pra gerar venda real). Smoke tests precisam de prod com transação de R$ 5,00 + reembolso imediato. |
| **Rate limit global**                | **500 requests/min** por credencial (subiu de 100/min em 2024).                                                                                                                                                                                                  | Lê: ~8 req/s. Suficiente para puxar histórico, mas para 50+ workspaces em backfill paralelo precisa de throttler central.                 |
| **HOTTOK**                           | Token único por conta Hotmart. Aparece **dentro do payload v2** (`hottok` field) e como header (`x-hotmart-hottok` em integrações antigas; `x-hotmart-signature` HMAC-SHA256 em integrações modernas). **Comportamento misto, frágil.**                          | Validar **ambos** — `payload.hottok === expected` E `x-hotmart-signature === hmac_sha256(secret, body)` quando header presente.           |
| **Postback panel app**               | `app-postback.hotmart.com` — UI separada para gerenciar webhooks.                                                                                                                                                                                                | Cliente registra manualmente. Não há API pública para criar webhook programaticamente.                                                    |
| **HotConnect (auth marca)**          | Branding antigo da plataforma de devs. Endpoint base é `api-hot-connect.hotmart.com` em alguns guides.                                                                                                                                                           | Nome legado, mesma plataforma.                                                                                                            |

---

## 2. Autenticação detalhada

**OAuth client_credentials (servidor-a-servidor):**

- **Endpoint:** `POST https://api-sec-vlc.hotmart.com/security/oauth/token`
- **Body (form-urlencoded ou JSON, ambos aceitos):** `grant_type=client_credentials&client_id=...&client_secret=...`
- **Header alternativo:** `Authorization: Basic <base64(client_id:client_secret)>` + body só com `grant_type=client_credentials`. O painel Hotmart já entrega o "Basic token" pré-computado no UI de credenciais — o **basic** é uma terceira credencial que cliente copia, mas é redundante com client_id/secret.
- **Resposta:** `{ access_token, token_type: "bearer", expires_in: 86400, scope, jti }`. **Nenhum refresh_token.**
- **Uso:** `Authorization: Bearer <access_token>` em toda chamada REST.
- **Expiração:** 24h. Refresh = re-trocar credenciais. Implementar cache em memória + camada Redis com TTL 23h por workspace (não armazenar token cifrado em DB para algo que dura 24h — overkill).

**Onde gerar no painel:** `app.hotmart.com` → **Tools** → **Developer Credentials** → **Create Credential** → marcar Sandbox ou Production. Chaves visíveis apenas na criação — depois, opacas. Cliente perde secret = revoga e gera nova.

**Escopos:** Hotmart **não expõe scopes granulares** no fluxo client_credentials — a credencial herda permissão do produtor que a criou (o produtor tem todos os dados dele, ponto). Não há `scope=sales:read subscriptions:write` etc. Implicação: **não conseguimos pedir "menos" permissão** — cliente precisa confiar que vamos usar só o necessário. Documentar isso no consent screen do nosso onboarding.

**HOTTOK vs OAuth:**

- **HOTTOK** = secret de webhook (validação inbound).
- **OAuth client_id/secret** = credencial de API REST (chamadas outbound).
- São independentes. Cliente pode ter HOTTOK sem ter OAuth (só usa Postback) e vice-versa.

**Sandbox vs prod:** credenciais **não interoperáveis**. Mesmo endpoint `api-sec-vlc.hotmart.com`, mas tokens gerados em sandbox só funcionam contra sandbox (resources prefixados). Sandbox **não cobre tudo** — afiliação Sparkle, reembolso parcial, e UI de Postback v2 testes têm cobertura inconsistente. **Decisão proposta:** wizard 1.4.5 oferece "modo teste" que usa sandbox para validar OAuth + um webhook ping; smoke test real é em prod com R$ 5.

**Limitações de plano:** Hotmart **não bloqueia API por plano de produto** (Basic/Pro/Premium são planos de uso de checkout, não de API). Toda conta produtora pode gerar credenciais. **Mas:** contas em verificação ou com restrição (KYC pendente, irregularidade) podem ter acesso bloqueado ao painel de Developer Credentials sem aviso explícito. Erro UX clássico — wizard precisa testar credencial logo após cliente colar e mostrar erro acionável.

---

## 3. Webhooks (Postback)

### v1 vs v2

| Aspecto         | Postback v1                                                                     | Postback v2                                                                                    |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Encoding        | `application/x-www-form-urlencoded` (form fields planos)                        | `application/json` (envelope estruturado)                                                      |
| Envelope        | Não há — campos raiz: `prod, off, email, doc, transaction, status, hottok, ...` | `{id, creation_date, event, version, hottok, data: {...}}`                                     |
| Nome do evento  | Inferido de `status` (`approved`, `refunded`, ...)                              | Explícito em `event` (`PURCHASE_APPROVED`, `PURCHASE_REFUNDED`, ...)                           |
| Tracking origin | Não estruturado (UTMs perdidas; só `src`/`sck` dispersos)                       | Object `data.purchase.origin{src, sck, xcode}` + `tracking{source, source_sck, external_code}` |
| Idempotência    | Sem ID único confiável — usa `transaction` + `status`                           | `id` UUID v4 por evento (idempotência forte)                                                   |
| Versionamento   | Não tem — qualquer mudança quebra                                               | `version` no payload permite parsing condicional                                               |

**Decisão:** Adapter aceita **ambos**, mas onboarding ativa v2 por default. Parser v1 vive como `legacyParser.ts` em `src/lib/services/gateways/hotmart/`, usado só se cliente legado chegar.

### Validação de assinatura (HMAC + HOTTOK)

Documentação Hotmart é **vaga e inconsistente** — comunidade reporta dois modelos coexistindo:

1. **HOTTOK no payload** (v1 e v2): o próprio JSON contém `hottok: "<token>"`. Validamos comparando com o secret armazenado em `gatewayConnections.webhook_secret_hash` (cuidado: hashed; precisamos guardar plain ou usar `webhook_secret` separado — schema gap, ver §7).
2. **HMAC-SHA256 header** (v2 moderno, opt-in em algumas contas): header `x-hotmart-signature` ou `x-hotmart-hottok` contendo `hmac_sha256(secret, raw_body).digest('hex')`. **Note:** validar contra o **raw body** (string exata), não contra `JSON.stringify(parsed)` — isso é causa #1 de signature mismatch em integrações Node.

**Código de validação recomendado (TS):**

```ts
function validateHotmartSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
  payload: { hottok?: string }
): boolean {
  // Camada 1: HOTTOK no payload
  if (payload.hottok && timingSafeEqual(payload.hottok, secret)) return true
  // Camada 2: HMAC header
  const sig = headers.get('x-hotmart-hottok') ?? headers.get('x-hotmart-signature')
  if (!sig) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return timingSafeEqual(sig, expected)
}
```

**Crítica:** doc não documenta canonicalização (case sensitivity, trailing newline). Testes em prod são obrigatórios — agendar smoke test no PR de aceitação.

### Eventos completos (v2)

**Compras:**

- `PURCHASE_APPROVED` — pagamento aprovado (cartão, PIX, boleto pago). **Trigger principal de credit allocation.**
- `PURCHASE_COMPLETE` — disparado após janela de garantia/chargeback (~30d) — venda "limpa". Útil para reconhecimento de receita líquida.
- `PURCHASE_CANCELED` — cancelada antes da aprovação.
- `PURCHASE_REFUNDED` — reembolso total (após aprovação). **Trigger de credit revoke.**
- `PURCHASE_CHARGEBACK` — disputa cartão. **Também revoga.**
- `PURCHASE_PROTEST` — produtor disputou um chargeback (raro, irrelevante para credit).
- `PURCHASE_BILLET_PRINTED` — boleto gerado, **não pago** ainda. Útil para funil "checkout iniciado" mas não para receita.
- `PURCHASE_DELAYED` — pagamento atrasado (boleto vencido em janela de tolerância).
- `PURCHASE_EXPIRED` — boleto/PIX expirou sem pagamento.
- `PURCHASE_OUT_OF_SHOPPING_CART` — abandono de carrinho. **Útil para fanout `InitiateCheckout` no CAPI Meta.**
- `PURCHASE_REFUND_REQUESTED` — pedido de reembolso aberto, ainda não processado. **Não revoga crédito ainda** — esperar `REFUNDED`.

**Assinaturas:**

- `SUBSCRIPTION_CANCELLATION` — assinatura cancelada (não renova mais).
- `SWITCH_PLAN` — mudança de plano (upgrade imediato / downgrade no fim do ciclo).
- `UPDATE_SUBSCRIPTION_CHARGE_DATE` — data de cobrança alterada.

**Club (curso/membership):**

- `CLUB_FIRST_ACCESS` — primeiro acesso ao Hotmart Club do produto.
- `CLUB_MODULE_COMPLETED` — módulo finalizado (engagement signal).

**Sem evento dedicado para:**

- Renovação de assinatura → vem como **novo `PURCHASE_APPROVED` com `recurrence_number > 1`**. **Crítico.** v0.6 trata renovação como evento próprio — Hotmart não.
- Reativação de assinatura → vem como `PURCHASE_APPROVED` (após operação de reactivate via API REST).
- Comissão paga ao afiliado → não há webhook; consultar `sales-commissions` API.

**Idempotência:** v2 garante `id` UUID único por evento. **Constraint atual** `gateway_events_workspace_provider_event_unique(workspace_id, provider, providerEventId)` cobre. Para v1 (sem id), usar `sha256(transaction + status + creation_date)` como `provider_event_id` sintético.

**Categorização para créditos (Regra 0):**

- `PURCHASE_APPROVED` (recurrence_number=1) → `creditService.allocate({ idempotencyKey: event.id })`
- `PURCHASE_APPROVED` (recurrence_number>1) → `creditService.allocate` para o ciclo novo da subscription
- `PURCHASE_REFUNDED` / `PURCHASE_CHARGEBACK` → `creditService.revoke({ idempotencyKey: event.id, reason })`
- `SUBSCRIPTION_CANCELLATION` → marca subscription como cancelada **sem revogar crédito do ciclo atual** (cliente usa até o fim do ciclo pago) — alinhado com v0.6 §4.

### Configuração no painel

**Passos manuais do produtor:**

1. `app.hotmart.com/login` → **Tools** → **Show all** → **Webhook (API and notifications)**.
2. **+ Register Webhook** → nomear segmentação.
3. Selecionar **eventos** (checkbox por evento — pode escolher subset).
4. Selecionar **escopo**: "all products" ou specific product IDs.
5. Colar **Delivery URL** (nossa).
6. Save. Hotmart faz ping de teste opcional.

**Limitações:**

- **Não há API pública** para criar webhook programaticamente. Cliente faz manual no painel. Wizard nosso vai precisar de **screenshots passo-a-passo** e/ou Loom embedado.
- **Múltiplas URLs:** sim, ilimitado documentado; comunidade reporta limite prático ~10.
- **Filtro por evento por URL:** sim, no momento da criação.
- **Filtro por produto:** sim.
- **Sem IP allowlist documentado** — não bloquear por IP no nosso lado.
- **Histórico:** painel guarda 60 dias de eventos enviados (com payload + response). Útil para "resync" manual via UI Hotmart se nosso endpoint cair > 60d.

**Retry policy:** "**até 5 tentativas**" mencionado vagamente no panel. Comunidade reporta backoff ~5min, 30min, 1h, 6h, 24h. Após esgotar, evento é descartado (não há DLQ Hotmart-side). **Implicação P1:** nosso endpoint precisa retornar `2xx` em < 5s mesmo se processamento é assíncrono (enqueue Trigger.dev e return). DLQ nosso (`gatewayEventsDlq` já existe) cobre falha posterior.

---

## 4. API REST detalhada por domínio

### Sales (`/payments/api/v1/sales/...`)

- `GET /sales/history` — histórico transacional. Filtros: `start_date`, `end_date` (em **milissegundos epoch**, gotcha #1), `product_id`, `transaction_status` (APPROVED|REFUNDED|...), `transaction` (ID específico), `buyer_email`, `affiliate_email`. Paginação **cursor**: response tem `page_info.next_page_token` / `prev_page_token`. Header `max_results` (default 100, ceiling 500). Use **500** sempre.
- `GET /sales/summary` — agregados por dia/produto.
- `GET /sales/users` — lista únicos buyers.
- `GET /sales/commissions` — comissões pagas (afiliados, coprodutores, plataforma).
- `GET /sales/price-details` — breakdown de price (preço base, desconto, taxa Hotmart, líquido produtor).
- `GET /sales/participants` — coprodutores envolvidos numa venda.

**Campos relevantes para Criation no item:** `transaction`, `order_date` (ms epoch), `status`, `product.id`, `product.name`, `offer.code`, `price.value`, `price.currency_value` (BRL/USD/EUR), `payment.method`, `payment.installments_number`, `buyer.email`, `buyer.name`, `buyer.document`, `tracking.source`, `tracking.source_sck`, `tracking.external_code`, `affiliate.email`, `commission_as` (PRODUCER|AFFILIATE|COPRODUCER).

### Subscriptions (`/subscription/rest/v1/...`)

- `GET /subscriptions` — lista assinaturas. Filtros: `status` (ACTIVE|INACTIVE|CANCELLED_BY_CUSTOMER|CANCELLED_BY_SELLER|CANCELLED_BY_ADMIN|DELAYED|OVERDUE|STARTED), `product_id`, `subscriber_email`, `subscriber_code`, `accession_date`.
- `GET /subscriptions/summary` — agregados.
- `GET /subscriptions/{subscriber_code}/purchases` — todas as cobranças (recorrências) de uma assinatura.
- `POST /subscriptions/cancel` — cancela uma ou várias.
- `POST /subscriptions/reactivate` — reativa.
- `PATCH /subscriptions/{code}/change_due_day` — muda dia de cobrança.

**Campos por subscription:** `subscriber.code`, `subscriber.email`, `plan.id`, `plan.name`, `plan.recurrency_period`, `status`, `accession_date`, `end_accession_date`, `next_charge_date`, `transaction` (último).

### Products (`/product/rest/v2/products`)

- `GET /products` — lista produtos do produtor. Mais simples — paginated, sem muitos filtros.
- Campos: `id`, `name`, `ucode`, `status`, `format` (EBOOK|ONLINE_COURSE|...), `is_subscription`, `warranty_period`.

### Coupons (`/payments/api/v1/coupons`)

- CRUD de cupons. **Provavelmente fora do MVP 1.4.5** — útil em Fase 2 quando dashboards de pricing entrarem.

### Tickets / Club / Lifetime

- `GET /tickets/participants` — para produtos de evento.
- Club: APIs separadas (`/club/...`) — fora de escopo 1.4.5 (cobrir só se beta pedir).

**Rate limit:** 500 req/min por credencial **global** (todos os endpoints somam). Sem limit documentado por endpoint específico, exceto que a doc avisa "use `max_results=500`" para baixar paginação.

**Backfill MVP — endpoints prioritários para 1.4.5:**

1. `/sales/history` últimos 90d — popular `gateway_events` com vendas históricas.
2. `/products` — popular `gateway_products`.
3. `/subscriptions?status=ACTIVE` — popular base de subscriptions ativas para estado inicial de billing.

---

## 5. Modelo de dados Hotmart

**Hierarquia:**

```
Conta Hotmart (Producer)
 └─ Products (id, ucode, format, is_subscription)
     └─ Offers (code, price, installments)  ← link de checkout
         └─ Purchases (transaction)
             └─ Subscription (subscriber_code, plan_id) ← se is_subscription=true
                 └─ Recurrences (cada cobrança = um Purchase com recurrence_number > 1)
```

**IDs principais:**

- `product.id` = numérico (`3526906`).
- `product.ucode` = UUID (`6580bbe3-...`) — usado em URLs públicas e Club.
- `offer.code` = string curta (`n82b9jqz`) — código de oferta/preço.
- `transaction` = string `HP19842736455232` — ID da venda individual.
- `subscriber.code` = string `IK48GS9F` — chave única da assinatura. **Persiste entre recurrences.**
- `event.id` = UUID v4 — único por webhook event.

**Hotmart Club:** plataforma de course player. Eventos `CLUB_FIRST_ACCESS`/`CLUB_MODULE_COMPLETED` são **engagement signals** valiosos para o nosso dashboard de retention, mas não tocam billing. Podemos persistir como `gateway_events` com `event_type='CLUB_*'` mas **não enfileirar para fanout CAPI** (Meta não tem Custom Event para isso por default; criar Custom Event opcional).

**Hotmart Sparkle:** plataforma de comunidades de afiliados. Sparkle não emite webhooks próprios — o que aparece é via `PURCHASE_APPROVED` quando `affiliate.source === 'SPARKLE'` e `tracking.source === 'SPARKLE'`. Diferencial: receita do produtor é **líquida da comissão do afiliado**.

**Ticket (boleto) flow:** `PURCHASE_BILLET_PRINTED` → cliente paga → `PURCHASE_APPROVED` (mesma transaction id). Janela típica 3 dias úteis. Se vencer → `PURCHASE_EXPIRED`. **Implicação:** alocar crédito só em APPROVED, não em BILLET_PRINTED. UI de "vendas pendentes" pode usar BILLET_PRINTED.

**Recorrência (subscription) flow:**

- `PURCHASE_APPROVED` (recurrence_number=1) → cria subscription ativa. Aloca créditos.
- ~30d depois: novo `PURCHASE_APPROVED` (recurrence_number=2, mesmo `subscriber_code`) → renovação. Realoca créditos do novo ciclo.
- Cliente cancela: `SUBSCRIPTION_CANCELLATION` → subscription marcada `cancelled` mas **continua até `end_accession_date`**.
- Se cartão falha em renovação: subscription vira `OVERDUE`, **sem webhook explícito** — só dá pra detectar consultando API REST (gap).
- Reembolso de uma cobrança específica: `PURCHASE_REFUNDED` no `transaction` daquela cobrança.

---

## 6. UTMs e atribuição (CRÍTICO pra Criation)

**Tese:** Hotmart é **fraco em UTM tracking** comparado com Meta Ads ou Stripe. Isso é o gap #1 que Criation resolve via **CDP-side capture (ADR-014)** — não dependa do Hotmart entregar UTMs completas.

**O que Hotmart capta no checkout:**

- **UTM padrão** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`): aparecem no painel "Sales Source Dashboard". **Mas:** não documentado claramente no payload do webhook v2. Comunidade reporta inconsistência — em alguns casos UTMs caem em `data.purchase.origin.src/sck`, em outros somem.
- **`src`** (Hotmart-specific): persiste no payload v2 em `data.purchase.origin.src` ou `data.purchase.tracking.source`. **30 caracteres max.** Underscore proibido (reservado interno). Pipe `|` permitido como separador.
- **`sck`** (Hotmart-specific): mesma regra, em `origin.sck` / `tracking.source_sck`. Usado para tráfego direto ao checkout.
- **`xcode`** (Hotmart-specific): em `origin.xcode`. Usado em **upsells** e variantes; carrega `src` da venda anterior.
- **`external_code`**: em `tracking.external_code` — UUID que **podemos injetar** no link de checkout (ex.: nosso `visitor_id` da Criation). **Esta é a chave para correlacionar gateway_event com tracking_event do nosso CDP.**

**Como injetar nosso `visitor_id` no checkout:** query string `?src=criation_<short>&sck=<utm_campaign>&xcode=<visitor_id>`. **Limitação 30 chars** força encoding curto — usar `nanoid(20)` ou hash truncado de visitor_id. **Decisão proposta:** injetar visitor_id via `xcode`, manter `src`/`sck` para encoding de utm_source|campaign do cliente.

**UTMs em renovação (CRÍTICO):**

- **`PURCHASE_APPROVED` recurrence_number > 1 NÃO carrega UTMs/origin novas.** O campo `tracking` está presente mas reflete a **compra original**. Renovação herda atribuição da venda inicial.
- Implicação: para Criation o "first touch" da subscription é o que importa. Não tente atribuir renovações a campanhas atuais — atribua à campanha que originou a subscription.
- ADR-014 + 1.4.B (visitor↔buyer matching) precisa **persistir** o `visitor_id` original no `tracking_visitors.identified_buyer_email_hash` e propagar na renovação.

**Hotmart Pages (landing hosted):**

- UTMs **chegam no checkout** se a Page tem o link com UTMs.
- Hotmart Pages **não dispara nosso script** (CDP) por default — cliente precisa colar manualmente. **Decisão:** documentar como caso "degradado" no qual perdemos visitor_id e dependemos só de `tracking.source`/`sck` do Hotmart.

**Outros click IDs (`fbclid`, `gclid`, `ttclid`):**

- Hotmart **não captura** click IDs nativamente. Schema atual `gateway_events.fbclid/gclid/ttclid` **não vai ser populado pelo Hotmart**.
- Precisamos correlacionar via UTM Stitcher (1.4.8) consultando `tracking_events` recentes do mesmo `visitor_id` (vindo via `xcode`) ou mesmo UTM bundle.

---

## 7. Gaps de schema vs `gateway_events` / `gateway_products` atual

### `gateway_events` — adicionar

```diff
+ providerEventVersion text         -- '1.0.0' | '2.0.0'
+ recurrenceNumber integer          -- 1 = primeira compra, 2+ = renovação
+ subscriberCode text               -- subscriber.code (chave persistente da subscription)
+ subscriptionStatus text           -- ACTIVE | CANCELLED | OVERDUE | ...
+ planId text                       -- plan.id da assinatura
+ paymentMethod text                -- CREDIT_CARD | PIX | BILLET | ...
+ installmentsNumber integer        -- parcelas
+ feeCents integer                  -- taxa Hotmart (price.value - producer_net)
+ producerNetCents integer          -- líquido pro produtor (após comissões e taxa)
+ commissionAffiliateCents integer  -- comissão paga ao afiliado nessa venda
+ affiliateEmail text               -- afiliado, se houver
+ affiliateSource text              -- 'SPARKLE' | 'EXTERNAL' | null
+ origin jsonb                      -- {src, sck, xcode} cru
+ externalCode text                 -- tracking.external_code (nosso visitor_id se injetamos)
+ buyerCountry text                 -- ISO-2 (BR, US, ...) — Hotmart vende multi-country
+ creationDateMs bigint             -- creation_date raw em ms epoch (Hotmart usa epoch ms, não tz)
+ allocationStatus text             -- 'pending' | 'allocated' | 'revoked' | 'failed' (link com creditService)
+ allocationIdempotencyKey text     -- idempotency key usada em creditService.allocate/revoke
```

**Renomear / clarificar:**

- `customerEmailHash` / `customerPhoneHash` → manter (privacy by design). Adicionar `buyerDocumentHash text` (CPF/CNPJ hashed, LGPD-sensitive).

### `gateway_products` — adicionar

```diff
+ ucode text                        -- product.ucode (UUID alternativo)
+ format text                       -- EBOOK | ONLINE_COURSE | EVENT | ...
+ isSubscription boolean
+ warrantyDays integer              -- janela de garantia (afeta PURCHASE_COMPLETE)
+ defaultCurrency text              -- BRL | USD | EUR
```

### Nova tabela `gateway_subscriptions` (1:N de `gateway_connections`)

`gateway_events` é log de eventos. `gateway_subscriptions` é **estado atual** da subscription (consultado para dashboard, MRR, churn). Sem isso, calcular MRR exige scan completo de `gateway_events`.

```sql
gateway_subscriptions (
  id uuid pk,
  workspace_id uuid fk,
  connection_id uuid fk,
  subscriber_code text not null,         -- chave Hotmart
  plan_id text,
  product_id text,
  status text not null,                  -- ACTIVE | CANCELLED | OVERDUE | DELAYED
  accession_date timestamptz,
  end_accession_date timestamptz,
  next_charge_date timestamptz,
  current_recurrence integer default 1,
  cancellation_reason text,
  monthly_value_cents integer,
  currency text,
  origin jsonb,                          -- snapshot da origin da venda inicial (para atribuir renovações)
  identified_visitor_id text,            -- nosso visitor_id capturado via xcode
  created_at, updated_at,
  unique(workspace_id, connection_id, subscriber_code)
)
```

### `gatewayConnections` — adicionar

```diff
+ webhookSecret text                  -- HOTTOK em CLARO (cifrado via mesmo envelope das outras secrets)
                                       -- precisamos do plain para validar HMAC; hash não basta
+ apiCredentials jsonb                -- {client_id, client_secret_encrypted, basic_token_encrypted, sandbox: bool}
+ webhookVersion text                 -- '1.0.0' | '2.0.0' configurada pelo cliente
+ providerSubaccountId text           -- producer_id Hotmart (capturado via /sales/users primeira chamada)
+ lastWebhookEventAt timestamptz      -- monitor de saúde
+ lastWebhookEventId text             -- último event_id processado
+ webhookFailures24h integer          -- count para alertar se cliente está com webhook quebrado
```

**Crítico:** `webhook_secret_hash` no schema atual **não funciona** para validar HMAC — precisamos do plain (cifrado em repouso, mas decryptable). Schema atual é leftover de mental model "store hash for comparison" que só serve para HOTTOK-no-payload, não para HMAC. **P1.**

---

## 8. Riscos e armadilhas

1. **Webhook secret precisa ser plain (cifrado), não hash.** Schema atual tem `webhook_secret_hash` — não dá para fazer HMAC com hash. **Migration aditiva P1.**
2. **HOTTOK validation tem 2 modos coexistentes (payload field + HMAC header).** Doc é vaga. **Validar ambos** quando presentes; fail closed se nenhum bate.
3. **`creation_date` em milissegundos epoch, não ISO.** Erro #1 em integrações novas. Converter na borda do parser.
4. **Renovação NÃO é evento próprio** — é `PURCHASE_APPROVED` com `recurrence_number > 1`. Lógica de credit allocation precisa diferenciar (alocar para o ciclo da subscription, não como nova venda).
5. **OVERDUE / cartão recusado em renovação NÃO emite webhook.** Hotmart só notifica quando cliente cancela ativamente ou paga. Para detectar churn por falha de pagamento → precisa job de polling em `/subscriptions?status=OVERDUE` periódico (1x/dia).
6. **Reembolso parcial** existe (`PARTIALLY_REFUNDED` status no API REST) mas **não há webhook event dedicado** — só `PURCHASE_REFUNDED` (que ambíguo entre total e parcial). Inspecionar `price.value` vs original para decidir. Para créditos: tratar parcial como **revoke proporcional** (ou só revogar em total — decisão de produto, deixar para fundador).
7. **Multi-moeda:** Hotmart vende em BRL, USD, EUR, MXN. `currency_value` no payload. Schema `gateway_events.currency` já existe (`default 'BRL'`). **Não converter cents BRL ↔ USD em runtime** — armazenar valor + currency original; conversão acontece no dashboard com câmbio de display.
8. **Comissão de afiliado:** `price.value` é **bruto pago pelo cliente**. Receita do produtor = `producer_net` (precisa puxar via `/sales/commissions` ou parsear breakdown). **Não confundir bruto com líquido em billing.**
9. **Duplicação de eventos:** Hotmart pode reenviar até 5x se nosso endpoint demorar. v2 idempotência via `event.id` salva. **Mas:** v1 sem `event.id` requer chave sintética + INSERT...ON CONFLICT.
10. **Sandbox tem cobertura parcial.** Não dá para gerar venda real de R$ 0; algumas features (Sparkle affiliate flow, refund flow completo) não existem. **Smoke test obrigatório em prod com R$ 5,00 + reembolso imediato.**
11. **API tem domínios separados versionados independentemente** (`/payments/v1`, `/subscription/v1`, `/product/v2`). Se assumir versionamento global no adapter, quebra. Mapear endpoint→versão por domínio.
12. **Rate limit 500/min é GLOBAL por credencial** — backfill paralelo de 50 workspaces no mesmo Trigger.dev pode estourar se cada workspace tiver sua credencial mas se Criation tiver concorrência alta. Throttler central P1.
13. **LGPD:** webhook traz `buyer.email`, `buyer.name`, `buyer.document` (CPF), `buyer.phone` em **plain text**. **Hash imediatamente no parser**, antes de logger ver o payload. Logger deve ter scrubber para `email|document|phone|name` keys. Auditar `gatewayEventsDlq.rawPayload` — DLQ guarda raw, **precisa ser purgado em N dias** ou ter PII redacted.
14. **Hotmart histórico de breaking changes:** v1 → v2 do Postback foi breaking. API REST é mais estável (v0.6 do Hotmart-Python ainda funciona desde 2020). Risco médio.
15. **Doc oficial bloqueia scraping** (CloudFront 403 para fetchers). Sem auto-monitor de doc — agendar revisão trimestral manual.
16. **Painel Postback é app separado** (`app-postback.hotmart.com`) — login flow diferente do app principal em alguns casos. Cliente fica perdido. Wizard precisa de Loom específico.
17. **Sparkle attribution priority:** se cliente é impactado via Sparkle, comissão vai pro afiliado **mesmo se UTM da Criation diz outra coisa**. Implicação para "atribuição correta" no dashboard.

---

## 9. Recomendações concretas para Sessão 1.4.5

Análogo ao que ADR-013 fez para 1.3 do Meta. Lista priorizada para a 1.4.5:

1. **Adapter pattern em `src/lib/services/gateways/`** — interface `GatewayAdapter` (parse, normalize, validate, fetch). `HotmartAdapter implements GatewayAdapter`. Kiwify/Eduzz herdam interface, não código.
2. **Suportar Postback v2 como first-class. v1 só como fallback** com warning no admin se cliente registrou v1.
3. **Schema deltas P1 (esta sessão):**
   - `gateway_connections`: adicionar `webhookSecret` (plain cifrado), `apiCredentials jsonb`, `webhookVersion`, `providerSubaccountId`, telemetria de webhook.
   - `gateway_events`: 14 colunas novas (recurrence, subscriber, plan, payment, fees, affiliate, origin jsonb, externalCode, buyerCountry, allocation status).
   - **Nova tabela `gateway_subscriptions`** — estado atual.
   - Marcar `webhook_secret_hash` como `@deprecated` em PR aditivo; remover em PR de constraint da próxima sessão.
4. **Endpoint webhook único `/api/webhooks/gateway/[provider]/[connection_id]`** — provider routing no controller, valida assinatura via adapter, INSERT em `gateway_events`, enfileira Trigger.dev task `processGatewayEvent`. **Retorna 2xx em < 5s sempre.**
5. **OAuth wiring (cliente cola credenciais manualmente):** UI de connect Hotmart pede 3 campos: `client_id`, `client_secret`, `hottok` (webhook secret). Sandbox checkbox. Smoke test imediato: chama `/security/oauth/token`, depois `/sales/history?max_results=1` para confirmar permissão.
6. **MVP de eventos a processar:** `PURCHASE_APPROVED`, `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `SUBSCRIPTION_CANCELLATION`, `PURCHASE_OUT_OF_SHOPPING_CART` (último para fanout `InitiateCheckout`). **Adiar:** Club, Sparkle deep, switch_plan, refund_requested, billet_printed (pode entrar como "tracked but no-op").
7. **Backfill últimos 90d via `/sales/history`** — Trigger.dev task one-shot ao conectar. Throttler 8 req/s por credencial.
8. **NormalizedGatewayEvent:** schema interno único que todos os adapters produzem (ver §10).
9. **Credit integration (Regra 0):** `processGatewayEvent` chama `creditService.allocate({ idempotencyKey: event.id, subscriptionId: subscription.id, source: 'hotmart' })` para `PURCHASE_APPROVED`; `revoke` para `REFUNDED`/`CHARGEBACK`. Idempotency via `event.id` (v2) ou hash sintético (v1).
10. **UTM bridge para 1.4.8:** persistir `origin.xcode` em `gateway_events.externalCode`. UTM Stitcher correlaciona com `tracking_visitors` por `external_code = visitor_id`.
11. **PII scrubbing:** parser hasheia email/document/phone **antes** do INSERT em `gateway_events.raw_payload` (versão redacted) e antes de qualquer logger.info. Raw plain só passa pela memória do parser.
12. **DLQ retention 30d** — purge job em `gateway_events_dlq` para não acumular PII de payloads que nunca processaram.
13. **Wizard UX:** 3 telas — (1) "gere credenciais aqui (link app.hotmart.com/tools/dev-credentials)" + Loom 30s; (2) cole 3 fields + smoke test; (3) "registre webhook aqui (link app-postback.hotmart.com)" com URL do webhook copy-paste + Loom passo-a-passo. **Manual, não automatizável** — Hotmart não tem API para criar webhook.
14. **Telemetria:** `criation_gateway_hotmart_connected` com `is_sandbox`, `webhook_version`, `oauth_smoke_test_ok`, `backfill_event_count`.
15. **Fora do MVP 1.4.5 (deixar para TD ou fase posterior):** multi-moeda display conversion, afiliados detalhados (Sparkle), Club events, coupons API, partial refund handling proportional, OVERDUE polling job, custom event mapping para CAPI Custom Events.

---

## 10. Arquitetura proposta do HotmartAdapter

```ts
// src/lib/services/gateways/types.ts
export interface NormalizedGatewayEvent {
  provider: 'hotmart' | 'kiwify' | 'eduzz' | 'monetizze' | 'ticto'
  providerEventId: string
  providerEventVersion: string
  eventType: NormalizedEventType // 'PURCHASE_APPROVED' | 'PURCHASE_REFUNDED' | ...
  occurredAt: Date
  // Money
  amountCents: number
  feeCents?: number
  producerNetCents?: number
  currency: string
  // Product / subscription
  productId: string
  productName?: string
  offerId?: string
  subscriberCode?: string
  recurrenceNumber?: number
  paymentMethod?: 'CREDIT_CARD' | 'PIX' | 'BILLET' | 'PAYPAL' | 'OTHER'
  installmentsNumber?: number
  // Buyer (already hashed)
  buyerEmailHash: string
  buyerPhoneHash?: string
  buyerDocumentHash?: string
  buyerCountry?: string
  // Attribution
  utms?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
  origin?: { src?: string; sck?: string; xcode?: string }
  externalCode?: string // nosso visitor_id quando injetado
  // Affiliate
  affiliateEmailHash?: string
  affiliateSource?: 'SPARKLE' | 'EXTERNAL'
  commissionAffiliateCents?: number
  // Raw + idempotency
  rawPayload: Record<string, unknown> // PII-redacted
  allocationIdempotencyKey: string
}

export interface GatewayAdapter {
  provider: string
  validateSignature(rawBody: string, headers: Headers, secret: string): boolean
  parseWebhook(rawBody: string): unknown // raw provider shape
  normalizeEvent(
    raw: unknown,
    ctx: { workspaceId: string; connectionId: string }
  ): NormalizedGatewayEvent
  fetchAccessToken(creds: GatewayCredentials): Promise<{ token: string; expiresAt: Date }>
  fetchSalesHistory(creds: GatewayCredentials, since: Date): AsyncIterable<NormalizedGatewayEvent>
  fetchSubscriptions(creds: GatewayCredentials): AsyncIterable<NormalizedSubscription>
  fetchProducts(creds: GatewayCredentials): AsyncIterable<NormalizedProduct>
}
```

**HotmartAdapter mapping (campos chave):**

| NormalizedGatewayEvent     | Hotmart v2 source                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `providerEventId`          | `payload.id` (UUID)                                                                     |
| `providerEventVersion`     | `payload.version`                                                                       |
| `eventType`                | `payload.event` (mapeado: `PURCHASE_APPROVED` → mesmo)                                  |
| `occurredAt`               | `new Date(payload.creation_date)` (ms epoch)                                            |
| `amountCents`              | `Math.round(payload.data.purchase.price.value * 100)`                                   |
| `currency`                 | `payload.data.purchase.price.currency_value`                                            |
| `productId`                | `String(payload.data.product.id)`                                                       |
| `productName`              | `payload.data.product.name`                                                             |
| `offerId`                  | `payload.data.purchase.offer.code`                                                      |
| `subscriberCode`           | `payload.data.subscription?.subscriber.code`                                            |
| `recurrenceNumber`         | `payload.data.purchase.recurrence_number ?? 1`                                          |
| `paymentMethod`            | `payload.data.purchase.payment.type`                                                    |
| `installmentsNumber`       | `payload.data.purchase.payment.installments_number`                                     |
| `buyerEmailHash`           | `sha256(payload.data.buyer.email.toLowerCase().trim())`                                 |
| `buyerPhoneHash`           | `sha256(normalizePhoneE164(payload.data.buyer.phone))`                                  |
| `buyerDocumentHash`        | `sha256(payload.data.buyer.document.replace(/\D/g, ''))`                                |
| `buyerCountry`             | `payload.data.purchase.checkout_country.iso`                                            |
| `origin.src`               | `payload.data.purchase.origin?.src ?? payload.data.purchase.tracking?.source`           |
| `origin.sck`               | `payload.data.purchase.origin?.sck ?? payload.data.purchase.tracking?.source_sck`       |
| `origin.xcode`             | `payload.data.purchase.origin?.xcode`                                                   |
| `externalCode`             | `payload.data.purchase.tracking?.external_code`                                         |
| `affiliateEmailHash`       | `sha256(payload.data.affiliations[0]?.affiliate.email)`                                 |
| `affiliateSource`          | derivado de `payload.data.purchase.tracking?.source === 'SPARKLE'`                      |
| `commissionAffiliateCents` | `Math.round(payload.data.commissions.find(c => c.source === 'AFFILIATE')?.value * 100)` |
| `feeCents`                 | `commissions.find(c => c.source === 'MARKETPLACE')?.value`                              |
| `producerNetCents`         | `commissions.find(c => c.source === 'PRODUCER')?.value`                                 |
| `allocationIdempotencyKey` | `payload.id` (v2) ou `sha256(transaction + status + creation_date)` (v1)                |

---

## Resumo executivo

- **O que travar antes de codar 1.4.5:** (a) decidir se MVP cobre só `PURCHASE_APPROVED/REFUNDED/CHARGEBACK + SUBSCRIPTION_CANCELLATION + ABANDON_CART` (recomendação) ou também billet/expired; (b) confirmar com fundador como tratar reembolso parcial em créditos (revoke proporcional vs all-or-nothing); (c) confirmar injection de `xcode = visitor_id` como mecanismo principal de visitor↔buyer matching (alternativa: UTM Stitcher por timestamp+IP); (d) **migration P1 schema:** `webhook_secret_hash` → `webhook_secret` plain cifrado, sem isso HMAC quebra.
- **O que adiar para TD:** Hotmart Club events, Sparkle deep attribution, Coupons API, OVERDUE polling, Tickets, multi-moeda display conversion, partial refund proportional credit, custom CAPI Custom Events para engagement.
- **Decisões abertas que dependem do fundador:**
  1. Schema separado `gateway_subscriptions` (estado) vs derivar tudo de `gateway_events` (event-sourced)? Recomendação: tabela separada, payback rápido no dashboard de MRR.
  2. Quando renovação falha (cartão recusado, sem webhook), polling 1x/dia é aceitável ou precisa real-time? Real-time exige polling agressivo; 1x/dia introduz lag de até 24h em "subscription churn alert".
  3. Sparkle attribution: em conflito com UTM da Criation, qual ganha no dashboard de "fonte da venda"? Hotmart manda o dinheiro pro afiliado independente — mas mostramos o quê?
  4. Wizard UX: aceitar que cliente faz registro de webhook 100% manual em painel separado, ou pagar dev-time para construir Chrome extension que automatiza? Recomendação: manual + Loom para 1.4.5; revisitar se beta reclama.
- **Reuso para 1.4.6/1.4.7:** o `GatewayAdapter` interface + `NormalizedGatewayEvent` schema + endpoint `/api/webhooks/gateway/[provider]/[connection_id]` + `processGatewayEvent` job são genéricos. Kiwify (1.4.6) e Eduzz/Monetizze/Ticto (1.4.7) só implementam `validateSignature` + `parseWebhook` + `normalizeEvent`. Isso é o ROI de fazer 1.4.5 direito.
- **Sugestão:** abrir **ADR-016 (Plataforma Hotmart)** durante prep da 1.4.5 documentando: Postback v2 como default, HOTTOK + HMAC dual-validation, `xcode = visitor_id` como mecanismo de matching, manual webhook registration via Loom, sandbox parcial → smoke test em prod com R$ 5. ADR-017 (Plataforma Kiwify) e adiante seguem o template.

**Arquivos relevantes:**

- `/Users/viniciusbenavides/App-Criation-Io/src/lib/db/schema/gateway.ts` — schema a expandir
- `/Users/viniciusbenavides/App-Criation-Io/src/lib/db/schema/connections.ts` — `gatewayConnections` a expandir (`webhook_secret` plain)
- `/Users/viniciusbenavides/App-Criation-Io/docs/adr/ADR-014-criation-as-cdp.md` — contexto CDP que sustenta `xcode=visitor_id`
- `/Users/viniciusbenavides/App-Criation-Io/docs/audits/META_API_2026-05.md` e `GOOGLE_API_2026-05.md` — modelo deste audit
- `/Users/viniciusbenavides/App-Criation-Io/ROADMAP.md` linhas 260-266 — sessões 1.4.5 a 1.4.9
