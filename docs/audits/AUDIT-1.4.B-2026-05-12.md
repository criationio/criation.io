# Audit — Sessão 1.4.B (Visitor↔Buyer Matching + UTM Stitcher 2.0)

**Data:** 2026-05-12 (mesmo dia da entrega)
**Método:** 2 sub-agents independentes + validação do auditor
**Verificação:** 7 findings críticos confirmados via leitura direta de código + grep + schema

**Status final (2026-05-12, fechamento da sessão):**

| Bloco                 | Itens                                                                           | Status               |
| --------------------- | ------------------------------------------------------------------------------- | -------------------- |
| **P0** (bloqueadores) | A1, A2, A3, A4, A5                                                              | ✅ 5/5 fechados      |
| **P1** (sprint atual) | B1, B2, B3, B4, B5, B6, B7                                                      | ✅ 7/7 fechados      |
| **P2** (backlog/TD)   | C1, C3, C7 implementados; C4→TD-104, C5→18 tests, C6→TD-106, C8→docs corrigidos | ✅ todos endereçados |

**Validação pos-fix:** typecheck ✅ · lint ✅ · 226 tests ✅ · CHECK constraints validados ao vivo (UPDATE com `strategy='hack'` rejeita; `confidence=1.5` rejeita; `strategy='reverse_email', confidence=0.85` aceita).

Achados ordenados por severidade. P0 = corrigir antes de qualquer cliente real. P1 = fix nesta sprint. P2 = backlog (TD).

---

## P0 — Bloqueadores

### A1. Cross-workspace data leak em `persistVisitorMatch` step 2 — ✅ RESOLVIDO

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts:174`
**Severidade:** Alta — viola CLAUDE.md regra 4 (RLS / workspace isolation)
**Resolução:** UPDATE de `tracking_visitors` agora filtra `and(eq(visitorId), eq(workspaceId))`. Coberto por test "audit A1 regression" no service test.

`tracking_visitors.visitor_id` é PK global (text, sem scope de workspace). O step 2 do `persistVisitorMatch` faz `UPDATE tracking_visitors SET identified_buyer_email_hash = ... WHERE visitor_id = ?` **sem filtrar por workspace_id**.

Cenários onde quebra:

- Cliente colou snippet de outro workspace por erro (CDP comentário em ADR-014 já reconhece esse risco)
- UUID v4 colidindo entre workspaces (probabilidade desprezível, mas não zero)
- Atacante adivinhando visitor_id alheio (UUID público no DOM, vetor TD-094)

**Fix:** linha 174:

```ts
.where(and(
  eq(trackingVisitors.visitorId, input.visitorId),
  eq(trackingVisitors.workspaceId, input.workspaceId),
))
```

### A2. Reverse matching pula EXATAMENTE o caso de uso primário — ✅ RESOLVIDO

**Arquivo:** `src/lib/services/visitor-buyer-matcher.service.ts:215-220`
**Resolução:** Reverse matching agora SOBRESCREVE eventos `unmatched` via `overrideUnmatched=true` em `persistVisitorMatch`. `findGatewayEventsByBuyerEmail` retorna todos os eventos (matched, unmatched, sem matched). Loop pula apenas eventos com strategy real resolvida (deterministic/clickid/utm_recency). TD-102 fechado. Test "audit A2: SOBRESCREVE eventos com strategy unmatched" cobre.

Comentário diz "podemos sobrescrever via reverse matching" mas código faz `if (ev.visitorMatchedAt) continue` — o que descarta todo evento marcado `unmatched`. Como `markVisitorMatchUnmatched` SETA `visitor_matched_at`, o cenário de uso #1 (cliente compra primeiro, identify depois) **nunca dispara reverse matching** após o matcher direto rodar.

Consequência: o cenário 5 do smoke doc só funciona se o matcher direto NUNCA tiver rodado pra esse evento — janela de poucos segundos antes do enqueue do Trigger.dev. Em produção real, > 99% dos casos vão ter `visitor_matched_at` populado por unmatched antes do identify chegar.

**Fix:**

```ts
if (
  ev.visitorMatchedAt &&
  ev.visitorMatchedAt.getTime() > 0 &&
  ev.visitorMatchStrategy !== 'unmatched'
) {
  continue
}
```

**E** atualizar `findGatewayEventsByBuyerEmail` pra incluir eventos com strategy='unmatched' (sem isso, query também filtra incorretamente). **E** ajustar `persistVisitorMatch` linha 162 pra aceitar override quando strategy era unmatched:

```ts
.where(or(
  isNull(gatewayEvents.visitorMatchedAt),
  eq(gatewayEvents.visitorMatchStrategy, 'unmatched'),
))
```

### A3. Reverse matching mente sobre origem do match — ✅ RESOLVIDO

**Arquivo:** `src/lib/services/visitor-buyer-matcher.service.ts:227`
**Resolução:** Nova strategy `reverse_email` (0.85) adicionada ao type `VisitorMatchStrategy` + ao `STRATEGY_CONFIDENCE`. Migration 0012 adiciona CHECK constraint enum incluindo `reverse_email`. Test "audit A3: usa strategy reverse_email (nao clickid)" cobre. ADR-014 + smoke doc atualizados (4 estratégias documentadas).

Reverse matching grava `strategy: 'clickid'` com `confidence: 0.85` para um match feito por **email_hash** — nem clickid, nem xcode, nem UTM. Resultado:

- Dashboard que filtra `WHERE visitor_match_strategy = 'clickid'` mistura clickid 7d (0.9) com reverse_email 30d (0.85) — métricas inúteis
- Tipo `VisitorMatchStrategy` em `queries/visitor-buyer-matching.ts:124` não tem `'reverse_email'` mas sub-cast funciona porque o campo é `text` sem CHECK
- ADR-014 closing notes documentam só 3 estratégias — código tem 4 disfarçadas

**Fix:**

1. Estender enum: `VisitorMatchStrategy = 'deterministic_xcode' | 'clickid' | 'utm_recency' | 'reverse_email'`
2. Adicionar `STRATEGY_CONFIDENCE.reverse_email = 0.85`
3. Migration aditiva com `CHECK (visitor_match_strategy IN (...))`
4. Atualizar ADR-014 + smoke doc + ROADMAP pra mencionar 4 estratégias

### A4. Click ID matching tem bug de precedência cross-tipo — ✅ RESOLVIDO

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts:76-87`
**Resolução:** `findVisitorByClickId` reescrito — agora gera predicado por tipo: `(lastClickIdType='fbclid' AND lastClickId=$fbclid) OR (firstClickIdType='fbclid' AND firstClickId=$fbclid)`, repetido pra gclid/ttclid. Sem cross-tipo possível.

A query agrupa fbclid/gclid/ttclid num único array e checa `lastClickId = ANY(array)` SEM verificar `lastClickIdType`. Se visitor tinha `lastClickId='abc123'` (tipo fbclid) e gateway veio com `gclid='abc123'` (improvável mas possível em testes/colisões), match é falso.

**Fix:**

```ts
sql`(
  (${trackingVisitors.lastClickIdType} = 'fbclid' AND ${trackingVisitors.lastClickId} = ${clickId.fbclid ?? null})
  OR (${trackingVisitors.lastClickIdType} = 'gclid' AND ${trackingVisitors.lastClickId} = ${clickId.gclid ?? null})
  OR (${trackingVisitors.lastClickIdType} = 'ttclid' AND ${trackingVisitors.lastClickId} = ${clickId.ttclid ?? null})
  -- repetir pra firstClickIdType/firstClickId
)`
```

### A5. Estratégia `clickid` está MORTA — adapters de gateway não extraem fbclid — ✅ DOCUMENTADO + TD-105

**Arquivo:** `src/lib/services/gateways/{hotmart,kiwify,eduzz}/normalizer.ts`
**Resolução:** Estratégia mantida no código (no-op enquanto fbclid sempre null) + smoke cenário 2 reescrito como "DORMENTE até TD-105" + ADR-014 documenta como dormente + TD-105 criado em tech-debt.md descrevendo a extensão necessária por adapter (Hotmart `tracking.source`, Kiwify `tracker.code2-5`, Eduzz `tracker.code2+`). Não bloqueia 1.4.9 nem launch — só ativa cobertura adicional quando entregue.

`grep -rn fbclid src/lib/services/gateways/` retorna apenas a definição do tipo, **zero usos**. Nenhum adapter popula `gateway_events.fbclid`. Significa que a estratégia `clickid` (confidence 0.9) **nunca dispara em produção** — cai sempre pro `utm_recency` ou `unmatched`.

Smoke cenário 2 (linha 54) menciona `payment.checkout_country` — campo errado, é ISO-2 do país, não carrega fbclid. Cenário não é executável.

**Fix:** opções:

- (a) Implementar extração de fbclid no adapter Hotmart (requer entender onde Hotmart guarda — pode ser `tracking.source` ou ausente)
- (b) Reconhecer que `clickid` só vai funcionar quando 1.4.A.X popular `gateway_events.fbclid` via tracking script lendo o checkout (não do webhook)
- (c) Cortar `clickid` da cascata até ter dado real, e re-introduzir na sessão 1.4.9 quando fanout precisar de fbp/fbc

Documentar a escolha no ROADMAP.

---

## P1 — Fix nesta sprint

### B1. Smoke doc com SQL não executável — ✅ RESOLVIDO

**Arquivo:** `docs/smoke/1.4.B-visitor-buyer-matching.md:118`
**Resolução:** Cenário 5 atualizado pra `WHERE customer_email_hash = encode(digest('comprador@teste.com', 'sha256'), 'hex')` (extension pgcrypto disponível no Supabase).

`WHERE customer_email_hash = sha256('comprador@teste.com')` — Postgres não tem função `sha256()`. Precisa `encode(digest('...', 'sha256'), 'hex')` (extension pgcrypto). E o app usa `hashEmail` em `src/lib/security/hash.ts` (sha256 puro hex).

**Fix:** trocar por:

```sql
WHERE customer_email_hash = encode(digest('comprador@teste.com', 'sha256'), 'hex')
```

(confirmar com helper real do código).

### B2. Smoke cenário 2 está factualmente errado sobre Hotmart — ✅ RESOLVIDO (com A5)

**Arquivo:** `docs/smoke/1.4.B-visitor-buyer-matching.md:54`
**Resolução:** Cenário 2 reescrito como "DORMENTE até TD-105" — explica que estratégia clickid está implementada mas não dispara em produção e mostra SQL pra confirmar estado dormente (`SELECT count(*) WHERE visitor_match_strategy='clickid'` deve retornar 0).

"webhook Hotmart traz `fbclid=fb-test-123` em `payment.checkout_country`" — falso (checkout_country é ISO-2). E independente disso, a estratégia clickid está morta (A5). Cenário não pode ser reproduzido.

**Fix:** marcar cenário 2 como "blocked by A5" ou substituir por cenário que use UTMs reais.

### B3. Stitcher 2.0 não re-roda quando reverse matching popula matched_visitor_id retroativamente — ✅ RESOLVIDO

**Arquivo:** `src/lib/trigger/tasks/stitch-gateway-event.ts` + `src/lib/services/utm-stitcher.service.ts`
**Resolução:** Nova query `resetStitchIfWeakStrategy(eventId)` reseta `stitched_at = NULL` quando `match_strategy IN ('unmatched', 'meta_literal')`. `matchGatewayEventsForIdentifiedVisitor` chama essa função e retorna `needsRestitch: string[]`. `process-tracking-event.ts` itera o array e re-enfileira `stitchGatewayEventTask.trigger()` pra cada evento. Test "audit B3: needsRestitch retorna IDs" cobre.

Sequência problemática:

1. Webhook chega → matcher roda → unmatched → stitcher roda → `stitched_at = now()` (strategy unmatched/meta_literal)
2. Identify chega minutos depois → reverse matching popula `matched_visitor_id`
3. Stitcher 2.0 NUNCA re-roda — gateway_event fica com strategy antiga (perdeu a chance de visitor strategy 0.95)

**Fix:** quando reverse matching popular `matched_visitor_id`, resetar `stitched_at = NULL` se strategy era `unmatched` ou `meta_literal`, e enfileirar `stitchGatewayEventTask` de novo.

### B4. `gateway_subscriptions.identifiedVisitorId` nunca é atualizado — ✅ RESOLVIDO

**Arquivo:** `src/lib/services/visitor-buyer-matcher.service.ts` + `src/lib/db/schema/gateway.ts:216`
**Resolução:** `persistVisitorMatch` agora aceita `subscriberCode?: string` e faz 4º UPDATE em `gateway_subscriptions SET identified_visitor_id = COALESCE(...)` dentro da transaction. Service propaga `event.subscriberCode` em todas as 4 estratégias. Test "subscriberCode propagado pro persist" cobre.

Schema documenta `identifiedVisitorId` como "Visitor_id capturado via xcode na venda inicial. Permanente." e diz que renovações herdam. Matcher 1.4.B atualiza `gateway_events` mas não `gateway_subscriptions`. Resultado: dashboard MRR (que lê de `gateway_subscriptions` pra ser barato) nunca vê o link visitor↔subscription se não veio xcode na venda inicial.

**Fix:** em `persistVisitorMatch`, quando o gateway_event tem `subscriberCode`, fazer 4º UPDATE:

```ts
if (event.subscriberCode) {
  await db
    .update(gatewaySubscriptions)
    .set({ identifiedVisitorId: sql`COALESCE(identified_visitor_id, ${input.visitorId})` })
    .where(
      and(
        eq(gatewaySubscriptions.workspaceId, input.workspaceId),
        eq(gatewaySubscriptions.subscriberCode, event.subscriberCode)
      )
    )
}
```

### B5. Validação de UUID v4 ausente em `findVisitorByXcode` — ✅ RESOLVIDO

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts:33-44`
**Resolução:** Constante `UUID_V4_RE` regex no topo do módulo + `if (!UUID_V4_RE.test(xcode)) return null` antes da query. Mesma regex no service pra detectar UUID-like sem visitor (audit C7 — log de cross-workspace).

Aceita qualquer string. Se cliente legado pôs CPF ou código interno em `tracking.external_code`, e por coincidência bater num `visitor_id` (PK text sem CHECK), confidence vira 1.0 e atribui campanhas erradas.

**Fix:** validar UUID v4 antes da query (regex ou Zod):

```ts
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!UUID_V4.test(xcode)) return null
```

### B6. Partition pruning quebrado em `tracking_events` retroativo — ✅ RESOLVIDO

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts:179-191`
**Resolução:** UPDATE retroativo agora inclui `gte(eventTs, ninetyDaysAgo)`. Constante `RETROACTIVE_LOOKBACK_DAYS = 90` alinhada ao TTL do cookie `_cio_vid`. Planner agora consegue partition pruning (lê só partições dos últimos 3 meses no pior caso).

UPDATE em `tracking_events` (particionada por event_ts) sem predicado em `event_ts`. Em produção (12+ meses, 12+ partições) planner faz scan em todas. Hoje OK (3 partições rolling), em 6 meses degrada.

**Fix:** alinhar com TTL do cookie `_cio_vid` (90d):

```ts
gte(trackingEvents.eventTs, sql`now() - interval '90 days'`)
```

### B7. Falta CHECK constraints em colunas novas — ✅ RESOLVIDO

**Arquivo:** migration 0011 + `src/lib/db/schema/gateway.ts`
**Resolução:** Migration `0012_visitor_match_check_constraints.sql` aplicada via Supabase MCP. Padrão zero-downtime: `ADD CONSTRAINT ... NOT VALID` + `VALIDATE CONSTRAINT` separado. Validado ao vivo: `UPDATE ... visitor_match_strategy='hack'` retorna `23514: violates check constraint`; `visitor_match_confidence=1.5` idem.

- `visitor_match_strategy text` — aceita qualquer string. Devia ter `CHECK (visitor_match_strategy IN ('deterministic_xcode','clickid','utm_recency','reverse_email','unmatched'))`
- `visitor_match_confidence numeric(5,4)` — aceita -0.5 ou 1.5. Devia ter `CHECK (visitor_match_confidence BETWEEN 0 AND 1)`

**Fix:** migration 0012 aditiva com `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...) NOT VALID` + `VALIDATE CONSTRAINT` separado (zero-downtime).

---

## P2 — Backlog (novos TDs)

### C1. Sem transaction nos 3 (4 com B4) UPDATEs do `persistVisitorMatch` — ✅ RESOLVIDO

`persistVisitorMatch` agora envolve os 4 UPDATEs em `db.transaction(async (tx) => {...})`. Atomicidade real. **TD-101 fechado.**

### C2. Reverse matching reescreve estratégia mas cenários ambíguos não testados — ✅ POLÍTICA DEFINIDA + TESTADA

**Política implementada:** reverse_email só sobrescreve eventos com strategy `unmatched`. Eventos com strategy real resolvida (`deterministic_xcode`, `clickid`, `utm_recency`) são preservados — sem downgrade. Test "PULA eventos com strategy real ja matched" cobre. Casos ainda mais ambíguos (dois identify do mesmo email em visitors diferentes) seguem last-write-wins por design — TD futuro se virar problema observado.

### C3. `findVisitorByUtmRecency` rejeita ambiguidade silenciosamente — ✅ RESOLVIDO

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts:117`
**Resolução:** Função reescrita pra retornar `{ visitor, conflict }` em vez de `Visitor | null`. Service detecta `conflict === true` e loga `trackingLogger.info` estruturado com `gatewayEventId`, `workspaceId`, `utmCampaign`. Test "audit C3: conflict utm_recency loga info estruturado" cobre.

### C4. LGPD erasure path não existe — ✅ DOCUMENTADO COMO TD-104

**Decisão:** virou `TD-104` (severidade Alta, gate "antes de primeiro titular request real"). Plano completo em `docs/tech-debt.md`: novo `lib/services/erasure.service.ts` que NULL `customer_email_hash` em gateway*events; NULL `matched_visitor_id` + visitor_match*\*; DELETE em tracking_visitors; UPDATE tracking_events SET matched_buyer_email_hash=NULL nas partições do workspace; NULL `identified_visitor_id` em gateway_subscriptions. Audit log obrigatório. Endpoint público com email confirmation. Originalmente planejado pra Sessão 3.13.5; agora marcado como bloqueio explícito antes de cliente real.

### C5. Coverage de testes faltando em paths críticos — ✅ PARCIALMENTE RESOLVIDO

**Resolução:** 18 tests no service test file (vs 10 originais). Cobertos: precedência xcode>clickid, clickid>utm_recency, A2 override unmatched, A3 reverse_email strategy, B3 needsRestitch, B4 subscriberCode, B5 UUID validation (via xcode invalido), C3 conflict log, C7 mystery xcode log. **Não coberto** (TD futuro): unit test direto de `persistVisitorMatch` com banco real (transaction rollback em falha no step 3, retroativo com janela de partição). Aceitável no MVP — estamos cobertos na orquestração + smoke E2E manual valida banco real.

### C6. Migration 0011 viola CLAUDE.md regra 16 parcialmente — ✅ PARCIALMENTE RESOLVIDO + TD-106

**Resolução:** (c) CHECKs entregues na migration 0012 (B7). (b) backfill virou TD-106 — em volume MVP zero é tolerável (base nova, índice parcial vazio); plano completo em tech-debt.md (UPDATE batch 10k SET visitor_matched_at + visitor_match_strategy='unmatched' onde created_at < data_da_1.4.B).

### C7. Falta log explícito quando externalCode parece UUID v4 mas não acha visitor — ✅ RESOLVIDO

Service agora detecta `externalCode` UUID-v4 válido sem visitor correspondente e dispara `trackingLogger.warn` com `gatewayEventId`, `workspaceId`, `externalCode` + mensagem "possivel cross-workspace config". Tests "audit C7: xcode UUID v4 valido sem visitor loga warn" e "audit C7: xcode invalido NAO loga warn" cobrem ambos os caminhos.

### C8. Documentação inconsistente — ✅ RESOLVIDO

- ROADMAP linha 1.4.B atualizada (4 estratégias, audit pos-entrega mencionado, dormência clickid declarada)
- ADR-014 closing notes reescritas: 4 estratégias documentadas, comportamento de override de unmatched (audit A2) explicado, transação atômica em `persistVisitorMatch` mencionada, lista de TDs atualizada (101/102 closed; 104/105/106 abertos)
- Smoke doc cenário 5 atualizado pra refletir reverse_email + override + re-stitch
- Memória de referência (`reference_visitor_buyer_matching_1_4_b_2026_05.md`) reescrita com cascata de 4 estratégias

---

## Recomendação executada (todos os blocos)

| Bloco      | Estimativa original | Tempo real | Status                                                                                               |
| ---------- | ------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| P0 (A1-A5) | 1.5h                | ~1h        | ✅ 5/5 fechados                                                                                      |
| P1 (B1-B7) | 2h                  | ~1h        | ✅ 7/7 fechados                                                                                      |
| P2 (C1-C8) | backlog             | ~30min     | ✅ implementados (C1, C3, C5 parcial, C7) ou viraram TD-104/105/106 (C4, C6) ou docs corrigidos (C8) |
| **Total**  | 3.5h                | **~2.5h**  |                                                                                                      |

Tempo real menor que estimativa porque vários fixes foram interligados (transaction da C1 pegou junto com B4; CHECK da B7 pegou junto com A3 enum). 226 tests passando, zero regressão.

**Pronto pra 1.4.9** (CAPI fanout). TD-104 (LGPD erasure) reclassificado como bloqueio explícito antes de cliente real — endereçar em sessão dedicada antes do gate pré-prod 1.4.8.
