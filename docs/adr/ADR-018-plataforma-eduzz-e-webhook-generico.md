# ADR-018 — Plataforma Eduzz + Webhook genérico (estratégia híbrida)

**Status:** Aceito
**Data:** 2026-05-10
**Sessão:** 1.4.7 (Eduzz adapter + Webhook genérico) — antes de codar

## Contexto

Audit Eduzz em [docs/audits/EDUZZ_API_2026-05.md](../audits/EDUZZ_API_2026-05.md). ADR-016 (Hotmart) + ADR-017 (Kiwify) já cobriram template do `GatewayAdapter`. Eduzz é o **mais bem desenhado dos 3 BR** (envelope `{id, event, data, sentDate}`, HMAC-SHA256, eventos `app.action` namespaced).

Decisão estratégica do fundador (2026-05-10) inverteu o plano original da 1.4.7:

- **Originalmente**: 3 adapters nativos (Eduzz + Monetizze + Ticto, ~4h)
- **Revisado**: Eduzz nativo + **webhook genérico** pra long-tail via n8n/Make/Zapier (~3.5h total)

**Razão da revisão:**

- Eduzz #3 em mercado BR infoprodutor → vale codar nativo (ROI alto)
- Monetizze/Ticto têm market share menor → cliente avançado raramente usa Criation com eles, e quando usa pode trazer via Make/n8n
- "Webhook genérico" é canal único cobrindo TODO long-tail (10+ providers possíveis: Cakto, Greenn, Vimeify, Yampi, Perfect Pay, Braip, Lastlink, Disrupty, Monetizze, Ticto)
- Tempo dev: 1 adapter + 1 endpoint genérico (~3.5h) vs 3 adapters (~4h) — **escala melhor**

## Drivers de decisão

- Reuso máximo da infra 1.4.5/1.4.6 (template `GatewayAdapter`).
- Cobertura efetiva de mercado (Hotmart + Kiwify + **Eduzz** = ~80% do BR infoprodutor pago).
- Long-tail acessível via canal genérico sem custo dev por provider.
- Cliente decide: integração 1-clique nativa (3 providers) ou via n8n/Make (qualquer outro).

## Opções consideradas

### 1. Escopo da 1.4.7

a. 3 adapters nativos (Eduzz + Monetizze + Ticto).
b. Eduzz nativo + webhook genérico pra long-tail.
c. Só webhook genérico (sem Eduzz nativo).

**Escolhido:** (b). Eduzz tem mercado share suficiente pra justificar 1-clique. Monetizze/Ticto não. Webhook genérico cobre 10+ providers de long-tail com 1 vez de trabalho.

### 2. Validação Eduzz (signature)

a. HMAC-SHA256 header `x-signature` (oficial Eduzz).
b. Múltiplas camadas (header + payload + query) tipo Kiwify.
c. HMAC + validação adicional do `originSecret` no payload.

**Escolhido:** (a). Eduzz documenta UMA forma oficial. Sem ambiguidade. `originSecret` no payload é redundante com HMAC — opcional ignorar.

### 3. Mapping de eventos Eduzz

a. Mapear todos os 16+ eventos MyEduzz (invoice + contract + commission).
b. Mapear só os 7 essenciais pro MVP (paid, refused, refunded, canceled, expired, overdue, waiting_payment).
c. Mapear todos com fallback `UNKNOWN tracked`.

**Escolhido:** (c). Schema interno `NormalizedEventType` já lida com `UNKNOWN` (tracked, no-op). Mapeia 7 explícitos com semântica + 9 ficam `UNKNOWN`. Cobertura semântica adequada sem encher enum.

### 4. Webhook genérico — modelo de validação

a. Query string `?token=` plain (igual Hotmart legacy Kiwify).
b. HMAC-SHA256 header (cliente Make/n8n calcula).
c. **Token plain via header `x-criation-token`** + opção HMAC-SHA256 para clientes avançados.

**Escolhido:** (c). Query string vaza token em logs. Header é padrão. Token plain é o mais fácil pra Make/n8n configurarem. HMAC opcional pra clientes que querem extra segurança — adapter aceita ambos.

### 5. Webhook genérico — schema do payload

a. Aceita `NormalizedGatewayEvent` shape direto (cliente faz transform no Make/n8n).
b. Aceita shape simplificado com campos mínimos (event_type, amount_cents, customer_email, etc) e nós inferimos.
c. Aceita qualquer JSON e o cliente nos diz qual provider — fazemos parse específico por provider.

**Escolhido:** (a) com shape claro documentado. Cliente Make/n8n monta um JSON tipo:

```json
{
  "event_type": "PURCHASE_APPROVED",
  "amount_cents": 4990,
  "currency": "BRL",
  "buyer": { "email": "x@y.com", "phone": "+5511...", "document": "12345678910" },
  "tracking": { "external_code": "visitor-uuid", "utm_source": "fb" },
  "provider_event_id": "uuid-do-gateway-original",
  "occurred_at": "2026-05-10T..."
}
```

Hashamos PII no servidor, salvamos com `provider: 'generic:<source>'`.

### 6. Webhook genérico — provider tag

a. `provider: 'generic'` (todos juntos).
b. `provider: 'generic:monetizze'` / `'generic:ticto'` / etc (cliente declara source no payload).

**Escolhido:** (b). Permite filtragem por origem no dashboard. Cliente envia `source_provider: 'monetizze'` no payload, persistimos como `provider: 'generic:monetizze'`. Genérico-genérico sem source vira `provider: 'generic'`.

## Decisão

**Eduzz nativo:**

- **Endpoint webhook**: `/api/webhooks/gateway/eduzz/[connection_id]` (registra `eduzz` em `ADAPTERS`).
- **Validação**: HMAC-SHA256 single-layer header `x-signature`. Sem fallbacks (Eduzz é claro).
- **Wizard**: 1 tela. Cliente vai em `integrations.eduzz.com/webhook/configs`, cria webhook (gera key), cola key no nosso form, recebe URL limpa pra colar de volta.
- **Mapping**: 7 eventos invoice*\* mais relevantes + 3 contract*\* + ping (no-op). 9 outros → `UNKNOWN` tracked.
- **Schema**: parser do envelope `{id, event, data, sentDate}` + schemas específicos de `data` por evento (invoice/contract).

**Webhook genérico:**

- **Endpoint**: `/api/webhooks/generic/[connection_id]` (provider novo `generic`).
- **Validação**: token plain via header `x-criation-token` (single-layer; cliente Make/n8n cola). HMAC opcional via `x-criation-signature` pra avançados.
- **Schema do payload**: shape canônico documentado (`event_type`, `amount_cents`, `currency`, `buyer.{email, phone, document}`, `tracking.{external_code, utm_*}`, `provider_event_id`, `occurred_at`, `source_provider?`).
- **PII hashing**: servidor faz hash inline (cliente não precisa hashear no Make/n8n).
- **Wizard**: cliente vai em `/configuracoes/gateways/generic`, gera token, recebe URL + token + JSON template + link pra docs com **templates Make/n8n** prontos pra import.
- **Provider tag**: `provider: 'generic:<source>'` quando cliente envia `source_provider`. Sem source → `provider: 'generic'`.

**Templates de integração (docs):**

Sites: `/configuracoes/gateways/generic/templates` lista templates importáveis:

- Monetizze → Make
- Ticto → n8n
- Cakto → Make
- Greenn → n8n
- Genérico (qualquer JSON com transform manual)

Cada template é um JSON exportado do Make/n8n que cliente importa direto. Conteúdo: trigger no provider + transform fields → POST pro nosso webhook.

**Schema deltas:** **NENHUM.** `gateway_*` da 1.4.5 cobre.

**`NormalizedEventType` deltas:** **nenhum**. Os 4 que adicionamos na Kiwify (`SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_LATE`, `PIX_GENERATED`, `PURCHASE_REJECTED`) já cobrem Eduzz também. Mapping bilingual (Kiwify) vira **trilingual** (Hotmart `PURCHASE_APPROVED` + Kiwify `order_approved` + Eduzz `myeduzz.invoice_paid` → todos `PURCHASE_APPROVED`).

## Consequências

**Positivo:**

- 1.4.7 cabe em ~3.5h (Eduzz ~1.5h + genérico ~2h).
- Cobertura mercado: Hotmart + Kiwify + Eduzz **nativo** + 10+ providers via genérico.
- Webhook genérico abre canal pra **qualquer integração futura** sem código (clientes podem mandar de CRM, ERP, etc).
- Documentação com templates Make/n8n eleva positioning ("integramos com 50 plataformas").
- Não temos que codar parsers pra cada provider exótico — terceirizamos transform pro Make/n8n do cliente.

**Negativo:**

- Webhook genérico via Make/n8n exige cliente pagar tooling extra (~R$30-60/mês). Atrito de venda real pra clientes pequenos.
- Cliente que não usa Hotmart/Kiwify/Eduzz precisa de fluência técnica em Make/n8n — não é UX self-service total.
- Provider tag `generic:monetizze` perde semântica vs adapter nativo (sem campos específicos extraídos como Hotmart `xcode`, Kiwify `s1`).
- Long-tail providers podem mudar shape sem aviso e cliente precisa atualizar transform manualmente.
- Sem signature validation forte no genérico (token plain) → vulnerável a spoof se token vazar.

**Coisas que não decidimos aqui (TODO):**

- **TD-060**: REST API client Eduzz (backfill 90d via `/api/myeduzz/v1/sales`). Mesmo padrão Hotmart/Kiwify (REST adiado).
- **TD-061**: Adapter nativo Monetizze (se beta pedir).
- **TD-062**: Adapter nativo Ticto (se beta pedir).
- **TD-063**: Adapter nativo Cakto (mercado emergente em 2026).
- **TD-064**: Templates Make/n8n curados pros 5 long-tail mais pedidos (gravar Loom + JSON exportável).
- **TD-065**: Eduzz Sun cart_abandoned — confirmar nome do evento empiricamente, ajustar mapping se necessário.
- **TD-066**: Eduzz `commission_processed` → dashboard de comissões pagas (Fase 2).
- **TD-067**: HMAC opcional no webhook genérico — implementar `x-criation-signature` quando algum cliente avançado pedir.

## Referências

- [docs/audits/EDUZZ_API_2026-05.md](../audits/EDUZZ_API_2026-05.md) — auditoria detalhada
- [ADR-016](./ADR-016-plataforma-hotmart.md) — Hotmart, primeiro adapter
- [ADR-017](./ADR-017-plataforma-kiwify.md) — Kiwify, segundo adapter
- [ROADMAP.md](../../ROADMAP.md) — sessão 1.4.7 referencia esta ADR
