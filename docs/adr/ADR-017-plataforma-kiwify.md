# ADR-017 — Decisões de plataforma Kiwify (2026)

**Status:** Aceito (revisado 2026-05-10 com descoberta E2E — ver §"Revisão pós-E2E")
**Data:** 2026-05-10
**Sessão:** 1.4.6 (Kiwify adapter sobre infra da 1.4.5) — antes de codar

## Revisão pós-E2E (2026-05-10, mesmo dia)

Smoke test em sandbox real revelou que **Kiwify TEM HMAC nativo, só não documenta**. Inspecionando o `_request_meta` capturado, descobrimos:

- Kiwify sempre envia query string `?signature=<40 hex chars>`
- Confirmado empiricamente: `signature = HMAC-SHA1(token_kiwify, raw_body).hex()`
- Token Kiwify (`3x27zgg73o3` no nosso teste) é o **secret nativo**, não o UUID que nós gerávamos

**Mudanças vs ADR original:**

- **Validação primária = HMAC-SHA1** (camada 0). `?token=` plain vira fallback legacy.
- **Wizard pede token Kiwify** (cliente cria webhook na Kiwify primeiro, copia token gerado, cola). Não geramos mais UUIDv4 nosso.
- **Webhook URL fica limpa** (sem `?token=` na query string). Cliente cola URL pura no campo da Kiwify.
- Trade-off: 1 passo extra no wizard (criar webhook na Kiwify antes de colar token aqui), mas robustez sobe muito.

**Por que isso vale o ajuste:**

- Não dependemos mais de query string preservation
- HMAC valida HASH do body — alterações no body invalidam signature automaticamente
- Spoof requer conhecer o token Kiwify (não exposto em logs nossos, fica só em painel Kiwify do cliente)
- Padrão de mercado real, não convenção observada

**Migração de connections existentes:** trocar `webhook_secret` cifrado de UUID nosso pra token Kiwify do cliente. Cliente também precisa editar webhook na Kiwify pra remover `?token=` da URL. UI de status mostra URL limpa atualizada.

---

## Contexto

Auditoria de plataforma Kiwify realizada em 2026-05-10 (ver [docs/audits/KIWIFY_API_2026-05.md](../audits/KIWIFY_API_2026-05.md)) mapeou o stack atual (Public API REST `/v1`, OAuth client*credentials, webhook regular vs Banking subscriptions, 10 eventos confirmados) versus o que herdamos da 1.4.5 (`GatewayAdapter` interface, `NormalizedGatewayEvent`, schema `gateway*\*`, webhook endpoint dinâmico).

**Boa notícia:** a infra da 1.4.5 já cobre Kiwify quase 100%. Sessão é majoritariamente sobre adapter (~3h).

**Diferenças-chave Hotmart → Kiwify identificadas no audit:**

1. **Token por webhook (não global).** Cliente define ou recebemos UUIDv4 que geramos. Modelo mais granular que HOTTOK Hotmart.
2. **Sem HMAC.** Validação é comparação de string simples (token plain). Provavelmente vem em query string `?token=`, header `x-kiwify-token` ou body `payload.token` — adapter aceita 3 caminhos.
3. **Renovação tem evento dedicado** (`subscription_renewed`). Hotmart infere via `recurrence_number > 1` no `PURCHASE_APPROVED`. Adicionamos novo `NormalizedEventType` pra desambiguar.
4. **Slot livre `tracking.s1`** sem limite de caracteres. Substitui o `xcode` Hotmart (limite 30 chars) como mecanismo de visitor_id determinístico.
5. **Schema venda mais rico:** `parent_order_id` (renovação aponta pra inicial), settlement multi-moeda nativo, fee separado.
6. **Rate limit 5x menor** (100/min vs 500/min Hotmart). Backfill terá throttle conservador (1.5 req/s).
7. **Client secret expira em 96h.** Hotmart tem credencial perpétua. Cliente Kiwify precisará regenerar periodicamente — TD de monitoramento adiado.

Esta ADR formaliza decisões e é o **template para ADR-018 (Eduzz), ADR-019 (Monetizze), ADR-020 (Ticto)** — sessão 1.4.7.

## Drivers de decisão

- Webhook funcional em < 5 minutos do "colei token" do cliente (mesma meta da 1.4.5).
- Reuso máximo da infra 1.4.5 — adapter custa ~3h, não ~5h.
- Compatibilidade com modelo Kiwify de token por webhook (vs HOTTOK global Hotmart).
- LGPD em PII de buyer (email/CPF/CNPJ/phone/address/instagram).
- Suportar `parent_order_id` nativo do Kiwify para atribuição de renovação sem snapshot manual.

## Opções consideradas

### 1. Token UX no wizard

a. Cliente cola token próprio (igual fluxo Hotmart).
b. Geramos UUIDv4 sugerido + cliente cola no painel Kiwify.
c. Híbrido: gera sugerido mas campo editável.

**Escolhido:** (b). Baixa fricção (cliente não precisa pensar) + impede tokens fracos tipo "123456" + UUIDv4 é unguessable. Cliente cola exatamente o que mostramos. Smoke test instantâneo via "Testar Webhook" no painel.

### 2. Validação de token (onde vem)

a. Confiar só em query string `?token=xxx` (padrão observado).
b. Aceitar token em **3 camadas** ordenadas: query string → header `x-kiwify-token` → body `payload.token`. Aceita o primeiro que bate.
c. Confiar só em header.

**Escolhido:** (b). Doc oficial omite; comunidade aponta query string mas pode mudar. Defesa em camadas igual à 1.4.5 (Hotmart). Fail closed se nenhum bate.

### 3. Webhook automation via OAuth (POST /v1/webhooks)

a. Incluir no MVP: cliente cola `client_id`/`client_secret`/`account_id`, criamos webhook + token automaticamente.
b. Adiar pra TD: cliente cola URL+token manualmente no painel Kiwify (igual fluxo Hotmart).

**Escolhido:** (b). +2-3h de trabalho que não destrava nada essencial. Beta vai sentir se cliente reclamar; até lá, fluxo manual funciona. TD-049.

### 4. NormalizedEventType novos

a. 4 novos: `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_LATE`, `PIX_GENERATED`, `PURCHASE_REJECTED`.
b. Só 2: `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_LATE`.
c. Nenhum: mapeia tudo nos existentes (perde semântica).

**Escolhido:** (a). Cobre 10 eventos Kiwify com semântica explícita + desambigua de Hotmart (que infere renovação). `PIX_GENERATED` é primo de `PURCHASE_BILLET_PRINTED` mas conceitualmente diferente (PIX é instantâneo). `PURCHASE_REJECTED` é gap conhecido do Hotmart (cartão recusado não emite evento).

### 5. Schema migration

a. Adicionar colunas dedicadas (`parentOrderId`, `s1/s2/s3`, `settlementCurrency`, etc).
b. Persistir tudo em `origin jsonb` (catch-all) + reusar `external_code` para `s1`.

**Escolhido:** (b). MVP. Migração custa PR aditivo + downtime de schema sync. Se 1.4.7 ou dashboards específicos pedirem coluna dedicada, fazemos. Hoje `origin jsonb` resolve.

### 6. Multi-moeda (charge vs settlement)

a. Persistir `charge_amount`/`charge_currency` E `settlement_amount`/`settlement_currency`.
b. Persistir só `charge_amount` em `amountCents` + `charge_currency` em `currency`.

**Escolhido:** (b). MVP. Settlement é detalhe operacional do produtor (saber quanto recebeu líquido em USD); pra dashboard de receita o charge é o que importa. TD-044 já cobre multi-moeda display.

### 7. Reembolso parcial em créditos

Mesmo que ADR-016 dec.5: all-or-nothing. Sem evento dedicado no Kiwify (chega como `compra_reembolsada` ambíguo).

### 8. REST API client (OAuth + backfill 90d + sales/products sync)

a. Implementar no MVP igual ADR-016 falava antes da revisão.
b. Adiar pra fase pós-MVP igual ADR-016 dec. revisada.

**Escolhido:** (b). Consistente com Hotmart MVP (revisão pós-feedback do fundador na 1.4.5). Cliente não precisa de credenciais OAuth pra começar — só do token webhook.

## Decisão

**Plataforma:**

- **Webhook regular Kiwify** (formato JSON único, sem versionamento explícito) é o canal MVP.
- **Token plain comparison** em 3 camadas: query string `?token=` → header `x-kiwify-token` → body `payload.token`. Fail closed se nenhum bate. Sem HMAC.
- **Token gerado pelo nosso wizard** como UUIDv4. Cliente cola no painel Kiwify (campo "Token" da config de webhook).
- **Sem REST API/OAuth no MVP** (igual decisão revisada da 1.4.5). Cliente não fornece `client_id`/`client_secret`. Quando precisar de backfill ou sync proativo, adicionamos OAuth + endpoints REST.
- **PII redaction inline** no parser igual Hotmart: `customer.email`, `customer.cpf`, `customer.cnpj`, `customer.mobile`, `customer.address.*`, `customer.instagram` viram `[REDACTED]` em `raw_payload`.
- **`tracking.s1` = visitor_id** quando injetado. UTM Stitcher 1.4.B usa fallback temporal. Sem limite de caracteres (vantagem sobre Hotmart `xcode`).

**4 NormalizedEventType novos (em `types.ts`):**

```ts
| 'SUBSCRIPTION_RENEWED'    // Kiwify: subscription_renewed (evento dedicado)
| 'SUBSCRIPTION_LATE'       // Kiwify: subscription_late (cobrança falhou, ainda ativa)
| 'PIX_GENERATED'           // Kiwify: pix_gerado (QR criado, não pago)
| 'PURCHASE_REJECTED'       // Kiwify: compra_recusada (gap Hotmart)
```

Mapping completo em audit §10.

**`processGatewayEvent` switch (3 cases novos):**

```ts
case 'SUBSCRIPTION_RENEWED':
  // upsert gateway_subscriptions (currentRecurrence + 1)
  // creditService.allocate(amount=creditsPerCycle, source='subscription')
  break
case 'SUBSCRIPTION_LATE':
  // tracked + log (TD: alerta de churn potencial)
  break
case 'PIX_GENERATED':
case 'PURCHASE_REJECTED':
  // tracked sem ação
  break
```

**Schema deltas:** **NENHUM.** Schema 1.4.5 cobre via `origin jsonb` + colunas existentes.

**Adapter pattern:** `src/lib/services/gateways/kiwify/{index, signature, parser, normalizer, tests}.ts`. Implementa só as 3 funções obrigatórias do `GatewayAdapter` (validateSignature, parseWebhook, normalizeEvent). REST methods opcionais omitidos.

**Endpoint webhook:** reusa `/api/webhooks/gateway/[provider]/[connection_id]`. Adiciona `kiwify` ao map `ADAPTERS` (1 linha).

**Wizard UX:**

- 1 tela `/configuracoes/gateways/kiwify/connect`
- Botão "Gerar token + URL" → server action cria connection com UUIDv4 token + devolve webhook URL
- Cliente vê 2 campos copy: webhook URL + token sugerido
- Instruções inline: "vá em dashboard.kiwify.com.br → Apps → Webhooks → Criar Webhook, cole URL e token, marque os 10 eventos"

## Consequências

**Positivo:**

- Sessão 1.4.6 cabe em ~3h porque herda toda infra.
- Schema sem migration → zero risco de regressão.
- 4 novos `NormalizedEventType` melhoram semântica TAMBÉM para Hotmart (futuro: usar `SUBSCRIPTION_RENEWED` quando detectar `recurrence_number > 1` em vez de `PURCHASE_APPROVED` genérico).
- `tracking.s1 = visitor_id` é mais robusto que `xcode` Hotmart (sem limite 30 chars).
- Token UUIDv4 elimina classe de bugs ("token123" inseguro).

**Negativo:**

- Sem REST API → sem backfill 90d nem sync proativo de subscription state. Aceito (consistente com Hotmart MVP).
- Sem webhook automation via OAuth → cliente faz registro manual no painel. Aceito.
- Validação token-only (sem HMAC) é menos robusta que HMAC, mas suficiente para webhooks com secret rotation manual. Se Kiwify lançar HMAC oficial, adicionamos camada (similar `x-hotmart-signature`).
- Client secret expira em 96h → quando OAuth entrar (TD), precisará monitor + alerta.

**Coisas que não decidimos aqui (TODO):**

- **TD-049**: Webhook automation via OAuth `POST /v1/webhooks` (cliente fornece `client_id`/`client_secret`/`account_id`, criamos webhook automaticamente).
- **TD-050**: REST API client Kiwify (backfill 90d via `/v1/sales`, `/v1/products` sync, `/v1/affiliates`).
- **TD-051**: Monitor de client_secret 96h expiry (alerta cliente regenerar antes de quebrar).
- **TD-052**: Multi-moeda settlement display (`payment.settlement_currency` ≠ `payment.charge_currency` no schema dedicated).
- **TD-053**: `revenue_partners` (coprodutores Kiwify) split tracking pra dashboards de receita líquida.
- **TD-054**: Banking PIX webhooks (família separada `/v1/webhook_subscriptions` com EdDSA-Ed25519 — fora do escopo Criation hoje).

## Referências

- [docs/audits/KIWIFY_API_2026-05.md](../audits/KIWIFY_API_2026-05.md) — auditoria detalhada
- [ADR-016](./ADR-016-plataforma-hotmart.md) — Hotmart, primeiro adapter (template)
- [ADR-003](./ADR-003-gateway-como-fonte-da-verdade.md) — gateway como fonte canon de receita
- [ADR-005](./ADR-005-utm-stitcher-cascata.md) — UTM Stitcher cascade strategy (1.4.8)
- v0.6 §3.2, §4.0–§4.16 — modelo de créditos consumido por `processGatewayEvent`
- [ROADMAP.md](../../ROADMAP.md) — sessão 1.4.6 referencia esta ADR
