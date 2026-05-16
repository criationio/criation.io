# 🚨 GATE PRÉ-PRODUÇÃO — UTM Stitcher (Sessão 1.4.8)

**Status:** PENDENTE — não executar até ecossistema estar completo
**Bloqueador de:** primeiro cliente real / beta testers / launch público
**Tempo estimado:** ~1h trabalho conjunto (dev + executor de teste)
**Última atualização:** 2026-05-10

## Por que esse checklist existe

O smoke E2E executado em dev (2026-05-10, run `cmp0eh5a61b390olx5xtrd2zq`) validou apenas a **engine isolada** do stitcher:

- ✓ Cascata Manual → Meta literal → Perfect → Unmatched
- ✓ Persistência em `gateway_events.match_*`
- ✓ UPDATE atomic em `campaigns` aggregates
- ✓ Trigger.dev v3 worker dev executa em 1.7s

**O smoke NÃO validou:**

- ✗ Pipeline real `webhook → process + stitch` em prod
- ✗ Trigger.dev em PROD (stitcher task ainda não foi deployado em prod)
- ✗ Match Perfect com nome de campanha real (apenas Manual)
- ✗ Edge cases conhecidos (afiliado Hotmart, refund, UTM bagunçada)
- ✗ Carga real (1 evento ≠ 10k/min target v0.6)

**Sem executar este checklist:**

- Cliente vê vendas no banco mas dashboards mostram "0 atribuído"
- ROAS por campanha inflado (refund não reverte aggregates)
- Vendas Hotmart via Sparkle (afiliado) ficam unmatched silenciosamente
- Perda de confiança no produto (cliente paga pra ter tracking certo)

## Os 5 testes obrigatórios antes de qualquer cliente real

### 1. Deploy Trigger.dev em prod ⚠️ P0

```bash
pnpm exec trigger deploy --env prod
# Ou via MCP: mcp__trigger__deploy(environment='prod')
```

**Verificar:**

- Versão nova aparece em `cloud.trigger.dev/projects/proj_xxaeizypavwtbpfpzyzk`
- Tasks listadas: `sync-campaigns`, `meta-token-refresh`, `process-gateway-event`, `stitch-gateway-event`
- `mcp__trigger__list_runs --environment prod --taskIdentifier stitch-gateway-event` deve eventualmente mostrar runs após webhook real

### 2. Webhook E2E real com Manual mapping

**Setup:**

- App rodando em `https://app.criation.io` (Vercel prod)
- Hotmart sandbox configurado apontando webhook pra prod URL
- Mapping manual ativo: `utm_campaign=teste-prod` → 1 ad ativo

**Execução:**

1. Disparar venda teste via painel Hotmart sandbox
2. Modificar payload pra incluir `utm_campaign=teste-prod`
3. Verificar dentro de 5s:
   - `gateway_events` tem nova row com `processed_at` e `stitched_at` populados
   - `match_strategy = 'manual'`
   - `matched_ad_id` populado
   - `campaigns.revenue_gross_cents_total` incrementou

**Critério passa/falha:** todos 4 itens acima ok = ✅

### 3. Webhook E2E real com Perfect match

**Setup:**

- Cliente configurou URL parameters no Meta Ads: `utm_campaign={{campaign.name}}`
- Campanha real "Black Friday Teste" sincronizada via Meta

**Execução:**

1. Disparar venda teste com `utm_campaign=Black Friday Teste`
2. Verificar `match_strategy = 'perfect'` + `matched_campaign_id` populado

**Critério:** match perfect funciona sem mapping manual = ✅

### 4. Refund handling ✅ TD-086 fix aplicado 2026-05-16

**Execução:**

1. Disparar PURCHASE_APPROVED com utm_campaign válida → aggregates incrementam
2. Disparar PURCHASE_REFUNDED do mesmo `transaction` → **verificar se aggregates revertem**

**Critério:** ✅ stitcher agora detecta `PURCHASE_REFUNDED`/`PURCHASE_CHARGEBACK` e dispara `decrementCampaignAggregates` em vez de increment. `GREATEST(0, ...)` previne valores negativos. **Smoke E2E real em prod pendente** (executar como parte da 1.4.9.5 quando Hotmart sandbox disponível).

### 5. Afiliado Hotmart (sem utm\_\*, com `origin.src`) ✅ TD-087 fix aplicado 2026-05-16

**Execução:**

1. Configurar venda teste com afiliado Sparkle
2. Payload chega com `origin.src=<affiliate_code>` e `utm_*` vazios
3. Verificar `match_strategy`

**Pré-req do admin:** criar `utm_mappings` row com `origin_src=<affiliate_code>` apontando pro ad/campaign. Via Server Action `createUtmMapping({originSrc, adId})` ou SQL direto. Form UI ainda não expõe campo (TD-120, Baixa).

**Critério:** ✅ stitcher agora tem estratégia `affiliate` na cascata (confidence 0.95). Cascata: Manual → Visitor → Meta literal → Perfect → **Affiliate** → Unmatched. **Smoke E2E real em prod pendente** (1.4.9.5).

## TDs identificadas (criar no sistema de tracking)

| TD         | Severidade | Descrição                                                                                                                                                                                 |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~TD-086~~ | ✅ Closed  | ~~Refund/Chargeback reverter aggregates~~ — fechado 2026-05-16 (Fase B). 12 testes Vitest cobrindo decrement em PURCHASE_REFUNDED + PURCHASE_CHARGEBACK.                                  |
| ~~TD-087~~ | ✅ Closed  | ~~Stitcher ler origin.src~~ — fechado 2026-05-16 (Fase B). Migration 0018 + estratégia `affiliate` na cascata (confidence 0.95). 7 testes Vitest.                                         |
| **TD-120** | 🟢 P3      | UI: form `/configuracoes/atribuicao` precisa campo "Código Afiliado" pra admin criar affiliate mapping sem SQL (depende TD-087).                                                          |
| **TD-088** | 🟡 P1      | Re-stitch automático quando `sync-campaigns` traz campanha nova. Hoje: cliente roda anúncio + venda chega antes do sync (4h cron) = unmatched permanente até mapping manual.              |
| **TD-089** | 🟡 P1      | Backfill server action: re-stitch eventos antigos quando mapping novo é criado. Mencionado em ADR-020 como TD-080, aqui formalizado.                                                      |
| **TD-090** | 🟡 P1      | Load test 10k events/min target v0.6. UPDATE inline em campaigns pode dar lock contention com burst de webhooks. Migrar pra job dedicado `refresh-campaign-aggregates` se confirmar.      |
| **TD-091** | 🟢 P2      | Detector de UTM literal `{{ad.name}}` deve gerar alerta UI acionável "Você esqueceu de configurar URL parameters no Meta". Hoje só marca `match_strategy='meta_literal'` silenciosamente. |
| **TD-092** | 🟢 P2      | Cobrir caso `utm_campaign` multi-valor querystring (`?utm_campaign=A&utm_campaign=B`) — comportamento atual indefinido.                                                                   |

## Riscos se subir sem executar

### Trivialmente reversíveis (fix retroativo OK)

- **Stitcher sem deploy**: roda `trigger deploy` quando descobre. Eventos antigos ficam unmatched temporariamente.
- **Afiliado ignorado**: backfill via `re-stitch + leitura de origin.src` quando fix for deployado.
- **Refund não reverte**: query histórica `WHERE event_type IN ('PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK')` + UPDATE pra desconta.
- **UTM bagunçada**: refinar normalizer + re-stitch dos unmatched.

**Mecanismo de salvação**: `gateway_events` armazena `raw_payload` + `match_strategy` — re-stitch é sempre possível porque dados originais estão preservados.

### Não-reversíveis (perda real)

- **Cliente perde confiança**: ROAS errado em produto que vende tracking certo é dano de reputação difícil de recuperar.
- **Decisão de mídia errada**: cliente desliga campanha que aparenta ter ROAS baixo (por bug de atribuição) e perde vendas reais. Receita perdida não volta.

## Recomendação final

**Não subir nenhum cliente real até:**

1. Os 5 testes acima executados em prod com pass ✅
2. TD-086 (refund) e TD-087 (afiliado) **resolvidos**, não só documentados — bugs P0 silenciosos
3. Dashboard de "vendas não atribuídas" acessível ao cliente (TD-091 mínimo)

**Subir cliente real possível com:** 1 + 2 acima. TD-088 a TD-092 podem viver como tech debt visível com workarounds documentados.

## Como executar este checklist

Quando ecossistema estiver completo (1.4.A CDP + 1.4.9 CAPI + 1.5 Onboarding + 1.6 Dashboard mínimo):

1. Avisar Claude: "Vamos executar PRE-PROD-VALIDATION-1.4.8"
2. Claude executa deploy Trigger prod (Bash + MCP)
3. Usuário executa testes 2-5 via Hotmart sandbox
4. Claude valida resultados via SQL no banco
5. Cada teste com falha gera fix (não só TD)
6. Final: documento atualizado com status ✅/❌ + data
