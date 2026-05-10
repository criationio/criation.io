# Auditoria Kiwify Public API / Webhooks — Sessão 1.4.6

**Data:** 2026-05-10
**Sessão de origem:** 1.4.6 (Kiwify adapter sobre infra da 1.4.5)
**Conduzida por:** agente de pesquisa (consultor de tracking/atribuição)
**Fontes:**

- `docs.kiwify.com.br/llms.txt` (catálogo completo: 106 URLs)
- `docs.kiwify.com.br/api-reference/webhooks/{create,single,list,edit,delete}` (REST de gestão)
- `docs.kiwify.com.br/api-reference/sales/single` (schema completo de venda)
- `docs.kiwify.com.br/api-reference/general` (rate limits, auth, response codes)
- `ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl` (UX cliente)
- `help.kiwify.com/en/article/understanding-webhook-functionality-15to8j` (UX cliente, EN)
- `github.com/CarlosDevlpr/Kiwi-Hook` (referência empírica de payload)
- ROADMAP §1.4.6 + ADR-016 (template de plataforma) + audit Hotmart 2026-05

> Este documento é a fonte canônica para decisões de plataforma Kiwify. Decisões formais entram em **ADR-017 (Plataforma Kiwify)** durante prep da 1.4.6. Onde houver conflito com a v0.6, este audit vence. **Sessão 1.4.6 deve ser BARATA porque herda 100% da infra da 1.4.5** (interface `GatewayAdapter`, schema `gateway_*`, webhook endpoint dinâmico, `processGatewayEvent` task). O delta é só o adapter (~3h).

---

## 1. Stack Kiwify correto em 2026 (resumo)

| Produto / endpoint                                                 | Versão / estado atual                                                                                                                                                                                                        | Nota crítica                                                                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Webhook v1** (única versão pública)                              | JSON inbound. Cliente registra URL no painel ou via `POST /v1/webhooks`. **Sem versionamento explícito** documentado — Kiwify pode mudar shape sem aviso.                                                                    | Diferente de Hotmart (v1+v2). Adapter precisa ser tolerante a campos novos/removidos.                                  |
| **Public REST API**                                                | `https://public-api.kiwify.com/v1/...`                                                                                                                                                                                       | Domain único versionado (mais simples que Hotmart que tem `/v1` e `/v2` por domínio).                                  |
| **OAuth client_credentials**                                       | `POST /oauth/token` com `client_id` + `client_secret` (em body ou Basic). Resposta tem `access_token` + `expires_in`. **Client secret expira em 96h — refresh manual obrigatório.**                                          | Mais agressivo que Hotmart (24h). Não há refresh_token. Cache em Redis com TTL 95h.                                    |
| **Header obrigatório**                                             | `x-kiwify-account-id: <UUID>` em TODA chamada REST.                                                                                                                                                                          | Diferente do Hotmart (não exige). Sem isso → 4xx.                                                                      |
| **Webhook secret**                                                 | `token` definido pelo CLIENTE na criação do webhook (string arbitrária tipo `w9i3pvutvxe`). Persistido no Kiwify, enviado em CADA webhook (provavelmente como query string `?token=xxx` — confirmar empiricamente no smoke). | Modelo OPOSTO ao Hotmart (HOTTOK global da conta). Mais granular: cada webhook tem seu próprio token. Bom pra rotação. |
| **Rate limit global**                                              | **100 requests/minute** por credencial. 429 quando excedido.                                                                                                                                                                 | **5x menor que Hotmart (500/min).** Throttler 1.5 req/s seguro. Backfill de muitas vendas → muito mais lento.          |
| **Sandbox**                                                        | Não documentado endpoint sandbox separado. Pratica: criar conta de teste produtor + webhook apontando pra URL de teste.                                                                                                      | Sem isolamento `?sandbox=true` flag. Smoke test obrigatoriamente em conta real.                                        |
| **Painel webhook**                                                 | `dashboard.kiwify.com.br` → Apps → Webhooks → Criar Webhook. UI tem botão "Testar Webhook" + acesso a logs de envio.                                                                                                         | Botão "Reenviar" pra retentativa manual (similar Hotmart).                                                             |
| **EdDSA chaves públicas** (`/listar-chaves-públicas-de-webhook`)   | **NÃO É da validação de webhook regular.** É da feature Banking PIX (assinar requests OUTBOUND do cliente pra Kiwify, headers `X-PoP-Challenge/Format/Signature`).                                                           | Confusão fácil. Webhook regular = token simples. PoP-Signature = banking outbound.                                     |
| **"Criar assinatura de webhook"** (`/criar-assinatura-de-webhook`) | **NÃO É chave criptográfica.** É uma SUBSCRIPTION da feature Banking (registra URL+events da família CASHIN.PIX.\*). Limit 10 subs/conta.                                                                                    | Outra confusão. Família Banking é separada do webhook de vendas regular.                                               |

---

## 2. Autenticação detalhada

**OAuth client_credentials (servidor-a-servidor):**

- **Endpoint:** `POST https://public-api.kiwify.com/v1/oauth/token`
- **Body (form-urlencoded):** `client_id=...&client_secret=...&grant_type=client_credentials`
- **Resposta:** `{ access_token, expires_in, token_type: "bearer" }`. **`expires_in` típico ~3600s (1h)**, mas o `client_secret` em si tem **TTL 96h** — depois disso a credencial morre e cliente regenera.
- **Header obrigatório em todas as chamadas:** `x-kiwify-account-id: <UUID>` + `Authorization: Bearer <access_token>`
- **Scopes documentados:** `webhooks`, `sales`, `affiliates`, `products`, `events`, `finance`. Granularidade boa — pedimos só o que usamos.

**Onde gerar credenciais no painel:** `dashboard.kiwify.com.br` → Configurações → API Pública → Criar Credencial. Cliente recebe `client_id` (UUID) + `client_secret` (string) + `account_id` (UUID).

**Sandbox vs prod:** Não há ambiente sandbox isolado. Smoke test = conta produtor de teste (cliente cria gratuitamente).

**Limitações de plano:** Kiwify exige plano mínimo (Premium ou superior) pra acesso ao Public API. Webhook funciona em todos os planos. Validar antes do onboarding.

---

## 3. Webhooks (inbound)

### Versão e formato

- **Sem versionamento** explícito no payload (não há campo `version` igual ao Hotmart v2).
- **Encoding:** `application/json`.
- **Estrutura:** payload é um JSON com campo discriminador `webhook_event_type` (ou similar — confirmar empiricamente). Top-level inclui `order_id`, `Customer`, `Product`, `Subscription`, `Commissions`, `Payment`, `tracking`, `affiliate_commission`, etc.

### Validação de assinatura (TOKEN simples)

Modelo Kiwify é **muito mais simples que Hotmart**:

- Cliente define `token` na criação do webhook (qualquer string).
- Kiwify entrega o token no inbound — provavelmente como **query string `?token=xxx`** (padrão observado pela comunidade) OU header `x-kiwify-token` (a confirmar).
- Validação: `incomingToken === storedToken` (comparação direta, NÃO HMAC).

**Não há HMAC documentado oficialmente para webhook regular.** Não há header `x-kiwify-signature`. Modelo é "shared secret simples".

**Implicação para nosso adapter:**

- `validateSignature` Kiwify lê token de **3 lugares** em ordem: query string `?token=`, header `x-kiwify-token`, body `payload.token`. Aceita o primeiro que bater.
- Defesa em camadas igual à Hotmart, mas conceitualmente mais simples (sem HMAC).
- Smoke test E2E obrigatório pra confirmar onde Kiwify entrega o token (provável: query string).

### Eventos completos (10 confirmados)

| Trigger                 | Quando dispara                                         | Categoria  | Ação no `processGatewayEvent`                                                              |
| ----------------------- | ------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| `compra_aprovada`       | Pagamento aprovado (cartão, PIX, boleto pago)          | Compra     | `creditService.allocate` (igual Hotmart `PURCHASE_APPROVED`)                               |
| `compra_recusada`       | Cartão recusado / pagamento rejeitado                  | Compra     | tracked sem ação                                                                           |
| `compra_reembolsada`    | Reembolso processado                                   | Compra     | `creditService.revoke` (1.7.5)                                                             |
| `chargeback`            | Disputa cartão                                         | Compra     | `creditService.revoke` (1.7.5)                                                             |
| `boleto_gerado`         | Cliente gerou boleto, **não pagou ainda**              | Compra     | tracked (similar a `PURCHASE_BILLET_PRINTED` Hotmart)                                      |
| `pix_gerado`            | QR Code PIX gerado, **não pagou ainda**                | Compra     | tracked                                                                                    |
| `carrinho_abandonado`   | Cliente abriu checkout, não finalizou                  | Compra     | tracked → fanout `InitiateCheckout` no CAPI Meta                                           |
| `subscription_canceled` | Assinatura cancelada (cliente ou produtor)             | Assinatura | `markSubscriptionCancelled`                                                                |
| `subscription_late`     | Assinatura em atraso (cobrança falhou, cartão expirou) | Assinatura | tracked + alerta de churn potencial                                                        |
| `subscription_renewed`  | **Renovação processada — evento DEDICADO**             | Assinatura | `creditService.allocate` (ciclo novo) + atualiza `gateway_subscriptions.currentRecurrence` |

**Vantagem sobre Hotmart:** evento `subscription_renewed` é DEDICADO. Não precisa inferir via `recurrence_number > 1` no `compra_aprovada`. Lógica de créditos fica mais limpa.

**Sem evento dedicado para:**

- Mudança de plano (sem `switch_plan`)
- Compra completa após garantia (sem `purchase_complete`)
- Reembolso parcial (sem evento — chega como `compra_reembolsada` ambíguo)
- Hotmart-equivalent `PURCHASE_PROTEST` (produtor disputou chargeback)

**Categorização para créditos (Regra 0):**

```ts
switch (event_type) {
  case 'compra_aprovada': allocate(amount=credits_per_cycle, source='subscription'|'pack')
  case 'subscription_renewed': allocate(amount=credits_per_cycle, source='subscription')
  case 'compra_reembolsada': revoke (1.7.5)
  case 'chargeback': revoke (1.7.5)
  case 'subscription_canceled': markCancelled (mantém créditos do ciclo atual)
  default: tracked, no_op
}
```

### Configuração no painel

**Passos manuais do produtor:**

1. `dashboard.kiwify.com.br` → Apps → **Webhooks** → **Criar Webhook**
2. Nome (ex: "Criation")
3. Selecionar produto (UUID específico OU "Todos os produtos")
4. Selecionar eventos (checkbox por evento — pode escolher subset)
5. Colar **URL** (nossa endpoint)
6. Definir **token** (cliente escolhe string arbitrária — recomendamos UUIDv4)
7. Salvar → botão **Testar Webhook** dispara payload de teste imediatamente

**Limitações:**

- **Sem API pública para criar webhook programaticamente?** **HÁ:** `POST /v1/webhooks` existe na doc. Se cliente nos der `client_id`/`client_secret`/`account_id`, **podemos criar o webhook automaticamente** — diferente do Hotmart. **Decisão:** oferecer fluxo "automatizado" (cliente cola credenciais OAuth → criamos webhook + token) E "manual" (cliente cola só token, registra URL ele mesmo). Wizard mais sofisticado que o Hotmart.
- **Múltiplas URLs:** sim, suportado.
- **Filtro por evento por URL:** sim, configurável.
- **Filtro por produto:** sim (UUID específico ou "all").
- **Histórico:** painel guarda logs com filtro de data + status sucesso/falha + payload + response. Botão "Reenviar" disponível.

**Retry policy:** **NÃO documentado oficialmente.** Comunidade reporta múltiplas tentativas com backoff. Botão manual "Reenviar" sempre funciona. **Implicação P1:** nosso endpoint precisa retornar 2xx em < 5s mesmo com processamento async (mesma estratégia Hotmart).

---

## 4. API REST detalhada

### Sales (`/v1/sales/...`)

- `GET /sales` — lista vendas com filtros (status, date range, product_id, customer_email).
- `GET /sales/{id}` — detalhes de uma venda (schema completo abaixo).
- `POST /sales/{id}/refund` — emite reembolso programaticamente.
- `GET /sales/stats` — agregados.

### Schema completo de uma venda (via `/sales/{id}`)

```jsonc
{
  "id": "fc96cec5-...", // UUID — chave principal
  "reference": "iYJwhMP", // ID curto exposto ao cliente
  "type": "product", // product | event | subscription
  "created_at": "2023-10-31T16:34:35Z",
  "updated_at": "2023-10-31T16:36:02Z",
  "status": "paid", // paid | refused | refunded | etc
  "payment_method": "credit_card", // credit_card | pix | boleto | paypal
  "approved_date": "2023-10-31T16:34:35Z",
  "refunded_at": null,
  "currency": "USD",
  "net_amount": 8853, // CENTS líquido
  "installments": 12,
  "card_last_digits": "1115",
  "card_type": "mastercard",
  "card_rejection_reason": null,
  "boleto_url": null,
  "is_one_click": true,
  "two_cards": false,
  "parent_order_id": null, // RENOVAÇÃO aponta pra venda inicial!
  "sale_type": "producer", // producer | affiliate | coproducer

  "product": {
    "id": "aaa86f40-d7ae-...",
    "name": "My Product",
  },

  "customer": {
    "id": "b17dd04e-...",
    "name": "my customer",
    "email": "mycustomer@mail.com",
    "cpf": "99999999999", // PII LGPD-sensitive — HASH antes de persistir
    "cnpj": null,
    "mobile": "+5599999999999",
    "instagram": "y_instagram",
    "country": "BR",
    "address": {
      "street": "...",
      "number": "...",
      "complement": "...",
      "neighborhood": "...",
      "city": "...",
      "state": "...",
      "zipcode": "...",
    },
  },

  "shipping": {
    "id": "...",
    "name": "Entrega Grátis",
    "price": 0,
  },

  "payment": {
    "charge_amount": 10388, // CENTS bruto cobrado
    "charge_currency": "BRL",
    "net_amount": 8853,
    "product_base_price": 60037,
    "product_base_currency": "BRL",
    "settlement_amount": 8853,
    "settlement_currency": "USD", // multi-moeda nativo
    "fee": 984, // CENTS taxa Kiwify
    "fee_currency": "USD",
    "sale_tax_rate": 5.6,
    "sale_tax_amount": 551,
  },

  "tracking": {
    "sck": null,
    "src": null,
    "utm_campaign": null,
    "utm_content": null,
    "utm_medium": null,
    "utm_source": null,
    "utm_term": null,
    "s1": null,
    "s2": null,
    "s3": null, // 3 slots EXTRAS além de UTMs (único da Kiwify)
  },

  "revenue_partners": [
    // coprodutores
    {
      "account_id": "...",
      "legal_name": "...",
      "document_id": "...",
      "percentage": 50,
      "net_amount_split": 4426,
      "charge_amount_split": 5000,
    },
  ],

  "affiliate_commission": {
    // único objeto, não array (1 afiliado por venda)
    "name": "...",
    "document": "...",
    "email": "...",
    "amount": 2849, // CENTS
  },
}
```

**Campos críticos para Criation:**

- `id` (UUID) — usar como `provider_event_id` (idempotência forte)
- `parent_order_id` — RENOVAÇÃO aponta pra venda inicial. **Atribuição automática:** subscription_renewed.parent_order_id → busca origin da venda inicial → herda atribuição. Não precisamos de `gateway_subscriptions.origin` snapshot manual igual no Hotmart (mas vamos manter por consistência cross-provider).
- `tracking.s1/s2/s3` — slots livres da Kiwify. **Decisão:** injetar nosso `visitor_id` em `s1` (paralelo ao `xcode` Hotmart). UTM Stitcher 1.4.B usa `s1` ou query string original.
- `payment.fee` + `payment.net_amount` — separados nativamente. Hotmart não tem.
- `payment.settlement_currency` ≠ `payment.charge_currency` — multi-moeda nativo (cliente paga em BRL, settlement em USD por exemplo).

### Outros endpoints

- `GET /v1/products` + `GET /v1/products/{id}` — catálogo
- `GET /v1/affiliates` + variantes — afiliados ativos
- `GET /v1/finance/balance` + `/v1/finance/payouts` — saldo + extratos
- **Banking (PIX):** família COMPLETAMENTE separada (`/v1/conta/...`, `/v1/qr-codes-pix/...`, `/v1/enviar-pix/...`, `/v1/pagar-boletos/...`). **Fora de escopo Criation** — ignorar.
- **Subscriptions:** **não há endpoint dedicado `/v1/subscriptions`** documentado. Estado de subscription deriva de `/sales` filtrado por `type=subscription` ou `parent_order_id` recursivo. Limitação real — derivamos do log de eventos.

**Backfill MVP — endpoints prioritários para 1.4.6:**

1. `/v1/sales?date_from=...&date_to=...` (90d) — popular `gateway_events` retroativo (status=`backfill_skipped`)
2. `/v1/products` — popular `gateway_products`
3. **Sem `/subscriptions`** — derivamos a partir de eventos `compra_aprovada` (recurrence inicial) + `subscription_renewed`.

---

## 5. Modelo de dados Kiwify

**Hierarquia simplificada:**

```
Account (account_id UUID)
 └─ Products (id, name, type [product|event|subscription])
     └─ Sales / Orders (id UUID, reference curta, status)
         └─ Renovações: nova Sale com parent_order_id = sale inicial
         └─ Refunds: emitidos via POST /sales/{id}/refund (cria evento webhook)
```

**IDs principais:**

- `sale.id` — UUID v4 (Customer/Product/Subscription todos têm UUIDs próprios também)
- `sale.reference` — string curta human-readable (ex: `iYJwhMP`)
- `parent_order_id` — UUID da sale inicial (presente em renovações)
- `webhook.id` — UUID da config de webhook
- `webhook.token` — string arbitrária definida pelo cliente

**Subscription flow:**

- `compra_aprovada` (parent_order_id=null, type='subscription') → primeira venda. Aloca créditos.
- `subscription_renewed` (parent_order_id=ID da inicial) → renovação. Aloca créditos do ciclo novo.
- `subscription_late` → cobrança falhou. **Cliente ainda tem acesso até cancelamento ativo.**
- `subscription_canceled` → cancelada definitivamente. Mantém créditos do ciclo atual.

**Reembolso:** `compra_reembolsada` chega como evento próprio. Olhar `payment.refunded_at` na sale pra confirmar.

---

## 6. UTMs e atribuição

**Tese:** Kiwify é **MUITO MELHOR que Hotmart** em UTM tracking. Captura todos os 5 UTMs padrão + `src` + `sck` + 3 slots livres `s1/s2/s3`.

**Disponível no payload do webhook (via `tracking`):**

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` — padrão completo
- `src`, `sck` — Kiwify-specific (paralelos ao Hotmart)
- `s1`, `s2`, `s3` — slots livres pro produtor usar como quiser

**Mecanismo `s1 = visitor_id` (defesa em camadas igual Hotmart):**

- Injetamos visitor_id no link de checkout: `?s1=<visitor_id>` (sem limite de 30 chars como Hotmart `xcode`!)
- Webhook traz `tracking.s1 = <visitor_id>` → matching determinístico 1:1
- Persiste em `gateway_events.external_code` (nossa coluna canônica)
- UTM Stitcher 1.4.B usa fallback temporal se `s1` ausente

**UTMs em renovação:**

- A confirmar empiricamente: `subscription_renewed` provavelmente HERDA `tracking` da venda inicial via `parent_order_id`. Hotmart faz o mesmo.
- Implicação: renovações são atribuídas à campanha original, não à atual.

**Click IDs nativos (`fbclid`, `gclid`, `ttclid`):**

- Kiwify **não captura** nativamente nos campos `tracking`. Mesma limitação Hotmart.
- Cliente pode injetar via `s1`/`s2`/`s3` se quiser, mas é workaround manual.
- Solução real: nosso CDP (1.4.A) captura no browser e correlaciona via `s1=visitor_id`.

---

## 7. Gaps de schema vs `gateway_events` / `gateway_products` atual

**Boa notícia:** schema da 1.4.5 já é **provider-agnostic suficiente**. Quase nenhum delta.

### `gateway_events` — adições (opcionais, se quisermos campos nativos Kiwify)

```diff
+ saleReference text                  -- sale.reference (ex 'iYJwhMP') — útil pra link humano
+ parentOrderId text                  -- parent_order_id em renovações (substitui inferência via subscriber_code)
+ s1, s2, s3 text                     -- slots livres Kiwify (alternativa: persistir em origin jsonb)
+ settlementCurrency text             -- payment.settlement_currency (multi-moeda)
+ settlementAmountCents integer       -- payment.settlement_amount
+ saleTaxRate decimal                 -- sale.payment.sale_tax_rate
+ saleTaxAmountCents integer          -- sale.payment.sale_tax_amount
```

**Decisão pragmática para MVP 1.4.6:** **NÃO mexer no schema.** Persistir tudo em `origin jsonb` (que já é catch-all) + reusar `external_code` para `s1`. Migração só se 1.4.7+ ou dashboards específicos pedirem coluna dedicada.

### `gateway_products` — adições

```diff
+ productKind text                    -- 'product' | 'event' | 'subscription' (Kiwify nativo)
```

Ignorar no MVP. Salvar em `format` que já existe.

### `gatewayConnections` — adições

```diff
(nenhuma)
```

Schema da 1.4.5 já cobre: `webhookSecret` (token Kiwify), `apiCredentials jsonb` (client_id/secret/account_id), `webhookVersion` (default 'v1' pra Kiwify), `providerSubaccountId` (account_id Kiwify).

**Mapping de campos no INSERT da connection Kiwify:**

- `webhookSecret` ← `encrypt(token_definido_pelo_cliente)`
- `apiCredentials` ← `{ client_id, encrypted_client_secret, account_id, sandbox: false }`
- `providerSubaccountId` ← `account_id`
- `webhookVersion` ← `'v1'`

### Novo NormalizedEventType (types.ts)

```diff
+ 'SUBSCRIPTION_RENEWED'              -- Kiwify tem evento dedicado, Hotmart infere via recurrence_number
+ 'SUBSCRIPTION_LATE'                 -- Kiwify específico (cobrança falhou)
+ 'PIX_GENERATED'                     -- Kiwify específico (PIX QR criado, não pago)
+ 'PURCHASE_REJECTED'                 -- Kiwify 'compra_recusada' (cartão recusado)
```

Hotmart equivalents:

- `subscription_renewed` Kiwify ↔ Hotmart manda `PURCHASE_APPROVED` com `recurrence_number > 1`
- `subscription_late` Kiwify ↔ Hotmart **não tem evento** (gap Hotmart, vantagem Kiwify)
- `pix_gerado` Kiwify ↔ Hotmart provavelmente equivale a `PURCHASE_BILLET_PRINTED` (boleto pendente)
- `compra_recusada` Kiwify ↔ Hotmart **não emite evento** explícito (gap)

---

## 8. Riscos e armadilhas

1. **Token NÃO documentado onde vem.** Doc oficial omite se `token` chega em query string, header ou body. Comunidade aponta query string. **Smoke test E2E obrigatório** pra confirmar antes de codar validateSignature definitivo. Adapter aceita os 3 caminhos pra ser robusto.
2. **Client secret expira em 96h.** Diferente de Hotmart (sem expiração de credencial). Cliente precisa regenerar e atualizar nossa connection. **TD: cron de monitoramento** que detecta erro 401 e marca connection como `expired` + alerta cliente.
3. **Rate limit 100/min global.** 5x menor que Hotmart. Backfill de cliente com 5000+ vendas pode demorar 50+ minutos. Trigger.dev task com `maxDuration` adequado.
4. **Sem versionamento explícito do payload webhook.** Kiwify pode mudar shape sem aviso. **Defensa:** parser Zod com `.passthrough()` em todo lugar + telemetria de campo desconhecido em logs.
5. **Sem endpoint `/subscriptions` REST.** Estado deriva do log de eventos + `parent_order_id` recursivo. `gateway_subscriptions` (nossa tabela materializada) é mais útil aqui que no Hotmart porque não tem fonte autoritativa REST.
6. **Sem ambiente sandbox isolado.** Smoke test = conta real de teste com produto de R$ 5,00. Aceita igual Hotmart.
7. **Reembolso parcial:** mesma situação Hotmart. Sem evento dedicado. Decisão all-or-nothing herdada (ADR-016 dec.5).
8. **Multi-moeda nativo:** `payment.settlement_currency` ≠ `payment.charge_currency`. Cliente paga em BRL, settlement em USD/EUR. **Persistir AMBOS** (`amountCents` no charge_currency, `producerNetCents` no settlement_currency, com flag de currency em cada). MVP: persistir só charge_amount em `amountCents` + currency.
9. **PII pesada no payload:** `customer.email`, `customer.cpf`, `customer.cnpj`, `customer.mobile`, `customer.address.*` (street, zipcode, etc), `customer.instagram`. **Hash imediato no parser** antes de logger ver. `address.zipcode + city + state` agregado é PII contextual — redactar.
10. **Token DEFINIDO PELO CLIENTE no painel Kiwify.** Implicação: no nosso wizard, **GERAMOS** um token random (UUIDv4) e mostramos pra cliente colar no painel Kiwify. Se cliente colar um token diferente, validação falha. **UX defensiva:** mostrar token gerado num campo "copy", instruir explicitamente "cole exatamente este valor no campo Token do painel Kiwify".
11. **Webhook config tem `products` field** (UUID específico OU "all"). Cliente pode acidentalmente marcar só 1 produto e nunca receber eventos dos outros. **Wizard sugere "Todos os produtos" como default.**
12. **Botão "Reenviar" no painel Kiwify tem 1 limite** que comunidade não conhece — pode ser 5x ou ilimitado. Não confiar. DLQ nosso é a verdade.
13. **`payment_method: 'pix'`** vs evento `pix_gerado`: PIX gerado = QR criado mas não pago; Compra aprovada com payment_method=pix = pago. Não confundir.
14. **`type: 'event'`** (produto evento — ingressos): tem schema `/v1/events/{product_id}/participants` separado. **Fora do MVP 1.4.6.**
15. **Affiliate commission é OBJETO único, não array.** Diferente do Hotmart que tem `affiliations` array. 1 afiliado por venda no Kiwify (no max).
16. **Coprodutores em `revenue_partners` array** com `percentage` + `net_amount_split`. Útil pra rateio em dashboards futuros (TD).

---

## 9. Recomendações concretas para Sessão 1.4.6

Análogo ao que fizemos pra Hotmart na 1.4.5, mas MUITO mais barato — herdamos toda a infra. Lista priorizada:

1. **Adapter em `src/lib/services/gateways/kiwify/`** seguindo padrão Hotmart:
   - `index.ts` (implementa `GatewayAdapter`)
   - `signature.ts` (token tri-camada: query string + header + body)
   - `parser.ts` (Zod schema com passthrough generoso)
   - `normalizer.ts` (mapping table, PII hashing, helpers)
   - `index.test.ts`, `signature.test.ts`, `parser.test.ts`, `normalizer.test.ts`
   - **Sem oauth.ts/api.ts/throttler.ts no MVP** — mesma decisão MVP da 1.4.5 (Webhook only, REST adiado).
2. **Registrar `kiwify` no map ADAPTERS** em `route.ts`. UMA linha.
3. **Adicionar 4 novos NormalizedEventType:** `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_LATE`, `PIX_GENERATED`, `PURCHASE_REJECTED` em `types.ts`.
4. **`processGatewayEvent` switch:** adicionar cases:
   - `SUBSCRIPTION_RENEWED` → mesma lógica que `PURCHASE_APPROVED` mas sem criar subscription nova (já existe). UPSERT subscription com `currentRecurrence + 1`. Allocate via creditService.
   - `SUBSCRIPTION_LATE`, `PIX_GENERATED`, `PURCHASE_REJECTED` → tracked sem ação.
5. **Validators Zod:** `connectKiwifySchema = { token, sandbox?: false }` apenas. Token é gerado no cliente (UUIDv4 sugerido) ou cliente cola um próprio.
6. **Server action `connectKiwify`:** quase idêntica ao `connectHotmart` — recebe token, encrypt, INSERT, devolve webhookUrl + token gerado pra cliente colar no painel.
7. **UI wizard `/configuracoes/gateways/kiwify/connect`:** 1 tela igual Hotmart, mas com twist:
   - Geramos UUIDv4 como token sugerido (cliente pode usar ou fornecer próprio)
   - Mostramos URL gerada + token sugerido em DOIS campos copy
   - Instruções: "vá em dashboard.kiwify.com.br → Apps → Webhooks → Criar Webhook, cole a URL e o token, marque os 10 eventos"
8. **Schema migration:** **NENHUMA** (tudo cobre o que precisamos via `origin jsonb` + colunas existentes).
9. **Audit em `docs/audits/KIWIFY_API_2026-05.md`** (este arquivo) + ADR-017.
10. **Testes Vitest:** ~20-25 testes (signature 3-camada, parser eventos chave, normalizer mapping table).
11. **Telemetria:** `criation_gateway_kiwify_connected`.
12. **Fora do MVP 1.4.6 (TD lista):** OAuth + REST API client, backfill 90d, `/v1/affiliates` integration, multi-moeda settlement display, automated webhook creation via OAuth, monitoramento de client_secret expirado (96h).

---

## 10. Mapping table NormalizedGatewayEvent ← Kiwify

```ts
// src/lib/services/gateways/kiwify/normalizer.ts (esqueleto)

export function normalizeKiwifyEvent(parsed: KiwifyWebhookPayload): NormalizedGatewayEvent {
  return {
    provider: 'kiwify',
    providerEventId: parsed.order_id ?? parsed.id, // UUID idempotency
    providerEventVersion: '1.0.0', // sem versionamento real
    eventType: mapKiwifyEventType(parsed.webhook_event_type),
    occurredAt: new Date(parsed.created_at ?? parsed.approved_date),
    occurredAtMs: Date.parse(parsed.created_at ?? parsed.approved_date),
    amountCents: parsed.payment?.charge_amount ?? parsed.net_amount ?? 0,
    feeCents: parsed.payment?.fee,
    producerNetCents: parsed.payment?.net_amount,
    currency: parsed.payment?.charge_currency ?? parsed.currency ?? 'BRL',
    productId: parsed.product?.id ?? '',
    productName: parsed.product?.name,
    offerId: undefined, // Kiwify não tem offer code separado
    subscriberCode: parsed.parent_order_id ?? parsed.id, // chave de subscription
    subscriptionStatus: undefined, // derivado por evento
    recurrenceNumber: parsed.parent_order_id ? 2 : 1, // heurística
    paymentMethod: mapKiwifyPaymentMethod(parsed.payment_method),
    installmentsNumber: parsed.installments,
    buyerCountry: parsed.customer?.country,
    buyerEmailHash: parsed.customer?.email ? hashEmail(parsed.customer.email) : '',
    buyerPhoneHash: parsed.customer?.mobile ? hashPhone(parsed.customer.mobile) : undefined,
    buyerDocumentHash: parsed.customer?.cpf
      ? hashDocument(parsed.customer.cpf)
      : parsed.customer?.cnpj
        ? hashDocument(parsed.customer.cnpj)
        : undefined,
    affiliateEmailHash: parsed.affiliate_commission?.email
      ? hashEmail(parsed.affiliate_commission.email)
      : undefined,
    affiliateSource: parsed.affiliate_commission ? 'EXTERNAL' : undefined,
    commissionAffiliateCents: parsed.affiliate_commission?.amount,
    attribution: {
      utms: {
        source: parsed.tracking?.utm_source,
        medium: parsed.tracking?.utm_medium,
        campaign: parsed.tracking?.utm_campaign,
        content: parsed.tracking?.utm_content,
        term: parsed.tracking?.utm_term,
      },
      origin: {
        src: parsed.tracking?.src,
        sck: parsed.tracking?.sck,
        // s1/s2/s3 vão para origin (catch-all jsonb)
      },
      externalCode: parsed.tracking?.s1, // visitor_id se injetamos
    },
    allocationIdempotencyKey: parsed.order_id ?? parsed.id,
    rawPayload: redactPayload(parsed),
  }
}

function mapKiwifyEventType(raw: string): NormalizedEventType {
  const map: Record<string, NormalizedEventType> = {
    compra_aprovada: 'PURCHASE_APPROVED',
    compra_recusada: 'PURCHASE_REJECTED',
    compra_reembolsada: 'PURCHASE_REFUNDED',
    chargeback: 'PURCHASE_CHARGEBACK',
    boleto_gerado: 'PURCHASE_BILLET_PRINTED',
    pix_gerado: 'PIX_GENERATED',
    carrinho_abandonado: 'PURCHASE_OUT_OF_SHOPPING_CART',
    subscription_canceled: 'SUBSCRIPTION_CANCELLATION',
    subscription_late: 'SUBSCRIPTION_LATE',
    subscription_renewed: 'SUBSCRIPTION_RENEWED',
  }
  return map[raw] ?? 'UNKNOWN'
}
```

---

## Resumo executivo

- **O que travar antes de codar 1.4.6:** (a) confirmar empiricamente onde o token chega (query string vs header vs body) — smoke test obrigatório com webhook.site primeiro; (b) decidir se geramos token UUIDv4 sugerido OU deixamos cliente colar próprio; (c) escopo dos novos `NormalizedEventType` (recomendo adicionar 4: SUBSCRIPTION_RENEWED, SUBSCRIPTION_LATE, PIX_GENERATED, PURCHASE_REJECTED).
- **O que adiar para TD:** OAuth + REST API client (backfill 90d, products sync), `/v1/affiliates`, multi-moeda settlement display, automated webhook creation via OAuth (cliente nos dá `client_id`+`client_secret`+`account_id` → criamos webhook programaticamente), monitoramento client_secret 96h, payouts/finance integration.
- **Decisões abertas que dependem do fundador:**
  1. Geramos token UUIDv4 sugerido ou cliente cola próprio? Recomendação: **gerar UUIDv4** (baixa fricção + mais seguro que cliente escolher "123").
  2. Suporte a webhook automation via OAuth (POST /v1/webhooks)? Recomendação: **adiar pra TD** — cliente Kiwify hoje cola 1 token, registra URL no painel. Se beta reclamar, evoluímos.
  3. Multi-moeda settlement: persistir só `charge_currency`/`charge_amount` no MVP, ou já persistir settlement separado? Recomendação: **só charge no MVP** (consistente com Hotmart).
- **Reuso da 1.4.5:** `GatewayAdapter` interface + `NormalizedGatewayEvent` schema + endpoint `/api/webhooks/gateway/[provider]/[connection_id]` + `processGatewayEvent` job + `gateway_*` schema + helpers PII + UI shell. **Custo da 1.4.6: ~3h, não 5h.**
- **Sugestão:** abrir **ADR-017 (Plataforma Kiwify)** durante prep da 1.4.6 documentando: token tri-camada (query/header/body), client-defined token (geramos UUIDv4 sugerido), `subscription_renewed` evento dedicado (vs Hotmart inferência), s1=visitor_id, sem REST/backfill no MVP. ADR-018+ (Eduzz/Monetizze/Ticto) seguem template.

**Arquivos relevantes:**

- `/Users/viniciusbenavides/App-Criation-Io/src/lib/services/gateways/types.ts` — adicionar 4 NormalizedEventType
- `/Users/viniciusbenavides/App-Criation-Io/src/lib/services/gateways/hotmart/` — template visual pro KiwifyAdapter
- `/Users/viniciusbenavides/App-Criation-Io/src/app/api/webhooks/gateway/[provider]/[connection_id]/route.ts` — adicionar `kiwify` ao map ADAPTERS
- `/Users/viniciusbenavides/App-Criation-Io/src/lib/trigger/tasks/process-gateway-event.ts` — adicionar cases para SUBSCRIPTION_RENEWED + 3 outros
- `/Users/viniciusbenavides/App-Criation-Io/docs/audits/HOTMART_API_2026-05.md` — modelo deste audit
- ROADMAP.md linha 261 — sessão 1.4.6 (~3h após audit) — Kiwify adapter
