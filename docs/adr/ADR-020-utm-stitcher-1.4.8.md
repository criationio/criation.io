# ADR-020 — UTM Stitcher MVP (Sessão 1.4.8)

**Status:** Aceito
**Data:** 2026-05-10
**Sessão:** 1.4.8 — UTM Stitcher service

## Contexto

Sessões 1.4.5/1.4.6/1.4.7 entregaram adapters Hotmart/Kiwify/Eduzz/Generic com webhooks chegando e populando `gateway_events.utm_*`. Hoje cada venda fica órfã: temos `utm_campaign="Black Friday 2026"` mas não sabemos que isso é a `campaigns.id=abc-123` sincronizada do Meta. Dashboards de receita por campanha não funcionam, ROAS real não existe.

A v0.6 §1.4.8 prevê cascata `Perfect → Partial → Fuzzy → Manual → Unmatched`. O ROADMAP avisa explicitamente que cascata completa toma 8h em vez de 5h por causa de edge cases de normalização e calibração de fuzzy.

Cliente já cola um script JS na head das próprias páginas (estilo "Comunidade Nova Ordem do Digital") que faz link enrichment de UTMs — isso vira oportunidade de oferecer um script nosso, garantindo UTM limpa chegando no gateway.

## Drivers de decisão

- Ship rápido: stitcher útil em produção em 1 sessão (~6h), não 2.
- Validar produto antes de calibrar: fuzzy match precisa de dados reais pra threshold.
- Anti-pattern do roadmap: "subestimar 1.4.8 toma horas em edge cases".
- UX do cliente: melhor ter atribuição explícita (perfect+manual) do que probabilística (fuzzy) que dá falsos positivos.

## Opções consideradas

### 1. Estratégias de match no MVP

a. **Cascata completa v0.6**: Perfect → Partial → Fuzzy → Manual → Unmatched.
b. **Perfect + Manual + Fuzzy**: 3 estratégias.
c. **Perfect + Manual** (escolhido).

**Escolhido:** (c). Justificativas:

- Com link enrichment script, UTM chega limpa (cliente raramente erra). Perfect cobre 85-90%.
- Fuzzy gera falsos positivos quando há campanhas com nomes parecidos ("BF Mulheres" vs "BF Homens").
- Manual mapping cobre casos onde cliente usa UTM custom ("BF" para "Black Friday 2026 - VSL").
- Partial (utm_medium+source + receita recente) é heurística frágil — adia pra 1.4.B.

Fuzzy/Partial movem pra **TD-080** (Stitcher 2.0 na 1.4.B, junto com Visitor↔Buyer matching).

### 2. Aggregates de receita por campanha

a. Job dedicado `refresh-campaign-aggregates` rodando a cada N min.
b. **UPDATE inline** após cada match perfect (escolhido).
c. Skip total — dashboards calculam on-demand via JOIN.

**Escolhido:** (b). Justificativas:

- Volume MVP: ~100 vendas/dia/cliente. UPDATE simples não causa lock.
- Job dedicado adiciona latência e complexidade pro dashboard que ainda nem existe.
- Skip total empurra custo pro dashboard 1.6 — preferimos ter os números prontos.

Migration adiciona 4 colunas em `campaigns`: `revenue_gross_cents_30d`, `revenue_gross_cents_total`, `attributed_orders_count`, `roas_real`, `last_stitched_at`. Quando volume crescer, migra pra job (TD-081).

### 3. Backfill de eventos antigos

a. **TD-080** (escolhido). Cliente cria mapping manual hoje → afeta vendas futuras. Histórico fica como está até 1º cliente pedir.
b. Server action manual agora.

**Escolhido:** (a). Backfill é raramente usado no MVP, custo de 1h trabalho extra vs valor incerto.

### 4. Tracking script público

a. **Versão genérica enxuta** (~100 linhas) entregue como bônus (escolhido).
b. CDP completo (1.4.A do roadmap, ~12-15h trabalho).
c. Ignorar — só stitcher server-side.

**Escolhido:** (a). Versão simples cobre 80% do valor com 10% do trabalho:

- Captura UTMs da URL atual + fallback de `document.referrer`
- Persiste em cookie first-party `_cio_utms` por 90d (sobrevive a navegação)
- Link enrichment **seletivo**: só modifica links pra domínios de checkout conhecidos (hotmart.com, kiwify.com, eduzz.com, monetizze, ticto, cakto, greenn). Não polui links externos.
- Detecta SPA via `history.pushState` listener
- Sem ingestion endpoint, sem visitor_id first-party — isso fica pra 1.4.A (CDP completo)

Trade-off: cliente que tem checkout custom (não nos domínios conhecidos) não tem link enrichment automático. Documentamos como configurar `data-criation-checkout` em links pra forçar.

### 5. Integração com pipeline existente

a. Stitcher dentro do `process-gateway-event` (sequencial).
b. **Stitcher em task paralela** `stitch-gateway-event` (escolhido).
c. Stitcher inline no webhook handler (síncrono).

**Escolhido:** (b). Stitching e billing são side-effects independentes:

- Falha no stitcher não deve bloquear allocate de créditos.
- Trigger.dev v3 enfileira ambas após webhook insert.
- Latência maior é OK — stitcher tem latência alvo p95 < 1s mas não é crítico pro response do webhook.

## Decisão

**Schema:**

- `gateway_events`: novas colunas `match_strategy text` (enum: `perfect | manual | unmatched`), `matched_campaign_id uuid`, `matched_ad_set_id uuid`, `matched_ad_id uuid`, `match_confidence decimal(5,4)`, `stitched_at timestamptz`. Default `match_strategy='unmatched'`.
- `campaigns`: novas colunas `revenue_gross_cents_30d integer default 0`, `revenue_gross_cents_total bigint default 0`, `attributed_orders_count integer default 0`, `roas_real decimal(10,4)`, `last_stitched_at timestamptz`.
- Index parcial em `gateway_events(workspace_id, match_strategy) WHERE match_strategy='unmatched'` (pra dashboard de não-atribuídas).

**Código:**

- `src/lib/services/utm-normalizer.ts` — função pura `normalizeUtm(s)` (lowercase, strip diacritics, `[-_\s]+` → `-`, trim) + detector de literal Meta `{{...}}`.
- `src/lib/services/utm-stitcher.service.ts` — orquestra cascata Perfect → Manual → Unmatched, retorna `StitchResult` discriminada.
- `src/lib/db/queries/utm-matching.ts` — `findCampaignByNormalizedName`, `findManualMapping`, `incrementCampaignAggregates` (UPDATE atomic via `revenue + ?`).
- `src/lib/trigger/tasks/stitch-gateway-event.ts` — task dedicada, enfileirada paralela ao `process-gateway-event` no webhook handler.
- `src/lib/actions/utm-mappings.ts` — CRUD `createUtmMapping`, `listUtmMappings`, `deleteUtmMapping` com Result pattern.
- `src/app/(app)/configuracoes/utm-mappings/page.tsx` — tabela + form Zod.

**UI:**

- `/configuracoes/utm-mappings` — gerenciamento de mappings manuais.
- Dashboard de "vendas não atribuídas" entra na 1.6, esta sessão expõe só os dados.

**Tracking script:**

- `public/criation-tracking.js` (~100 linhas, ES5 friendly).
- Página `/configuracoes/tracking-script` — copy-paste snippet com 2 linhas.

## Consequências

**Positivo:**

- ROAS real funciona em produção (perfect match cobre maioria com link enrichment).
- Manual mapping cobre edge cases sem heurística probabilística.
- Schema deltas zero-downtime (PR aditivo simples).
- Stitcher independente do billing — falha em um não bloqueia outro.
- Tracking script reduz UTM bagunçada em ~30-40%.

**Negativo:**

- Fuzzy/Partial deixam buracos que requerem mapping manual em 10-15% dos casos.
- UPDATE inline em campaigns pode causar lock contention quando volume escalar (TD-081 migra pra job dedicado).
- Tracking script não cobre clientes com checkout custom fora dos domínios conhecidos (workaround documentado).
- Sem visitor_id first-party — Visitor↔Buyer matching depende de 1.4.B.

**TDs criadas:**

- **TD-080**: Backfill server action pra re-stitch eventos antigos quando cliente cria mapping novo.
- **TD-081**: Job dedicado `refresh-campaign-aggregates` quando UPDATE inline causar lock contention.
- **TD-082**: Fuzzy match (Jaro-Winkler ≥0.85) e Partial match (utm_medium+source) na 1.4.B.
- **TD-083**: Detector automático de UTM literal `{{ad.name}}` (cliente esqueceu URL parameters Meta) com alerta acionável no dashboard.
- **TD-084**: Normalização inteligente de checkout domains custom (atributo `data-criation-checkout` em links).
- **TD-085**: Integração com 1.4.B (Stitcher 2.0) pra correlacionar visitor_id ↔ buyer_email após cliente identificado.

## Referências

- v0.6 §1.4.8 (cascata completa proposta)
- ROADMAP §1.4.8 + anti-pattern note
- ADR-014 (Criation as CDP — sessão 1.4.A)
- Schema: `src/lib/db/schema/gateway.ts` (utmMappings, utmStitchingLog), `campaigns.ts`
