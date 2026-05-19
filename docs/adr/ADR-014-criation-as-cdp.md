# ADR-014 — Criation como CDP (Customer Data Platform), não observador externo

**Status:** Aceito
**Data:** 2026-05-08
**Sessão:** pré-1.3 (decisão estratégica antes de codar OAuth Meta)

## Contexto

A arquitetura v0.6 posiciona a Criation como **observador externo** do tracking do cliente: lê dados do Meta Marketing API + lê eventos do gateway de pagamento via webhook + correlaciona via UTM Stitcher. O cliente continua responsável por configurar o stack de rastreamento dele (Meta Pixel, Google Tag Manager, Stape para server-side, Conversions API).

O fundador articulou que **um dos objetivos principais do produto é tornar o rastreamento assertivo sem complexidade para o usuário** — qualquer infoprodutor deve conseguir conectar e ter rastreamento completo, sem depender de configurar 4 ferramentas distintas. A v0.6 não atende esse objetivo: ela melhora o dashboard, mas não elimina a complexidade da camada de coleta.

A auditoria Meta de 2026-05 ([META_API_2026-05.md](../audits/META_API_2026-05.md)) mostrou que para EMQ ≥ 7 (meta da própria arquitetura) precisamos controlar o payload CAPI ponta-a-ponta — capturando IP, UA, fbp, fbc, external_id no momento certo. Como observador externo, dependemos do que o stack do cliente envia, sem garantia.

## Drivers de decisão

- **Simplificar UX de onboarding** — usuário deve precisar instalar 1 script, não 4 sistemas.
- **Garantir EMQ ≥ 7 sustentável** — nós controlamos a captura, não terceiros.
- **Single source of truth** — uma DB nossa, não correlação fragmentada entre Meta + gateway + Pixel.
- **Diferenciação competitiva** — Stape custa US$ 20-150/mês; Criation já cobra plano mínimo R$ 197/mês, então precisamos absorver o valor da Stape, não conviver com ela.
- **Loop de aprendizado da Fase 3 mais rico** — eventos brutos no nosso DB permitem features que ferramenta de observação não permite (predicted LTV próprio, attribution multi-touch, audience-builder próprio).
- **Compliance LGPD** — virando data processor formal, podemos ter DPIA centralizado e endpoint único de erasure (não precisamos coordenar com Stape, GTM, Pixel).

## Opções consideradas

### Model A — Criation como CDP (substitui Pixel+GTM+Stape)

Cliente cola **um único** `<script>` no site. A Criation:

- Coleta browser events (page_view, view_content, add_to_cart, initiate_checkout, purchase, lead, custom).
- Captura todos click IDs (fbclid, gclid, ttclid, msclkid, ctwa_clid, wbraid, gbraid), fbp, fbc, IP, UA, referrer, UTMs, dataLayer custom events.
- Recebe webhook do gateway de pagamento.
- Correlaciona visitor_id (browser) ↔ buyer_email (gateway) ↔ click_id (Meta) via UTM Stitcher.
- Faz **fanout server-side** para Meta CAPI, Google Enhanced Conversions, TikTok Events API.
- Apresenta dashboard com funil de 8 etapas e fonte explícita por etapa.

### Model B — Observador externo (v0.6 original)

Cliente mantém Pixel + GTM + Stape + gateway. Criation lê via Marketing API + webhook do gateway. Correlaciona, mas não injeta script.

### Model C — Híbrido

Suporta ambos. Cliente escolhe.

## Decisão

**Model A — Criation como CDP.**

A Criation entrega ao cliente uma **camada de tracking turnkey** que substitui Pixel+GTM+Stape. Cliente legado com Pixel já instalado pode coexistir (mesmo `event_id` permite Meta deduplicar), mas o produto **não** é positionado como "complemento ao stack atual" — é **o stack**.

Implicações concretas:

### Camadas técnicas (alto nível)

1. **Tracking script** (`t.criation.io/c.js`)
   - JS minificado (~5KB), sem deps.
   - Auto-instrumenta: page_view, scroll milestones, click em elementos com `data-criation-event`, form submits, video play %.
   - Custom events via `window.criation('track', name, properties)`.
   - Cookieless first-party (visitor_id em cookie 90d no domínio do cliente — via subdomínio Criation por default; CNAME `track.cliente.com → t.criation.io` em sessão futura para Safari ITP / iOS).
   - Respeita Consent Mode v2 (4 sinais).

2. **Ingestion endpoint** (`POST events.criation.io/v1/track`)
   - Subdomínio dedicado para preservar cookie scope.
   - Validação de origin + rate limit por workspace.
   - Persiste em `tracking_events` (raw) imediatamente; processamento async no Trigger.dev.

3. **Visitor↔Buyer matching**
   - Tabela `tracking_visitors` mantém `visitor_id` anônimo + último click ID + UTMs de primeira/última toque.
   - Quando webhook do gateway entrega `Purchase` com `buyer_email` + UTMs, matching service correlaciona com `tracking_events` recentes da mesma session/UTM.
   - `external_id_hash` evolui: `sha256(workspace_id + visitor_id)` (anônimo) → `sha256(workspace_id + buyer_email)` (identificado).

4. **Fanout server-side** (`tracking_events → Meta CAPI / Google EC / TikTok`)
   - Trigger.dev task lê eventos não enviados, monta payload completo (IP+UA+fbp+fbc+external_id_hash+event_source_url+action_source+LDU), envia para cada plataforma com **mesmo `event_id`** para dedup cross-channel.
   - Retry com backoff; falha persistente → DLQ.

5. **Single event store**
   - `tracking_events` é fonte de verdade. `capi_events` deixa de ser tabela primária e vira **log de envios outgoing** (auditoria de fanout).
   - Dashboard, alertas, learning_signals, measure-outcome.job — todos consultam `tracking_events` + `gateway_events` correlacionados.

### Schema implications (não criadas agora — entram em 1.4.A)

```sql
-- Browser events brutos
tracking_events (
  id, workspace_id, visitor_id, event_id, event_name, event_ts,
  client_ip, client_user_agent, page_url, referrer, utms jsonb,
  fbp, fbc, gclid, ttclid, msclkid, ctwa_clid, wbraid, gbraid,
  consent_state jsonb,
  custom_data jsonb,
  -- correlação
  matched_buyer_email_hash text nullable, matched_at timestamptz nullable,
  -- fanout status
  fanout_meta_status text, fanout_google_status text,
  -- partition
  created_at timestamptz default now()
) PARTITION BY RANGE (event_ts);

-- Sessões/jornadas
tracking_visitors (
  visitor_id text primary key, workspace_id, first_seen_at, last_seen_at,
  first_utm_source, first_utm_medium, first_utm_campaign,
  last_utm_source, last_utm_medium, last_utm_campaign,
  first_click_id text, first_click_id_type text,
  identified_buyer_email_hash text nullable, identified_at timestamptz nullable,
  total_events int default 0
);
```

`capi_events` (existente) **muda de papel** mas mantém schema — vira log auditorial das chamadas saintes para Meta. Schema deltas para EMQ (mencionados em ADR-013) ainda se aplicam, mas a captura primária migra para `tracking_events`.

### UX implications

Onboarding wizard (Sessão 1.5) ganha um passo:

1. Conectar Meta (1.3) ✓
2. Conectar gateway (1.4.5-1.4.7) ✓
3. **Instalar tracking script** (1.4.A novo)
4. Mapear UTMs base (1.4.8) ✓
5. Configurar CAPI events (1.4.9, agora reduzido a "ativar fanout") ✓
6. Tour rápido ✓

### Posicionamento de produto

| Antes (v0.6 implícito)                                | Depois (Model A)                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| "Dashboard de inteligência de marketing"              | "Plataforma de tracking + IA de criativos para infoprodutores"          |
| Compete com: Triple Whale, Northbeam (analytics-only) | Compete com: Stape + Triple Whale + Looker Studio + AI tools combinados |
| Requer cliente já configurado                         | Onboarding turnkey                                                      |
| Lock-in: dashboard + análise IA                       | Lock-in: dashboard + análise IA + camada de tracking + EMQ alto         |

## Consequências

**Positivo:**

- Killer demo: "instala 1 tag, ganha funil + atribuição + IA + CAPI". Vendável em 5 min.
- EMQ ≥ 7 controlado pela Criation, não dependente do stack do cliente.
- Single source of truth no DB Criation — dashboard, learning loop, anti-fraude, billing — tudo conversa.
- Diferenciação real vs ferramentas que só observam.
- Loop de aprendizado (Fase 3) tem dados ricos para measure-outcome.job.
- Receita potencial: economiza Stape ($240-1800/ano) → pode justificar plano Pro/Agency.

**Negativo:**

- Escopo da Fase 1 cresce ~10h (3 sessões novas: 1.4.A tracking script, 1.4.B matching, 1.4.9 reescala como fanout).
- Infra de eventos: precisamos pensar particionamento de `tracking_events` desde dia 1 (mensal). Em volume alto (10M+/mês), migração para TimescaleDB ou ClickHouse vira tarefa de Fase 3.
- LGPD scope expande — viramos data processor formal. DPIA mais robusto. Endpoint público de erasure obrigatório (já planejado em 3.13.5).
- Cliente legado com Pixel já configurado precisa ser educado: "deixa o nosso script no lugar" ou "coexiste via event_id". Marketing/copy precisa endereçar.
- Risco se entregarmos meio-CDP: cliente percebe que script tem bug ou latência alta → volta pro Stape. Qualidade do JS SDK precisa ser sólida desde 1.4.A.

**Coisas que decidimos NÃO fazer:**

- **GTM Server-side hosting** — antithesis de SaaS multi-tenant. Cliente que insiste em GTM SS coexiste via `event_id` mas não vendemos integração formal.
- **Tag manager visual** — não competimos com GTM no UI de tag building. Eventos custom via `window.criation('track', ...)` ou via `data-criation-event` em HTML. Power-user usa direto; não-técnico usa eventos auto-instrumentados.
- **Replicar Stape feature-completo** — a Stape oferece coisas que não nos interessam (consent management complexo, multi-tenant proxy). Cobrimos o 80% que importa para o nosso público (infoprodutor BR).

## Cross-references

- **Sessão 1.3** (OAuth Meta Ads) — não muda. Meta connection é necessária em qualquer modelo.
- **Sessão 1.4.A (NOVA)** — Criation tracking script + ingestion endpoint + tracking_events schema (~6h).
- **Sessão 1.4.B (NOVA)** — Visitor↔Buyer matching + UTM Stitcher 2.0 (~4h, expansão da 1.4.8).
- **Sessão 1.4.9** — CAPI sender vira **fanout** de tracking_events para Meta + Google (escopo simplificado, ~5h em vez de 6h).
- **Sessão 2.X (NOVA)** — First-party CNAME (track.cliente.com → t.criation.io) opcional para Safari ITP / iOS (~3h).
- **Sessão 3.13.5** — DPIA expandido (CDP scope) + endpoint erasure unificado.

## Reavaliação obrigatória

Esta ADR deve ser revisitada nos seguintes gates:

- **Gate 1 (Marco da Fase 1):** se < 50% dos 3 betas conseguir instalar o tracking script sozinho em < 10 min, modelo precisa de polish ou mensageria não-técnica.
- **Gate 2 (Marco da Fase 2):** se nenhum dos 10-15 pagantes ter substituído Stape/GTM com nosso script (todos coexistindo), questionar se vendemos como CDP ou só como dashboard premium.
- **Gate 3 (Marco da Fase 3):** se infraestrutura de tracking_events estiver consumindo > 30% do custo total, planejar migração para TimescaleDB/ClickHouse antes da Fase 4.

## Referências

- [docs/audits/META_API_2026-05.md](../audits/META_API_2026-05.md) — auditoria que motivou a discussão
- [ADR-013](./ADR-013-meta-platform-2026.md) — decisões de plataforma Meta (compatível com Model A)
- [ADR-005](./ADR-005-utm-stitcher-cascata.md) — UTM Stitcher original (vai expandir em 1.4.B)
- v0.6 §1.4.x — sessões que precisam de update conceitual quando reescritas (CAPI agora é fanout)
- [ROADMAP.md](../../ROADMAP.md) — sessões 1.4.A e 1.4.B inseridas

---

## Closing notes — 1.4.A entregue (2026-05-12)

### Decisões implementadas (todas confirmadas em código)

| Decisão original                      | Implementação                                                                                                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tracking script `~5KB`                | 5.5KB gzipped sem minify (TD-099: minify → 3KB)                                                                                                                                                                                                               |
| `t.criation.io/c.js` subdomínio       | **Adiado** — same-origin `/criation-tracking.js` no MVP (TD-097: rename antes do launch); subdomínio na sessão 2.X com CNAME Safari ITP                                                                                                                       |
| `events.criation.io/v1/track`         | **Adiado** — same-origin `/api/v1/track` no MVP (decisão registrada nas 4 perguntas iniciais)                                                                                                                                                                 |
| `tracking_events` particionada mensal | ✅ migration 0009, `PARTITION BY RANGE (event_ts)`, task daily M+3                                                                                                                                                                                            |
| `tracking_visitors` (visitor_id PK)   | ✅ flat table, RLS workspace-scoped                                                                                                                                                                                                                           |
| Visitor↔Buyer matching                | ✅ **entregue 1.4.B (2026-05-12)** — cascata 3 estratégias (`deterministic_xcode` 1.0, `clickid` 0.9 / 7d, `utm_recency` 0.7 / 24h) + UTM Stitcher 2.0 visitor-aware (nova estratégia `visitor` 0.95) + reverse matching disparado por `criation('identify')` |
| Fanout server-side com mesmo event_id | **Adiado pra 1.4.9** — schema preparado (`fanout_meta_status`, `fanout_google_status`, indexes parciais `WHERE = 'pending'`)                                                                                                                                  |
| `capi_events` vira log auditorial     | **Migração de papel adiada pra 1.4.9** — schema atual mantido                                                                                                                                                                                                 |
| Cookieless first-party (visitor_id)   | ✅ cookie `_cio_vid` 90d SameSite=Lax (CNAME Safari ITP na 2.X)                                                                                                                                                                                               |
| Consent Mode v2 (4 sinais)            | ✅ read-only via `window.dataLayer`, payload carrega `consent` state pro fanout decidir                                                                                                                                                                       |

### Vetor de poisoning identificado pós-implementação

Workspace_id é UUID v4 público no DOM. Atacante pode posar como cliente legítimo. Mitigação 1.4.A: **grace period 7d + origin allowlist enforce pos-grace**. Mitigação longer-term: ingestion key rotacionável (TD-094) antes do launch público.

### Gates da ADR revisitados

| Gate                  | Critério                                                              | Status                                                                                             |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Gate 1 (Fase 1 marco) | < 50% dos 3 betas instala script sozinho em < 10min → revisitar       | A validar com primeiros betas; snippet 1 linha + workspace_id embutido + status real reduz fricção |
| Gate 2 (Fase 2 marco) | Nenhum pagante substituiu Stape/GTM com nosso script → questionar CDP | Aberto                                                                                             |
| Gate 3 (Fase 3 marco) | Infra tracking_events > 30% custo total → migrar pra TimescaleDB      | Aberto (particionamento mensal já prepara terreno)                                                 |

### Surpresas / aprendizados

- **Sub-tasks cresceram de 6h pra 12h efetivos** — auditoria sistemática + UX revamp + 19 fixes pos-implementação adicionaram escopo. Trade-off válido: produto chega mais maduro.
- **`encryptedCredentials` NOT NULL foi falha de design original** — semanticamente errado pra "analytics connection sem credenciais". Migration 0010 corrige.
- **Drizzle-kit não gera particionamento** — esperado. Migrations manuais via Supabase MCP funcionam mas exigem ADR-019-style "source-of-truth no git, não re-executar" disciplina.
- **Pino logger signature `logger.info(obj, msg)` não `logger.info(msg, obj)`** — typecheck pegou; teria sido bug silencioso (logs sem estrutura).
- **Zod v4 UUID validator rejeita variant nibble fora de [8,9,a,b]** — pegou um UUID de teste hardcoded incorreto. Validador correto, mas surpresa em fixture.
- **IA do menu reorganizada com 5 grupos** — Tracking ganhou destaque (CDP badge no group label), Estúdio agrupado, Afiliados moved pra Conta. Decisão complementar à 1.4.A mas necessária pra produto não esconder o diferencial.

### TDs gerados

- **TD-094** — Ingestion key rotacionável (substitui workspace_id puro)
- **TD-095** — Vary: Origin header
- **TD-096** — SLA p99 cold start
- **TD-097** — Rename `/criation-tracking.js` anti-adblock
- **TD-098** — Sentry browser SDK no script
- **TD-099** — Build/minify step
- **TD-100** — Domain ownership verification

Todos documentados em `docs/tech-debt.md`.

---

## Closing notes — 1.4.B entregue (2026-05-12) + audit fixes (2026-05-12)

### Cascata implementada (4 estratégias)

| Estratégia            | Confidence | Quando aplica                                                                                                                                                                                             | Lookback |
| --------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `deterministic_xcode` | 1.0        | `gateway_events.externalCode === tracking_visitors.visitorId` (link enrichment do `criation-tracking.js` injetou `xcode=visitor_id`). Audit B5: requer UUID v4 estrito — strings arbitrárias rejeitadas.  | —        |
| `clickid`             | 0.9        | `fbclid`/`gclid`/`ttclid` no gateway bate com `tracking_visitors.first/lastClickId` filtrado por tipo (audit A4). **Dormente** até TD-105 (nenhum adapter extrai fbclid hoje).                            | 7d       |
| `utm_recency`         | 0.7        | Visitor recente com mesma `utm_campaign` (sem ambiguidade — 2+ candidatos = unmatched + log audit C3)                                                                                                     | 24h      |
| `reverse_email`       | 0.85       | Disparado por `criation('identify', email)` no browser. Busca `gateway_events` recentes com mesmo `customer_email_hash` e SOBRESCREVE eventos com strategy=`unmatched` (audit A2 — caso de uso primário). | 30d      |
| `unmatched`           | —          | Nenhum sinal acerta. Marca `visitor_matched_at` pra idempotência. Reverse matching pode sobrescrever depois.                                                                                              | —        |

### UTM Stitcher 2.0

Cascata atualizada: **Manual → Visitor → Meta literal → Perfect (UTM gateway) → Unmatched**.

A nova estratégia `visitor` (confidence 0.95) entra antes de Meta literal e Perfect — quando o matcher achou visitor, o stitcher usa `tracking_visitors.lastUtmCampaign` (com fallback `firstUtmCampaign`) pra resolver `campaigns`. Resultado: gateway com `{{ad.name}}` literal mas visitor com UTM real → resolvido (fix automático pra TD-083). Manual mapping ainda tem precedência.

### Reverse matching (audit A2 — corrigido)

Quando `criation('identify', email)` dispara no browser, `process-tracking-event.ts` busca `gateway_events` recentes (30d, mesmo email_hash). **Sobrescreve eventos com strategy=`unmatched`** (caso de uso primário: cliente comprou primeiro, matcher direto marcou unmatched, identify chega depois). Pula eventos com strategy real já resolvida (deterministic/clickid/utm_recency).

Audit B3: quando reverse popula `matched_visitor_id` em evento que já tinha sido stitched com strategy fraca (`unmatched` ou `meta_literal`), reseta `stitched_at = NULL` e re-enfileira `stitchGatewayEventTask` — assim stitcher 2.0 consegue usar visitor strategy (0.95) retroativamente.

### Update bidirecional (transacional pos-audit C1)

Ao matchear, `persistVisitorMatch` escreve em **4 tabelas dentro de `db.transaction`** (atomicidade real):

1. `gateway_events`: `matched_visitor_id`, `visitor_match_strategy`, `visitor_match_confidence`, `visitor_matched_at`
2. `tracking_visitors.identified_buyer_email_hash` (sticky via `COALESCE` + audit A1: filtra por `workspace_id` pra evitar leak cross-workspace)
3. `tracking_events.matched_buyer_email_hash` retroativo (janela 90d alinhada ao TTL do cookie `_cio_vid` — audit B6 pra partition pruning funcionar)
4. `gateway_subscriptions.identified_visitor_id` sticky quando `subscriberCode` presente (audit B4 — fecha o loop visitor↔subscription pra dashboard MRR)

### Idempotência

`visitor_matched_at` (em `gateway_events`) é o sentinel: se setado, matcher pula (no-op). `stitched_at` continua sendo o sentinel do stitcher. Re-runs do Trigger.dev são seguros.

### Surpresas / aprendizados

- **Estimativa 4h, real ~3h** — schema preparado na 1.4.A reduziu fricção (`matched_buyer_email_hash`, índice parcial pronto). Investimento prévio em estrutura compensou.
- **Reverse matching simples no MVP** — só processa `gateway_events` que nunca foram avaliados (`visitor_matched_at IS NULL`). Não sobrescreve unmatched anterior. Suficiente pra MVP; sobreposição mais agressiva fica pra depois se virar problema.
- **`utm_recency` rejeita ambiguidade explicitamente** — 2+ visitors candidatos em 24h pra mesma campanha = unmatched. Evita falso positivo silencioso. Volume MVP nao deve gerar muitos conflitos.

### TDs novos

- ~~**TD-101**~~ — **FECHADO no audit fix C1**: persistVisitorMatch agora usa `db.transaction` (4 UPDATEs atômicos).
- ~~**TD-102**~~ — **FECHADO no audit fix A2**: reverse matching agora sobrescreve `unmatched` (caso de uso primário). Política implementada: pula apenas eventos com strategy real resolvida.
- **TD-103** — Cache do `tracking_visitors` por `visitorId` no stitcher (mesma row lida 2x: matcher + stitcher). Volume MVP não justifica.
- **TD-104** — LGPD erasure path (audit C4). Schema documenta `matched_visitor_id` como soft FK que pode ser apagado por erasure, mas `lib/services/erasure.service.ts` não existe. Bloqueia primeiro titular request real.
- **TD-105** — Adapters de gateway extraem fbclid/gclid (audit A5). Sem isso, estratégia `clickid` fica dormente. Smoke cenário 2 documentado como bloqueado por essa TD.
- **TD-106** — Migration 0011 sem backfill (audit C6). Eventos antigos ficam `visitor_matched_at IS NULL` indefinidamente, alimentando índice parcial sem nunca processar. Requer batch backfill quando volume justificar.

Todos documentados em `docs/tech-debt.md`.

### Auditoria pos-entrega (2026-05-12)

Auditoria sistematica gerou 18 achados (5 P0 + 7 P1 + 6 TDs). **Todos P0 e P1 corrigidos no mesmo dia da entrega.** Documento em `docs/audits/AUDIT-1.4.B-2026-05-12.md`.

Resumo P0/P1 corrigidos:

- A1 (cross-workspace leak): `persistVisitorMatch` step 2 agora filtra `workspace_id`
- A2 (reverse matching pulava unmatched): agora sobrescreve via `overrideUnmatched=true`
- A3 (strategy mentirosa): nova strategy `reverse_email` (0.85) com CHECK constraint
- A4 (clickid cross-tipo): query agora filtra por `lastClickIdType`/`firstClickIdType`
- A5 (clickid morto): documentado como dormente, smoke cenário 2 atualizado, TD-105 criado
- B1+B2 (smoke errors): SQL com `digest()`, cenário 2 reescrito
- B3 (re-stitch): reverse matching reseta `stitched_at` e re-enfileira task
- B4 (subscriptions): 4º UPDATE em `persistVisitorMatch` toca `gateway_subscriptions`
- B5 (UUID validation): `findVisitorByXcode` rejeita strings não-UUID
- B6 (partition pruning): UPDATE retroativo com janela 90d
- B7 (CHECK constraints): migration 0012 com enum + range
