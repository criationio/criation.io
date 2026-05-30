# Billing E2E (sandbox) — Asaas / Stripe

Harness manual para validar o caminho real de billing da Sessão 1.12:

```
gateway (Asaas) → POST /api/webhooks/asaas → valida token → parseEvent
  → dedup (processed_webhook_events) → enfileira Trigger → worker
  → applyBillingEvent → upsertSubscription + setWorkspacePlan + allocate(+créditos)
```

Não são testes automatizados (esses ficam em `*.test.ts` / Playwright). São scripts de
operação para exercitar o sandbox real ponta-a-ponta quando algo do fluxo de webhook muda.

## Pré-requisitos

- `.env.local` com `ASAAS_API_KEY`, `ASAAS_BASE_URL` (sandbox), `ASAAS_WEBHOOK_SECRET`.
- Rodar fora do runtime Next: `node --env-file=.env.local --import tsx scripts/<arquivo>.ts`.
- Infra local no ar:
  1. `pnpm dev` (handler).
  2. `cloudflared tunnel --url http://localhost:3000` → pega a URL pública.
  3. `pnpm trigger:dev` (worker que executa `process-billing-event` → `allocate`).
  4. No painel Asaas, a URL do webhook **precisa terminar em `/api/webhooks/asaas`**
     (sem o path os eventos batem na home e somem — foi o bug da 1.12).

## Ordem de execução (E2E de assinatura)

1. `e2e-asaas-probe.ts` — snapshot ANTES (workspaces/membros/saldos/subscriptions → `/tmp/criation-probe.json`).
2. `e2e-asaas-create-sub.ts` — cria customer + assinatura PIX e dá `receiveInCash` no 1º
   pagamento → dispara `PAYMENT_RECEIVED` real. IDs do workspace/usuário/CNPJ no topo do arquivo.
3. `check-webhook-events.ts` — lê `processed_webhook_events` + `credit_transactions` do workspace.
   Esperado: um `invoice_paid` + `allocate | subscription | <créditos> | sub_<paymentId>`.
4. `e2e-asaas-probe.ts` — snapshot DEPOIS. Esperado p/ Pro: plano `pro`, saldo +120, 1 subscription.
5. `e2e-asaas-replay.ts` — re-POSTa o MESMO evento (lê `payload` do DB) → deve voltar
   `{"received":true,"deduped":true}` e **não** duplicar a alocação (dedup por event_id + idempotencyKey).

## Diagnóstico

- `asaas-diag.ts` — status da conta + customer + payment.
- `asaas-webhook-status.ts` — lista webhooks cadastrados no Asaas + status de um pagamento.
- `e2e-asaas-card-sub.ts` — variante cartão (usar cartão de sucesso `4444 4444 4444 4444`;
  `5162…` é rejeitado no sandbox).

## Gotchas do sandbox Asaas

- `receiveInCash` marca `RECEIVED_IN_CASH` e dispara `PAYMENT_RECEIVED` — caminho mais
  simples/confiável p/ E2E (não precisa de cartão). Reversão = `PAYMENT_RECEIVED_IN_CASH_UNDONE`.
- Mapeamento evento→workspace/plano é 100% via `externalReference` = `${workspaceId}|${planId}`
  (ou `${workspaceId}|pack:${sku}`). Não há lookup de subscription no DB no caminho `invoice_paid`.
- Fluxo cartão: `PAYMENT_CREATED → PAYMENT_CONFIRMED → PAYMENT_RECEIVED` (este ~30d depois).
  `PAYMENT_CONFIRMED` com `subscription` já basta p/ `invoice_paid`/allocate.
- **Nunca** dê `cat` no log do `trigger:dev` (o cron sync-campaigns floda milhares de linhas
  SQL e corrompe o canal). Use `grep` pontual e confirme o resultado pelo DB.

## Histórico

E2E real validado em 2026-05-30 (workspace `me@criation.io`): free/45 → pro/165, 1 subscription
`active/pro`, idempotência confirmada. Causa-raiz da sessão anterior (URL do webhook sem path) fechada.
