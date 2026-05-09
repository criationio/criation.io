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
