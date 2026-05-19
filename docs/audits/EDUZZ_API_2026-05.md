# Auditoria Eduzz Webhook v3 — Sessão 1.4.7

**Data:** 2026-05-10
**Sessão de origem:** 1.4.7 (Eduzz adapter + Webhook genérico)
**Fontes:**

- `developers.eduzz.com/docs/webhook` (introdução)
- `developers.eduzz.com/docs/webhook/security` (HMAC-SHA256)
- `developers.eduzz.com/docs/webhook/create` (configuração)
- `developers.eduzz.com/docs/webhook/ping` (healthcheck)
- `developers.eduzz.com/reference/webhook/myeduzz-invoice-paid` (schema completo invoice)
- `github.com/eduzz/webhook/blob/master/campos-fatura.md` (campos legacy v2)
- ADR-016 (Hotmart) + ADR-017 (Kiwify) — herda 100% da infra `GatewayAdapter`

> **Eduzz é o adapter mais limpo dos 3 brasileiros.** Doc oficial bem escrita, envelope padronizado, HMAC-SHA256 (vs SHA1 Kiwify), eventos namespaced. Sessão 1.4.7 deve ser **rápida** (~1.5h) porque herda toda infra + Eduzz não tem armadilhas como Kiwify (sem PascalCase variável, sem `null` em campos opcionais inesperados, sem case insensitive).

---

## 1. Stack Eduzz Webhook v3 em 2026

| Aspecto           | Detalhe                                                                                                                                                                                                        | Comparação                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Envelope JSON** | `{id, event, data, sentDate}` em todo webhook. `event` no formato `app.action` (ex: `myeduzz.invoice_paid`).                                                                                                   | Mais limpo que Kiwify (sem envelope) e tão estruturado quanto Hotmart v2.                        |
| **Autenticação**  | **HMAC-SHA256** com header `x-signature`. `signature = hmac_sha256(secret_key, raw_body).hex()`.                                                                                                               | Mais forte que Kiwify (SHA1) e melhor design que Hotmart (HOTTOK plain ou HMAC opcional).        |
| **Secret key**    | Cliente gera no painel `integrations.eduzz.com/webhook/configs` (1 ou múltiplas keys por config).                                                                                                              | Similar Kiwify (gerado pelo provider, cliente cola); diferente Hotmart (HOTTOK global da conta). |
| **Apps Eduzz**    | 6 apps com eventos próprios: **MyEduzz** (vendas/assinaturas), **Sun** (carrinho), **AlpaClass** (alunos/certificados), **Blinket** (eventos presenciais), **Nutror** (cursos online), **SafeVideo** (upload). | Multi-app é único do Eduzz. Pra Criation só **MyEduzz + Sun** importam (vendas + carrinho).      |
| **Configuração**  | Cliente cria webhook em `Configurações → Webhook`: nome, key, URL destino, **limite de paralelismo**, eventos.                                                                                                 | Limite de paralelismo é único — útil pra não sobrecarregar nosso endpoint em campanhas grandes.  |
| **Ping event**    | Auto-disparado em criação/edição da config + manual. Payload: `{event: 'ping', data: {message: 'ping'}}`. Esperado HTTP 2xx.                                                                                   | Tipo Kiwify "Testar Webhook" mas explícito + automático em ativação.                             |
| **Retry**         | Não documentado oficialmente. Histórico de webhooks acessível via `/docs/webhook/history`.                                                                                                                     | Tipo Hotmart/Kiwify (manual reenvio via painel).                                                 |
| **Tracking**      | `data.utm.{source,medium,campaign,content,term}` + `data.tracker.{code1,code2,code3}` (3 slots livres).                                                                                                        | `tracker.code1` = nosso `visitor_id` (paralelo a `s1` Kiwify, `xcode` Hotmart).                  |

---

## 2. Eventos relevantes pra Criation

### MyEduzz — Faturas (12 eventos)

| Evento Eduzz                      | Quando dispara                                | Canonical Criation                                                     | Ação                       |
| --------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `myeduzz.invoice_paid`            | Pagamento aprovado                            | `PURCHASE_APPROVED`                                                    | allocate                   |
| `myeduzz.invoice_refused`         | Cartão recusado                               | `PURCHASE_REJECTED`                                                    | tracked                    |
| `myeduzz.invoice_refunded`        | Reembolso processado                          | `PURCHASE_REFUNDED`                                                    | revoke (1.7.5)             |
| `myeduzz.invoice_canceled`        | Fatura cancelada antes pagamento              | `PURCHASE_CANCELED`                                                    | tracked                    |
| `myeduzz.invoice_expired`         | Boleto/PIX expirou sem pagamento              | `PURCHASE_EXPIRED`                                                     | tracked                    |
| `myeduzz.invoice_overdue`         | Boleto vencido (em janela tolerância)         | `PURCHASE_DELAYED`                                                     | tracked                    |
| `myeduzz.invoice_waiting_payment` | Boleto/PIX gerado, aguardando                 | `PURCHASE_BILLET_PRINTED` ou `PIX_GENERATED` (depende `paymentMethod`) | tracked                    |
| `myeduzz.invoice_waiting_refund`  | Pedido reembolso aberto, ainda não processado | `PURCHASE_REFUND_REQUESTED`                                            | tracked (não revoga ainda) |
| `myeduzz.invoice_recovering`      | Sistema tentando recuperar venda perdida      | (UNKNOWN/tracked)                                                      | tracked                    |
| `myeduzz.invoice_scheduled`       | Fatura agendada (assinatura futura)           | (UNKNOWN/tracked)                                                      | tracked                    |
| `myeduzz.invoice_negotiated`      | Parcelamento renegociado                      | (UNKNOWN/tracked)                                                      | tracked                    |
| `myeduzz.invoice_opened`          | Fatura criada (pendente)                      | (UNKNOWN/tracked)                                                      | tracked                    |

### MyEduzz — Contratos/Assinaturas (3 eventos)

| Evento Eduzz                      | Quando dispara          | Canonical Criation                          |
| --------------------------------- | ----------------------- | ------------------------------------------- |
| `myeduzz.contract_created`        | Assinatura criada       | (tracked, atualiza `gateway_subscriptions`) |
| `myeduzz.contract_updated`        | Assinatura atualizada   | (tracked, sync state)                       |
| `myeduzz.contract_card_attempted` | Cobrança cartão tentada | `SUBSCRIPTION_LATE` quando falha            |

### MyEduzz — Comissões (1 evento)

| Evento Eduzz                   | Canonical                               |
| ------------------------------ | --------------------------------------- |
| `myeduzz.commission_processed` | (TD: dashboard de comissões — fora MVP) |

### Sun — Carrinho

| Evento Eduzz                                                | Canonical                       |
| ----------------------------------------------------------- | ------------------------------- |
| `sun.cart_abandoned` (nome estimado — confirmar smoke real) | `PURCHASE_OUT_OF_SHOPPING_CART` |

### **Renovação de assinatura: detectada via heurística**

Eduzz **não tem evento dedicado** `subscription_renewed`. Detecta via:

- `myeduzz.invoice_paid` + `data.contract.id` presente + não é a primeira invoice do contract (precisa cross-reference em `gateway_events` por mesmo `subscriberCode`)
- OU pelo campo `recurrence_count` (se exposto na v3) > 1

Adapter inicial: marca como `PURCHASE_APPROVED` e usa lógica do `processGatewayEventTask` pra detectar `currentRecurrence` via `gateway_subscriptions.charges.completed.length` (mesma heurística Kiwify).

---

## 3. Schema do payload `myeduzz.invoice_paid` (envelope completo)

```jsonc
{
  "id": "z154l2pvk6jltotg0xy86glx",
  "event": "myeduzz.invoice_paid",
  "sentDate": "2026-05-10T18:34:23.023Z",
  "data": {
    "id": "uuid-da-fatura",                    // → providerEventId
    "status": "paid",
    "buyer": {
      "id": "string", "name": "...",
      "document": "12345678910",                // CPF ou CNPJ misturado
      "email": "buyer@example.com",
      "phone": "+5511...", "phone2": null, "cellphone": "+5511...",
      "address": { /* street, number, neighborhood, complement, city, state, country, zipCode */ }
    },
    "producer": {
      "id": "string", "name": "...", "email": "...",
      "originSecret": "string"                  // secret de webhook (já validado)
    },
    "offer": { "name": "..." },
    "utm": { "source", "medium", "campaign", "content", "term" },
    "tracker": { "code1", "code2", "code3" },   // s1/s2/s3 equivalent
    "createdAt": "ISO-8601", "dueDate": "ISO-8601", "paidAt": "ISO-8601|null",
    "price": { "currency": "BRL", "value": 49.90 },     // bruto
    "paid":  { "currency": "BRL", "value": 49.90 },     // recebido
    "installments": 12,
    "paymentMethod": "credit_card | pix | bank_slip | ...",
    "transaction": { "id", "key" },
    "barcode": "string|null",
    "billetUrl": "string|null",
    "checkoutUrl": "string",
    "bankslipUrl": "string|null",
    "items": [
      {
        "productId", "name", "parentId",
        "refundPeriod": { "durationType", "value" },
        "price": { "currency", "value" },
        "coupon": { "id", "key", "discount": {...} },
        "partnerId", "billingType", "skuReference"
      }
    ],
    "totalItems": 1,
    "orderBump": { "has", "isMainSale", "mainSaleId" },  // único Eduzz
    "affiliate": { "id", "name", "email" } | null,
    "chargeback": { "status", "createdAt", "limitDate", "finishedAt" } | null,
    "contract": { "id", "isUnlimitedInstallments" } | null,
    "bankSlipInstallment": { "installmentNumber", "totalInstallments" } | null,
    "student": { "id", "name", "document", "email", "phone", ... } | null,
    "payment": { "method", "details" }
  }
}
```

**Pontos de atenção:**

- **`buyer.document`**: misto CPF/CNPJ — sem distinção. Hash com `hashDocument()` resolve.
- **`originSecret`**: vem no payload como segurança redundante (além do HMAC). Validar opcionalmente como camada extra.
- **`tracker.code1`** = nosso `visitor_id` quando injetamos no checkout via query string.
- **`orderBump`**: explícito — útil pra TD futuro de dashboards de upsell. MVP ignora.
- **`contract.id`**: link pra subscription. Usa como `subscriberCode` quando presente.
- **Sem `addressIp`** no payload — diferente de Kiwify. Sem feature de IP allowlist por isso.

---

## 4. Mapping pra `NormalizedGatewayEvent`

```ts
function normalizeEduzzEvent(envelope: EduzzEnvelope): NormalizedGatewayEvent {
  const { id, event, data, sentDate } = envelope
  const eventType = mapEduzzEvent(event, data?.paymentMethod)
  const buyer = data?.buyer ?? {}
  const tracker = data?.tracker ?? {}

  return {
    provider: 'eduzz',
    providerEventId: id, // envelope.id (UUID-ish)
    providerEventVersion: '3.0.0', // Eduzz Webhook v3
    eventType,
    occurredAt: new Date(sentDate),
    occurredAtMs: Date.parse(sentDate),
    amountCents: Math.round((data?.paid?.value ?? data?.price?.value ?? 0) * 100),
    currency: data?.paid?.currency ?? data?.price?.currency ?? 'BRL',
    productId: data?.items?.[0]?.productId ?? '',
    productName: data?.items?.[0]?.name,
    paymentMethod: mapPaymentMethod(data?.paymentMethod),
    installmentsNumber: data?.installments,
    subscriberCode: data?.contract?.id ?? undefined, // contract = subscription
    buyerEmailHash: buyer.email ? hashEmail(buyer.email) : '',
    buyerPhoneHash:
      buyer.cellphone || buyer.phone ? hashPhone(buyer.cellphone ?? buyer.phone) : undefined,
    buyerDocumentHash: buyer.document ? hashDocument(buyer.document) : undefined,
    buyerCountry: buyer.address?.country ?? undefined,
    affiliateEmailHash: data?.affiliate?.email ? hashEmail(data.affiliate.email) : undefined,
    affiliateSource: data?.affiliate ? 'EXTERNAL' : undefined,
    attribution: {
      utms: { ...data?.utm },
      origin: { src: tracker.code2, sck: tracker.code3 },
      externalCode: tracker.code1, // visitor_id determinístico
    },
    allocationIdempotencyKey: id, // envelope.id
    rawPayload: redactPayload(envelope),
  }
}
```

---

## 5. Riscos e armadilhas

1. **`buyer.document` mistura CPF/CNPJ** — sem campo `cnpj` separado. Hash uniforme via `hashDocument()` resolve, mas dashboard futuro de "PJ vs PF" precisa heurística (length=11 → CPF, length=14 → CNPJ).
2. **Renovação sem evento dedicado** — heurística via `contract.id` + `gateway_subscriptions.currentRecurrence`. Mesmo problema Hotmart.
3. **Eventos `invoice_*` granulares** (12 tipos) — alguns redundantes pra nosso modelo. MVP mapeia 7 importantes, resto vira `tracked no_op`.
4. **`paymentMethod` discriminador chave** pra distinguir PIX vs boleto em `invoice_waiting_payment` — preciso mapping inline.
5. **Sun events não documentados explicitamente** — nome `sun.cart_abandoned` é estimativa. Smoke test obrigatório pra confirmar.
6. **Sem IP allowlist nem `_request_meta` payload** — não há campo claro pro IP de origem do cliente. Defesa fica via HMAC apenas.
7. **`originSecret` no payload** — validação opcional como segunda camada (adapter pode comparar com secret salvo, redundante com HMAC).
8. **6 apps Eduzz coexistem** — webhook captura tudo se cliente marcar; nosso adapter só processa MyEduzz + Sun. Outros (AlpaClass, Nutror, SafeVideo, Blinket) viram `UNKNOWN` tracked.
9. **Limite de paralelismo configurável** — cliente pode setar 1, 5, 10. Bom pra teste mas em prod sob alta venda pode acumular fila no lado Eduzz. Não afeta nosso adapter diretamente.
10. **Documentação cobre v3** — versões antigas (v2 com schema `trans_*` flat) não são tratadas pelo nosso adapter. Cliente legado precisa migrar pra v3 no painel Eduzz.

---

## 6. Recomendações concretas pra Sessão 1.4.7

1. **Adapter em `src/lib/services/gateways/eduzz/`**:
   - `index.ts` (implementa `GatewayAdapter`)
   - `signature.ts` — HMAC-SHA256 header `x-signature` (1 camada apenas — Eduzz é claro)
   - `parser.ts` — Zod do envelope `{id, event, data, sentDate}` + schemas dos `data` mais comuns
   - `normalizer.ts` — mapping bilingual (`myeduzz.*`, `sun.*`)
   - tests
2. **Sem schema migration** — herda `gateway_*` da 1.4.5.
3. **Wizard simples** (1 tela): cliente gera key no painel `integrations.eduzz.com/webhook/configs`, cola no nosso form, recebe URL limpa.
4. **Validação `event === 'ping'`** retorna 200 imediato sem persistir (é healthcheck).
5. **Webhook genérico** (`/api/webhooks/generic/[connection_id]`) em paralelo — aceita `NormalizedGatewayEvent` shape direto, valida via HMAC simples.

---

## Resumo executivo

- **Eduzz é o melhor desenhado dos 3** (envelope claro, HMAC-SHA256, eventos namespaced).
- **Adapter ~1.5h**: parser + normalizer + signature + index + tests + UI.
- **Mapping Kiwify-like**: 7 eventos invoice\_\* importantes mapeados, resto tracked. `tracker.code1` = visitor_id.
- **Sem armadilhas** tipo Kiwify (PascalCase variável, null em opcionais, CPF/cpf inconsistente). Eduzz é consistente.
- **Risco principal**: `sun.cart_abandoned` nome não confirmado — smoke test resolve. Renovação requer heurística.
