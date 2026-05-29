# Criation.io — ROADMAP de Execução

> Plano de voo do desenvolvimento, do zero ao launch.
> Documento companheiro de [`criation-io-arquitetura-v06.html`](./docs/criation-io-arquitetura-v06.html), `CLAUDE.md` e `AGENTS.md`.

---

## Como usar este documento

1. **Vive no repo, na raiz**, ao lado de `CLAUDE.md` e `AGENTS.md`. Claude Code lê automaticamente.
2. **Cada sessão tem checkbox**. Marque `[x]` quando o PR for merged em develop.
3. **Referências `[v0.6 §X]`** apontam para a seção correspondente em `docs/criation-io-arquitetura-v06.html` — onde estão os comandos reais para Claude Code.
4. **Modelo de negócio = v0.6 Parte 4.** Toda dúvida sobre créditos, margem, planos, pacotes, trial, `signup_bonus`, expirações ou refunds: vai pra Parte 4 do v0.6. Este roadmap só _referencia_; a especificação completa está lá.
5. **Marcos de validação** são **gates**, não sugestões. Se um marco não foi atingido, **não avance de fase** — algo está quebrado e vai custar 5x mais consertar depois.
6. **Cada fase tem seu próprio "definição de pronto"**. Use como checklist de fechamento antes de declarar fase completa.
7. **Atualize o `## Status atual`** semanalmente. Te força a olhar honestamente para onde está.

---

## Status atual

**Última atualização:** 2026-05-29 (madrugada, continuação direta da sessão 2026-05-28)
**Fase ativa:** Fase 1 — Core Value
**Próxima sessão:** **Tracking install em 1 landing real** (~30min setup + esperar venda) OU **1.7.5 creditService** (~5h base do billing). **1.5 + 1.6 + 1.7 entregues**. 1.4.9.5 (shadow validation) continua bloqueada por OAuth Google rework de vídeo (Trilha B). Suite **536/536 verde**.
**Status externo:** Google Ads Developer Token **Basic Access aprovado** 2026-05-19 (15k ops/day). OAuth verification **pediu refilmagem do vídeo demo 2026-05-28** ("does not sufficiently demonstrate the functionality") — decisão de **adiar refilmagem** até produto ter mais features pra mostrar (Trilha B). Janela de reply ao Google: ~30-60d antes ticket arquivar (~2026-06-15 a 2026-07-15).
**Decisão estratégica recente:** [ADR-015](./docs/adr/ADR-015-plataforma-google-2026.md) — Google fanout via **Data Manager API** (`POST /v1/events:ingest`), não Google Ads API `ConversionUploadService`. Recomendação oficial Google + Criation cai sob restrição de 2-fev-2026 como new developer + Customer Match Fase 3 reusa mesma API. Anterior: [ADR-014](./docs/adr/ADR-014-criation-as-cdp.md) — Criation vira CDP.
**Auditorias de plataforma:** [Meta 2026-05](./docs/audits/META_API_2026-05.md) (ADR-013) e [Google 2026-05](./docs/audits/GOOGLE_API_2026-05.md). Releitura obrigatória antes de 1.4.9 (Meta CAPI) e 2.10 (Google).
**Bloqueios:** Business Verification + App Review do app Criation no Meta tem timeline 4-12 semanas — pré-req de launch público (até lá, dev mode com Test Users). Privacy Policy URL + endpoint Data Deletion stub já criados; ativar em Live Mode quando submeter App Review.
**Bloqueios pré-cliente real:** GATE pré-prod [1.4.8 checklist](./docs/checklists/PRE-PROD-VALIDATION-1.4.8.md) **fixes técnicos aplicados** 2026-05-16 (TD-086 refund reversal + TD-087 affiliate strategy) — falta apenas smoke E2E em prod real (executar como parte da 1.4.9.5). [TD-104](./docs/tech-debt.md) LGPD erasure path **fechado** 2026-05-16. [TD-108](./docs/tech-debt.md) retention 30d **fechado** 2026-05-16. Outros TDs condicionais: TD-109 (gateway-only fanout) quando cliente sem script conectar, TD-111 (CTWA payload validation) quando cliente com WhatsApp ads ativar.

**Ações operacionais 2026-05-29** (9 commits develop ahead origin, todos pushed):

- **`003f2fd` Sessão 1.7 — /campanhas listagem + detalhe + comparativo.** 7 sub-PRs (~9h escopo expandido). Listagem com filtros URL-driven (período/status/plataforma/busca/ad_account) + paginação 25/pg via CTE. `/campanhas/[id]` com 8 KPI cards reusando `<KpiCard>` do dashboard (Gasto/Receita/Cliques/CTR/Conv/ROAS/Impressões/CPA com `invertDeltaPolarity`) + delta % vs período anterior + chart Recharts ComposedChart (receita area + gasto line + cliques/conv eixo direito) + AdSetsTreeTable expansível + CreativesGallery grid responsivo com thumbnails Meta. `/campanhas/comparativo` MVP side-by-side 10 métricas + delta % + vencedor highlighted (`lowerIsBetter` pra CPA/CPC/CPM). Utils puros `src/lib/campanhas/comparison.ts` + 19 testes. Smoke doc 8 áreas.
- **`90f7d93` → `40aca0c` Cadeia 8 bug fixes camada Meta E2E** durante teste real do Vinicius (32 ad accounts, multi-BM agência):
  - `90f7d93` connectHref vai direto pra /api/oauth/meta/start (tela /bem-vindo/meta bloqueada por layout onboarding pós Sessão 1.5)
  - `3207aa3` AdAccountPicker no modal Meta (depois removido)
  - `bb3a4ad` Callback agrega ad accounts de TODOS os BMs (listMyAdAccounts + iteração businesses + dedup) — passou de 1 → 32 contas
  - `2cf35f8` replaceAdAccounts ON CONFLICT usar EXCLUDED.\* (bug fazia todas as 32 ficarem com mesmo nome)
  - `684f069` Filtro por ad account em /campanhas (dropdown na barra) — listagem misturava 800+ de 24 contas
  - `63ef098` listAdAccountsByWorkspace via Drizzle (db.execute retornava snake_case)
  - `d4ebc09` Refactor remover conceito de "ad account default" pra modelo agência (Vinicius questionou; AdAccountPicker → AdAccountList read-only)
  - `40aca0c` Remover video_3/15/30_sec_watched_actions (Meta API v25 rejeita com HTTP 400 #100) — era a causa de TODOS os workspaces terem 0 ad_insights

**Trigger.dev deploy v20260529.2 ativo em prod** (deployei via `mcp__trigger__deploy` após fix 9). Versão anterior v20260520.1 tinha o bug video fields.

**Setup operacional adicionado:**

- Vercel preview env vars completadas (META*APP_ID/SECRET, TRIGGER_SECRET_KEY trocada de tr_dev* pra tr*prod*, TRIGGER_PROJECT_REF, NEXT_PUBLIC_APP_URL pra URL fixa do branch develop)
- `.env.local` ganhou linha `TRIGGER_SECRET_KEY_PROD` pra futuros usos hosted

**Estado real do produto (Vinicius workspace):**

- ✅ Meta: 32 ad accounts conectadas (multi-BM Heal/OpenSci/Pamela/Whispa/Laura/Vinicius/Método Metabólico/etc.), insights populando
- ✅ Estrutura: 917 campaigns (51 ACTIVE / 866 PAUSED) + 3577 ads
- ✅ Gateways: 4 active (Hotmart x3, Kiwify x2, Eduzz, Generic x2), 106 webhooks 30d
- ❌ **Tracking visitors: 0** — `criation-tracking.js` não está em nenhuma landing real
- ❌ **Receita atribuída: 0** — todos 106 eventos `match_strategy='unmatched'` (vendas sem UTM/fbclid + sem visitor)

**Próximos passos pra fechar E2E:** instalar `criation-tracking.js` em 1 landing real (snippet em `/configuracoes/tracking-script`) + adicionar domínio na allowlist + padronizar UTM nas campanhas Meta. Sem isso, dashboard fica com spend/CTR mas sem receita/ROAS/CAC.

**Ações operacionais 2026-05-28** (sessão original):

- **`1ededa3` Sessão 1.5 — Onboarding restruct.** Wizard de 7 passos → **3 estágios** (perfil + créditos + tour interativo no dashboard) após feedback UX. Form perfil revamped (gateways multi-select + faturamento 5 buckets + ad spend 5 buckets). Credits page celebratória. **Tour interativo** com react-joyride 3.x + tooltip custom glassmorphism theme-aware cobrindo 12 stops (sidebar + topbar). Middleware gate via cookie + whitelist gateway connect. Schema: `users.profile_context jsonb` (0019) + `users.onboarding_step` reduce pra 3 valores (0020) + `users.tour_completed_at` (0021). TD-013 (welcome email retry via Trigger.dev task) + TD-018 (anti-fraude burst test, 7 testes) fechados. Suite 431 → 453 (+22).
- **`bc94f09` Sessão 1.6 main — Dashboard Mixpanel-style.** 12 widgets customizáveis (6 KPI cards + funnel pyramid 8 etapas configurável + sales chart + top criativos + channel mix donut + UTM table + cohort heatmap). Drag-drop + resize via **react-grid-layout v2.2** (React 19-ready com nodeRef pattern — v1 silenciava drag por `findDOMNode` removido). Saved views CRUD (`dashboard_layouts` migration 0022) + Funis nomeados (`dashboard_funnels` migration 0023 + `/configuracoes/funis` admin). Filtros via URL search params (period/comparison/attribution/channels/products/funnel). 6 queries reais em `dashboard-metrics.ts` com toggle `hasWorkspaceData` (>= 5 gateway*events em 30d) — abaixo mostra mock com badge "exemplo". Atribuição last-click via matched*\* fields. Cohort segue mock (defer).
- **`6ae9256` Sessão 1.6 PR-14 + PR-15 — Polish.** Empty states per widget quando real data vazio + `/dashboard/loading.tsx` skeleton com shimmer + 4 test files novos (channel-mapping + period-range + mock-data + funnel-presets, **+64 testes**) + smoke E2E doc completo em `docs/smoke/1.6-dashboard.md`. Suite final **517/517**.

**Audit pre-commit Sessão 1.6** (Explore agent + Supabase advisors):

- TSC + lint + 517/517 tests verdes
- RLS verificada: 4 policies (SELECT/INSERT/UPDATE/DELETE) por tabela nova
- Deleted: `src/lib/dashboard/filters-store.ts` (Zustand store obsoleto substituído por URL search params em PR-13a)
- Pre-existing security advisors não-bloqueantes (function search_path WARN, RLS missing em `meta_data_deletion_requests` e `meta_ad_accounts`, leaked password protection) — backlog antigo

**Sentry setup ativo:**

- Org: `criationio`, Project: `criation-io` (Next.js platform)
- DSN configurado em Vercel (Production + Preview)
- Dashboard: https://criationio.sentry.io/issues/?project=4511419526938624
- Source maps opcionais (criar Internal Integration token em https://sentry.io/settings/criationio/developer-settings/ se stack minified incomodar)

**Trigger.dev prod ativo:**

- Versão atual: `v20260520.1` (com TD-021b correlation + fix Drizzle)
- 17 tasks deployadas, todos crons completed (validado via MCP)
- Dashboard: https://cloud.trigger.dev/projects/v3/proj_xxaeizypavwtbpfpzyzk

**TDs follow-up abertos (sem gate ativo):**

- TD-021c correlation Tier 3 (6 Server Actions: gateway-connections, utm-convention, notifications, tracking, meta-capi, google-conversoes) — Baixa
- TD-022b `Sentry.withServerActionInstrumentation` wrap explícito em Server Actions — Baixa
- TD-024b CSP enforce com nonce — Media, depende 1-2 semanas observando report-only
- TD-104b LGPD erasure endpoint público — Media, depende TD-031 Resend
- TD-014 middleware.ts → proxy.ts rename — Baixa, 30min

**Aprendizados documentados em memória (sessões futuras) — gotchas reusáveis:**

- `vercel.json` `headers` array sobrescreve next.config no edge — validar curl em prod URL, não pnpm dev
- `withSentryConfig` wrap em next.config é obrigatório pro SDK runtime, não só source maps — condicional pra upload apenas dentro do wrap
- Drizzle `sql\`${col} < ${date}\``serializa Date com`toString()`, não ISO — Postgres pooler rejeita silenciosamente. Sempre usar operadores nativos (`lt/gt/eq/between`) com colunas timestamp
- **react-grid-layout v1 quebra silenciosamente em React 19** porque `react-draggable` v4 chama `findDOMNode` (removido). Usar v2.x (nodeRef pattern) com API `gridConfig/dragConfig/resizeConfig`
- **`useState(loadFromLocalStorage)` causa hydration mismatch** SSR/CSR (server retorna fallback, client retorna localStorage). Hidratar em `useEffect` pós-mount; aceitar setState-in-effect lint nesse cenário
- **next-themes v0.4.x + React 19 gera warning benigno** `Encountered a script tag while rendering React component` — fix upstream esperado em v0.5+
- **Tailwind v4 arbitrary selector com `&` aninhado** (`[.parent:hover_&]:flex`) é instável; usar CSS global em `globals.css` quando precisar de descendant selector confiável
- **Meta API v25 descontinuou `video_3/15/30_sec_watched_actions`** — retorna HTTP 400 (#100). Manter só `video_play_actions` + `actions`. TD pendente: migrar pra `video_continuous_2_sec_watched_actions`. Ver [[reference-meta-api-v25-gotchas-2026-05]]
- **OAuth Meta callback multi-BM** — `businesses[0]` perde ad accounts dos outros BMs. Agregar `listMyAdAccounts` + iterar `businesses.map(listOwnedAdAccounts)` + dedup por accountId
- **SQL `ON CONFLICT DO UPDATE`** — usar `sql\`EXCLUDED.col\`` pra per-row updates. Sem isso, todas as rows conflitantes recebem o mesmo valor estático
- **`db.execute(sql\`...\`)` retorna snake_case literal** (não camelCase). Cast `as MyType[]` engana TS. Usar Drizzle query builder `.select().from()` pra preservar mapping
- **Meta App em Dev mode + admin user** — Facebook silenciosamente concede permissões sem mostrar consent screen. Não esperar ver consent; confirmar via `meta_connections.granted_scopes` no DB
- **Vercel preview env vars `--sensitive` NÃO retornam valor via `vercel env pull`** — segurança. Copiar manualmente do dashboard ou `.env.local`. Sintaxe: `vercel env add NAME preview <branch> --value $VAL --sensitive --yes` (sem branch dá action_required)
- **Trigger.dev tem deploy SEPARADO do Vercel** — código em tasks só roda após `pnpm trigger:deploy` (ou `mcp__trigger__deploy`). Verificar versão atual via `get_current_worker env=prod` vs commit hash
- **Trigger.dev key prefix `tr_dev_*` vs `tr_prod_*`** — dev key requer `pnpm trigger dev` worker local; em Vercel hosted runs ficam QUEUED indefinidamente. Usar prod key em preview
- **Layout `(onboarding)` redireciona pra /dashboard quando `step === 'completed'`** — bloqueia páginas legacy `/bem-vindo/*`. Mover páginas pós-conexão pra fora do route group OU apontar links direto pro endpoint final

| Fase                     | Status          | Início     | Fim        | Notas                                                                                                                                                                                                                                                                                          |
| ------------------------ | --------------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fase 0 — Pré-dev         | ✅ Concluído    | 2026-04    | 2026-05-07 | 4 sessões + correção pós-0.5                                                                                                                                                                                                                                                                   |
| Fase 1 — Core Value      | 🟡 Em andamento | 2026-05-07 | —          | 1.1-1.4.9.C + **1.5 (onboarding restruct)** + **1.6 (dashboard Mixpanel-style)** + **1.7 (/campanhas list+detail+comparativo)** fechadas (2026-05-28/29). 1.4.9.5 (shadow E2E) adiada por bloqueio externo (OAuth Google video rework). Próxima: instalar tracking real OU 1.7.5 creditService |
| Fase 2 — Consistência    | ⬜ Não iniciado | —          | —          | —                                                                                                                                                                                                                                                                                              |
| Fase 3 — Retenção        | ⬜ Não iniciado | —          | —          | —                                                                                                                                                                                                                                                                                              |
| Fase 4 — Polish + Launch | ⬜ Não iniciado | —          | —          | —                                                                                                                                                                                                                                                                                              |

Legenda: ⬜ não iniciado · 🟡 em andamento · ✅ pronto · 🔴 bloqueado

---

## Visão geral

| Fase                      | Duração            | Sessões | Marco final                                               |
| ------------------------- | ------------------ | ------- | --------------------------------------------------------- |
| **0** Pré-desenvolvimento | ~1 semana          | 4       | Repo + auth + design system rodando                       |
| **1** Core Value          | ~5-6 semanas       | 20      | 1º cliente pagante completou ciclo end-to-end             |
| **2** Consistência        | ~6 semanas         | 16      | 10-15 pagantes ativos, NPS positivo                       |
| **3** Retenção            | ~6 semanas         | 17      | 30-50 pagantes, margem positiva, loop de aprendizado vivo |
| **4** Polish + Launch     | ~2-3 semanas       | 10      | Product Hunt live                                         |
| **Total**                 | **~21-23 semanas** | **67**  | **Launch público**                                        |

**Filosofia de timeline:** estes números pressupõem desenvolvimento focado com Claude Code (Antigravity IDE), 4-6h produtivas/dia, sem grandes desvios para clientes da agência. Multiplique por 1.5x se mantiver carga paralela da AGC.

---

## Princípios não-negociáveis

Antes de tocar código, internalize estes 8 princípios. Eles previnem 80% dos erros comuns em SaaS multi-tenant.

1. **Multi-tenant desde o dia 1.** Toda tabela tem `workspace_id`. RLS habilitada de cara. Refactor depois custa semanas.
2. **CAPI Fase 1, não Fase 3.** Vendemos para infoprodutores que gastam R$10k-100k/mês em ads. Tracking server-side abaixo do que Stape oferece desqualifica o produto. [v0.6 §3.2 Sessão 1.4.9]
3. **Compliance Fase 1, não Fase 4.** Consent Mode v2 + LDU + PII redaction antes do launch. ANPD pode multar; Google bloqueia bidding sem consent. [v0.6 §3.2 Sessão 1.14.5]
4. **Hardening proativo, não reativo.** Threat model + CSP enforce + rate limit universal antes da Fase 3 trazer admin. [v0.6 §3.3 Sessão 2.15.5]
5. **Cost modeling antes de escalar.** Sem dashboard de custo infra, você só descobre que perde dinheiro quando o investidor pergunta. [v0.6 §3.4 Sessão 3.11.5]
6. **MVP é UM pipeline, mas com sistema de créditos rodando.** Estúdio Quick com `analisar.video_ad` na Fase 1 (1 crédito). Os outros 11 pipelines do Estúdio ficam para Fase 2. Mas o sistema de créditos (allocate, consume, paywall) é Fase 1 obrigatória — sem ele o billing não fecha. Ver Parte 4 do v0.6.

7. **Cobrar pela capacidade real consumida.** Pipelines têm custos 15x diferentes (R$0,30 a R$5). Modelo flat "X análises" quebra a margem com power users. Sistema de créditos garante margem 70% mínima em qualquer cenário. Custos editáveis via /admin/pipelines sem deploy. Recalibração trimestral obrigatória. Detalhamento em v0.6 §4.16.

8. **Estratégia antes de copy.** Quando precisar escrever VSL, copy de email, prompt — primeiro o argumento, depois o texto. Mesmo princípio que aplicamos no negócio digital.

---

## Decisões de stack que diferem do v0.5

O v0.5 foi escrito antes de algumas ferramentas amadurecerem e antes de validarmos o modelo de negócio. Estas decisões substituem o que está no documento de arquitetura — quando houver conflito, este roadmap prevalece. **A versão atualizada da arquitetura é o `criation-io-arquitetura-v06.html`** que incorpora todas estas mudanças.

1. **Modelo de negócio: sistema de créditos (Parte 4 do v0.6).** O v0.5 implicava modelo flat "X análises por mês" que quebra com pipelines de custos 15x diferentes (Quick R$0,30 vs Modelar YouTube R$5). v0.6 formaliza sistema de créditos: cliente compra capacidade computacional, pipeline consome proporcional ao custo real. Margem 70% garantida em qualquer cenário de uso. Planos: Starter R$197 (150 créd), Pro R$497 (375 créd), Agency R$997 (750 créd). Trial: 50 créditos no signup, válidos 90 dias. Pacotes overage: 100/300/700 créditos.

2. **Background jobs: Trigger.dev v3, não Inngest.** Trigger.dev v3 (lançado fim de 2024) roda jobs em compute dedicado long-lived sem timeout serverless, é open-source (Apache 2.0) self-hostável, e custa $10/mês contra $75/mês do Inngest. Crítico para análises Claude longas, processamento de áudio, e `step.sleep 14d` da Sessão 3.1. SDK: `@trigger.dev/sdk`. Local dev server: `npx trigger.dev@latest dev`.

3. **Web analytics: só PostHog na Fase 1, Plausible adiado para Fase 4.** PostHog tem web analytics cookieless built-in desde 2024 — Plausible vira redundância de $9/mês. Reavaliar na Fase 4 só se houver razão concreta (ex: dashboard público de tráfego para parceiro/investidor, ou se o script PostHog impactar Lighthouse na landing apesar de lazy-load).

4. **FFmpeg: avaliar job no Trigger.dev v3 antes de Railway worker (Sessão 2.1).** Como Trigger.dev v3 roda em compute dedicado long-lived, FFmpeg pode rodar nativamente como task — eliminando o worker no Railway e simplificando a stack. Decisão final na 2.1 após validar limites de CPU/memória contra carga real (vídeos típicos de 60-180s em 1080p).

5. **Better Stack** (renomeado de Better Uptime em 2022) é o nome atual da ferramenta de uptime monitoring. URL: `betterstack.com/uptime`.

---

## Fase 0 — Pré-desenvolvimento

> _"O zero é onde o produto se ganha ou se perde. Atalho aqui custa 100x depois."_

**Duração:** ~1 semana (16-20h)
**Sessões:** 0.1 → 0.4
**Detalhe completo:** [v0.6 §3.1](./docs/criation-io-arquitetura-v06.html#p3-1)

### Objetivo

Ambiente pronto para desenvolvimento. Repositório com CI/CD, schema completo com RLS, auth setup, design system com tokens, e CLAUDE.md/AGENTS.md operacionais.

### Pré-requisitos (antes da Sessão 0.1)

- [ ] Contas criadas: GitHub, Vercel, Supabase, Anthropic API, Asaas, Stripe, Resend, Sentry, PostHog, Better Stack, Trigger.dev, Upstash, Browserless, Deepgram (lista completa no v0.6 §3.1)
- [ ] Domínio comprado e DNS apontado
- [ ] Antigravity IDE instalado e Claude Code CLI configurado
- [ ] MCPs configurados: Supabase, GitHub, Vercel ([v0.6 §3.6])
- [ ] Skill `frontend-design` ativa no Claude Code
- [ ] Cartão corporativo conectado (vai gastar ~R$200-400/mês de infra ao longo do desenvolvimento)
- [ ] **Validação manual de custos de pipeline** (antes da Sessão 0.2). Testar 1-2 análises reais de cada pipeline crítico (Quick, Deep, Modelar YouTube) via Anthropic API direto, medir custo real em USD, converter para BRL, comparar com a tabela de v0.6 §4.3. Se diff > 30%, ajustar `pipeline_costs.cost_credits` no seed da Sessão 0.2 antes de aplicar. Sem isso, a margem 70% começa errada.

### Definição de pronto

- [ ] `pnpm dev` roda local sem erro
- [ ] Deploy vazio em Vercel funciona, domínio resolve com SSL
- [ ] Migrations aplicadas no Supabase, RLS habilitada
- [ ] **5 tabelas de créditos criadas** com RLS e seed inicial: `credit_balances`, `credit_transactions`, `pipeline_costs` (com 7 pipelines), `credit_packages` (com 3 packs), `pack_purchases` (especificação em v0.6 §4.9)
- [ ] **3 colunas adicionadas** em tabelas existentes: `subscriptions.credits_per_cycle/current_cycle_*`, `analyses.pipeline_id/credits_consumed/credit_transaction_id`, `users.signup_ip_hash/user_agent_hash/fingerprint` (anti-fraude trial)
- [ ] Componentes base do design system renderizam em /design-system (rota interna)
- [ ] CI/CD: push → tests → build → deploy automático
- [ ] CLAUDE.md, AGENTS.md, README.md commitados
- [ ] Coverage threshold (70%) configurado no CI
- [ ] Logger estruturado com PII redaction funcionando
- [ ] Correlation ID via AsyncLocalStorage propagando

### Marco de validação

**Nenhum.** Fase técnica, sem usuário envolvido. Mas dois ganchos críticos: se a 0.4 deixou tokens "razoáveis mas não bonitos", pare e revise (design system é base para tudo na Fase 4 — economia de 2h aqui custa 20h depois). E confirme que `SELECT * FROM pipeline_costs` retorna os 7 pipelines com `cost_credits` calibrados (não os defaults se você descobriu na validação manual que estavam errados).

### Sessões

- [ ] **0.1** — Inicialização do repositório e deploy vazio (~4h) — [v0.6 §3.1]
- [ ] **0.2** — Schema inicial, RLS e auth setup (~6-8h) — [v0.6 §3.1]
- [ ] **0.3** — CLAUDE.md completo + AGENTS.md + Skills Bible (~3h) — [v0.6 §3.1]
- [ ] **0.4** — Design system e tokens (~3h) — [v0.6 §3.1]

### Riscos

- **Subestimar a 0.2.** Schema completo com RLS multi-tenant + envelope encryption + 30+ tabelas (incluindo as 5 novas de créditos) pode levar 8-10h, não 6. Não pule edge cases de RLS — bug de RLS = vazamento de dados entre tenants.
- **Pular validação manual de custos antes da 0.2.** Custo: 1-2h gastando ~R$10 em testes da API Anthropic. Benefício: descobrir AGORA se Modelar YouTube custa R$5 ou R$8 (50% de diferença). Custo de descobrir depois do launch: cliente Agency em margem negativa, repricing emergencial, churn por mudança de regras.
- **Pular CLAUDE.md (0.3) achando que é cosmético.** É o documento que ensina o Claude Code como NÃO alucinar arquitetura nas 60+ sessões seguintes. Sem ele, retrabalho garantido. Inclua na Sessão 0.3 a referência ao v0.6 (especialmente Parte 4 sobre créditos) — sem isso, o Claude Code vai gerar código com modelo flat antigo.
- **Tokens "ok" no 0.4.** Bonito agora vira premium na Fase 4. Feio agora vira refactor doloroso.

---

## Fase 1 — Core Value

> _"Um cliente paga R$197 e tem na mão o que veio buscar. Tudo que não contribui pra esse caminho não existe na Fase 1."_

**Duração:** ~5-6 semanas (~90-110h)
**Sessões:** 1.1 → 1.15 (23 sessões, incluindo intermediárias 1.4.5-1.4.9, 1.4.9.B, 1.4.9.C, 1.4.9.5, 1.7.5, 1.14.5)
**Detalhe completo:** [v0.6 §3.2](./docs/criation-io-arquitetura-v06.html#p3-2)

### Objetivo

Um cliente pagante completa o ciclo: signup → conectar Meta + Hotmart → **instalar o tracking script da Criation no site** → ver dashboard real com dados próprios (não só Meta API) → rodar primeira análise → ver resultado.

Cada palavra desse parágrafo é gate. Se signup tem fricção, voltamos. Se Meta OAuth quebra, voltamos. Se script Criation não dispara eventos, voltamos. Se análise demora 2 minutos, voltamos.

> **Modelo de tracking:** Criation funciona como CDP, não observador. Cliente substitui Pixel+GTM+Stape pelo nosso script único. Detalhes em [ADR-014](./docs/adr/ADR-014-criation-as-cdp.md).

### Pré-requisito

Fase 0 com todos os checkboxes marcados.

### Definição de pronto

**Auth e Shell**

- [ ] Signup com email + password, verificação por email, password reset
- [ ] Sessão persiste, logout funciona, cookie banner LGPD-compliant ativo (substituído por Consent Mode v2 na 1.14.5)
- [ ] Shell: sidebar accordion v5, topbar, command palette `Cmd+K` com 10+ ações

**Conexão de dados**

- [ ] OAuth Meta Ads conecta e mantém token vivo (refresh automático)
- [ ] sync-campaigns.job roda a cada hora, atualiza campanhas/ad sets/ads/insights
- [ ] Hotmart conecta via webhook, eventos de sale chegam validados (HMAC)
- [ ] Kiwify, Eduzz, Monetizze, Ticto adapters funcionam (mesmo padrão do Hotmart)
- [ ] UTM Stitcher: 3 estratégias (manual, fuzzy match, AI suggestion) operando, mapeamentos persistem

**Tracking server-side (CAPI)**

- [ ] Meta CAPI dispara Purchase com EMQ ≥ 7.0
- [ ] Google Enhanced Conversions disparado em paralelo
- [ ] Click IDs (fbclid, gclid, ttclid, msclkid) capturados em cookie first-party 90d
- [ ] Event ID dedup funcionando (sem dupla contagem com pixel client-side)
- [ ] AEM priority order configurado para Meta
- [ ] Domain verification ativa no Meta Business

**Onboarding**

- [ ] Wizard 7 passos completa em <5 min: criar workspace → conectar Meta → conectar gateway → mapear UTMs base → configurar CAPI → primeira campanha sincronizada → tour rápido

**Dashboard e Campanhas**

- [ ] Dashboard funil 8 etapas: impressão → click → checkout iniciado → checkout abandonado → checkout completo → pagamento confirmado → reembolso → assinatura ativa
- [ ] /campanhas: lista paginada, filtros (período, status, ad network)
- [ ] /campanhas/[id]: detalhe com criativos + comparativo A×B

**Estúdio Quick**

- [ ] `analisar.video_ad` (1 pipeline = 1 crédito) gera análise completa em <30s
- [ ] Preview de custo obrigatório antes do botão "Analisar": "Esta análise vai consumir 1 crédito. Saldo: 49 → 48"
- [ ] Botão "Analisar" bloqueia automaticamente se `creditService.checkBalance` retorna ok=false
- [ ] Página de resultado com 8 seções: hook, retenção, copy, CTA, edição, oferta, áudio, recomendações
- [ ] Footer da página de resultado: "Esta análise consumiu 1 crédito · Saldo restante: 48"
- [ ] Typewriter effect durante streaming
- [ ] Polling otimizado (2s queued/running, evento real quando pronto)
- [ ] Refund automático em caso de pipeline failure (créditos voltam pro balde original)

**Cobrança e sistema de créditos**

- [ ] `creditService` implementado: `checkBalance`, `consume`, `allocate`, `refund`, `expireBatch`, `getHistory` (v0.6 §4.10)
- [ ] Atomicidade comprovada: teste de race condition (múltiplas análises paralelas com saldo limítrofe não causam saldo negativo)
- [ ] billing.service abstrato funciona com Asaas (BR) e Stripe (internacional)
- [ ] Webhook idempotency (processed_webhook_events) impede duplo processamento
- [ ] Webhook de pagamento aciona `creditService.allocate` para subscription/pack com idempotency_key correta
- [ ] Checkout: Starter R$197 (150 créd), Pro R$497 (375 créd), Agency R$997 (750 créd) com upgrade in-product e prorate automático
- [ ] /comprar-creditos com 3 packs (100/300/700 créditos) funcionando — Asaas one-time charge ou Stripe charge
- [ ] Trial: signup aloca 50 créditos com validade 90 dias automaticamente
- [ ] Anti-fraude: captura de IP hash, user agent hash, fingerprint no signup; alerta se 3+ signups do mesmo IP em 24h
- [ ] Topbar do app sempre visível com saldo atualizado via Realtime ou SSE
- [ ] Modal de paywall ao tentar análise com saldo insuficiente, com lógica de recomendação (pack vs upgrade conforme uso projetado)
- [ ] Página /configuracoes/billing/historico com lista paginada de credit_transactions
- [ ] `credit-expiration.task` rodando diário em Trigger.dev v3 (renova ciclos de subscription, expira signup_bonus e packs)

**Compliance e qualidade**

- [ ] Consent Mode v2 ativo: 4 parâmetros granulares, LDU enforcement automático
- [ ] PII redaction validado em produção: `pnpm audit:pii` retorna zero hits
- [ ] consent_logs imutável para auditoria ANPD
- [ ] 3 fluxos E2E críticos passam no CI: signup→primeira análise, webhook→dashboard update, checkout→plan upgrade

### Marco de validação (gate para Fase 2)

**Antes de iniciar a Fase 2, valide:**

- [ ] **3 betas convidados** — você + 2 founders/infoprodutores conhecidos. Não use pesquisa fria; use rede pessoal pra ter feedback honesto.
- [ ] **Cada beta completou o ciclo end-to-end pelo menos 1x.** Se algum não conseguiu, debugue antes de seguir.
- [ ] **Pelo menos 1 análise por beta com retorno qualitativo positivo.** Pergunta direta: "Isso te ajudou a melhorar algo? O quê?"
- [ ] **Pelo menos 1 cliente pagante.** Pode ser você mesmo com cartão real assinando o Starter — força você a passar pelo checkout, paywall, billing real.
- [ ] **Tempo médio do ciclo ≤ 15 min.** Se demora mais, há fricção a remover.
- [ ] **Zero crash em produção nos últimos 7 dias.** Sentry como verdade.
- [ ] **Custo real do pipeline Quick medido** após 50+ execuções reais. Diff vs estimativa em pipeline_costs deve ser ≤ 30%. Se &gt; 30%, recalibrar `cost_credits` antes de Fase 2 (porque Fase 2 traz 11 pipelines a mais e o erro escala).
- [ ] **Saldo de créditos zerado pelo paywall ao menos 1 vez** (você ou um beta). Confirma que o circuit breaker funciona.

⚠️ **Se algum desses falhar, NÃO avance.** Algo no core value está quebrado. Volte e corrija.

### Sessões

#### Semana 1 — Foundation

- [x] **1.1** — Autenticação completa (~5h) — [v0.6 §3.2]
- [x] **1.2** — Shell do app: sidebar + topbar + command palette (~4h)
- [x] **1.3** — Conexão OAuth Meta Ads (~5h) — [v0.6 §3.2 + [ADR-013](./docs/adr/ADR-013-meta-platform-2026.md) + [audit Meta 2026-05](./docs/audits/META_API_2026-05.md)] ✅ entregue 2026-05-09: Marketing API v25, schema multi ad-account, Data Deletion Callback stub, refresh service (cron deferido pra 1.4 via TD-030), captura granted_scopes/businesses/verified_domains/pixels, sync action sem re-OAuth, picker inline pra default account
- [x] **1.4** — sync-campaigns.job + setup Trigger.dev v3 (~5h) — ✅ entregue 2026-05-09: trigger.config.ts, sync-campaigns task (cron 4h + on-demand), meta-token-refresh task (cron daily 03:00 UTC, fecha TD-030), campaign-sync.service com Promise.allSettled, paginacao Meta com limit 100, hook/hold rates calculadas, /campanhas funcional com tabela básica + sync button

#### Semanas 1-2 — Tracking & Atribuição

- [x] **1.4.5** — Gateway adapter base + Hotmart integration (~5h) — [v0.6 §3.2 + [ADR-016](./docs/adr/ADR-016-plataforma-hotmart.md) + [audit Hotmart 2026-05](./docs/audits/HOTMART_API_2026-05.md)] ✅ entregue 2026-05-09 (escopo MVP simplificado — só webhook, sem REST/backfill): `GatewayAdapter` interface + `NormalizedGatewayEvent` (template para 1.4.6/1.4.7), HotmartAdapter MVP (Postback v2 + v1 legacy parser, dual HOTTOK+HMAC validation), schema deltas aditivos aplicados em prod (`webhook_secret` plain cifrado + 18 colunas em gateway_events + nova tabela `gateway_subscriptions` + RLS), webhook endpoint `/api/webhooks/gateway/[provider]/[connection_id]` com dedup duplo (processed_webhook_events + gateway_events) e DLQ, Trigger.dev `process-gateway-event` (allocate via creditService quando há mapping em subscriptions, mark revoked em REFUNDED/CHARGEBACK), wizard UI **1 tela** em `/configuracoes/gateways/hotmart/connect` (só pede HOTTOK, gera URL na hora), helpers PII (hashEmail/hashPhone/hashDocument com normalização E.164), 28 testes Vitest cobrindo signature/parser/normalizer. **REST API/OAuth/backfill omitidos do MVP — reativar quando precisar de histórico ou MRR proativo (TD-040 + reativação do `fetchSalesHistory` no adapter).** Decisões abertas em TDs 040–048.
- [x] **1.4.6** — Kiwify adapter (~3h) — [v0.6 §3.2 + [ADR-017](./docs/adr/ADR-017-plataforma-kiwify.md) + [audit Kiwify 2026-05](./docs/audits/KIWIFY_API_2026-05.md)] ✅ entregue 2026-05-10: KiwifyAdapter MVP (signature tri-camada query string + header + body — sem HMAC, token plain comparison), parser Zod com passthrough generoso (Kiwify sem versionamento explícito), normalizer com PII inline-hash + 10 eventos mapeados (`compra_aprovada`/`subscription_renewed`/etc → canônicos), 4 novos `NormalizedEventType` (`SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_LATE`, `PIX_GENERATED`, `PURCHASE_REJECTED`), wizard UI 1 tela com **token UUIDv4 gerado pelo nosso lado** (UX defensiva contra "token123"), webhook URL com `?token=` embutido pra cliente colar direto no painel, `processGatewayEvent` switch estendido (SUBSCRIPTION_RENEWED reusa handlePurchaseApproved, novos no_op cases), 23 testes Vitest (signature 3-camada + parser + normalizer mapping). **Zero schema migration** — schema 1.4.5 cobre via `origin jsonb` + colunas existentes. **REST API/OAuth/backfill omitidos** (consistente com 1.4.5 MVP). Decisões abertas em TDs 049–054.
- [x] **sub-1.4** — Refactor `gateway_connections` → `connections` meta-tabela + hub UI central (~2h) — [ADR-019](./docs/adr/ADR-019-meta-tabela-connections.md) ✅ entregue 2026-05-10 (TD-070 antecipado): tabela renomeada via migration `0006_unify_connections.sql` (preserva 7 UUIDs em prod, zero reconfig de webhooks), nova coluna `type` discriminadora (gateway/crm/email/ad_network/analytics/helpdesk/communication) com UNIQUE parcial `(workspace, type, provider) WHERE deleted_at IS NULL`, query `listActiveConnections({workspaceId, type?, provider?})` com filtro de workspace (fix de segurança que vazava cross-workspace), hub central `/configuracoes/conexoes` redesenhado como cards compactos 3-col + Dialog centralizado (ConnectionsHub Client + descritores serializáveis do Server), entry "Gateways" removida do menu lateral, route antiga redireciona, BrandLogo placeholder colorido auto-promove pra SVG quando arquivo existir. Estrutura preparada para CRM/email/analytics futuros sem nova migração.
- [x] **1.4.7** — Eduzz adapter + Webhook genérico para long-tail (~3.5h) — [v0.6 §3.2 + [ADR-018](./docs/adr/ADR-018-plataforma-eduzz-e-webhook-generico.md) + [audit Eduzz 2026-05](./docs/audits/EDUZZ_API_2026-05.md)] ✅ entregue 2026-05-10 (escopo revisado pós-decisão estratégica): EduzzAdapter MVP (HMAC-SHA256 single-layer no header `x-signature`, parser do envelope v3 `{id, event, data, sentDate}`, normalizer mapping de 7 invoice events + contract_card_attempted + sun.cart_abandoned, mapping desambigua PIX vs boleto via paymentMethod), 21 testes Vitest. **Webhook genérico** `/api/webhooks/generic/[connection_id]` aceita shape canônico para long-tail (Monetizze/Ticto/Cakto/Greenn/Yampi/etc) via Make/n8n/Zapier — auth dual (header `x-criation-token` plain ou `x-criation-signature` HMAC-SHA256 opcional), provider tag `generic:<source>` quando source declarado, PII hashing inline server-side. Wizard UI 1 tela + select de plataforma de origem + sample payload pra cliente colar no Make/n8n. **Monetizze e Ticto não têm adapter nativo** — recomendação: usar webhook genérico com flow Make/n8n. TDs 060–067 documentam: REST API client Eduzz (backfill), adapters nativos Monetizze/Ticto/Cakto se beta pedir, templates Make/n8n curados, HMAC opcional no genérico, monitor de signing key Eduzz expirada.
- [x] **1.4.8** — UTM Stitcher service (~5h) — [v0.6 §1.4.8 + [ADR-020](./docs/adr/ADR-020-utm-stitcher-1.4.8.md)] ✅ entregue 2026-05-10 (escopo MVP — Perfect+Manual, fuzzy/partial em TD-082): cascata Manual→Perfect→Meta-literal→Unmatched, normalizador puro com strip diacritics + `unaccent` SQL extension (case/separator/acentos agnostic), Trigger.dev v3 task `stitch-gateway-event` enfileirada paralela ao billing (independente, falha em um não bloqueia o outro), schema deltas zero-downtime em `gateway_events` (match*strategy, matched*\*, confidence, stitched_at) + `campaigns` aggregates (revenue_30d/total, attributed_orders_count, roas_real, last_stitched_at) via migration manual (drizzle-kit não auto-gera pós-rename connections), 22 novos testes Vitest (14 normalizer + 8 stitcher mockado, total 166), CRUD de utm_mappings com Server Actions + UI em `/configuracoes/utm-mappings`, smoke E2E real validado (case+separator differ → perfect match com confidence 1.0, aggregates incrementam atômico). **Bonus:** `public/criation-tracking.js` (~250 linhas ES5) que cliente cola na head — captura UTMs URL+referrer+cookie, persiste 90d em cookie first-party `_cio_utms`, link enrichment seletivo (Hotmart/Kiwify/Eduzz/Monetizze/Ticto/Cakto/Greenn/Yampi + atributo `data-criation-checkout` pra checkout custom), suporta SPA via pushState. TDs 080–085 documentam: backfill (re-stitch eventos antigos), job dedicado de aggregates (quando lock contention), fuzzy match Jaro-Winkler (1.4.B), detector de UTM literal `{{ad.name}}` com alerta UX, checkout custom inteligente, integração com 1.4.B Visitor↔Buyer.
- [x] **1.4.A** — Criation tracking script + ingestion endpoint (~12h efetivos vs 6h estimado) — [ADR-014](./docs/adr/ADR-014-criation-as-cdp.md) ✅ entregue 2026-05-12 (10 sub-tasks + auditoria + UX revamp): **Camada de captura turnkey** — substitui Pixel+GTM+Stape. **Backend:** migration 0009 (`tracking_events` particionada mensal via RANGE event_ts + 3 partições rolling, `tracking_visitors` flat, RLS workspace-scoped, 8 indexes incluindo partial pra fanout pending), endpoint `POST /api/v1/track` (CORS preflight + rate limit 600/min + origin allowlist time-limited com grace period 7d + persist sync <100ms target + Trigger.dev enqueue async), `tracking.service` (Zod permissivo `.loose()`, PII hashing SHA-256 email + HMAC-salt IP/UA, `validateOrigin` 3 modos), 2 Trigger.dev tasks (`process-tracking-event` async upsert visitor com COALESCE preservando first-touch + `create-tracking-partition` daily 03:00 UTC cria M+3 com rollover Dez→Jan). **Frontend:** `criation-tracking.js` v2.0 (ES5 hand-rolled, 5.5KB gzipped — visitor_id UUIDv4 cookie `_cio_vid` 90d, page_view auto + SPA support, scroll milestones 25/50/75/100, click `[data-criation-event]`, form_submit, `window.criation(track|identify|debug)` API, pre-init queue estilo gtag, Consent Mode v2 read-only, sendBeacon + fetch keepalive fallback, error boundary `safely()` swallow, dedup link enrichment). **UX:** card "Tracking Criation" no hub `/configuracoes/conexoes` + página `/configuracoes/tracking-script` (snippet com workspace_id embutido, status live, origin allowlist CRUD, eventos recentes debug, exemplos custom events) + nova rota `/tracking` (visão geral CDP: 4 stat cards + pipeline 4 etapas com status real "Captura→Atribuição→Reconciliação→Fanout" + tabela últimos 10 eventos). **IA do menu lateral revamp:** 5 grupos coerentes (Principal/Tracking/Integrações/Conta), CDP badge no grupo Tracking, active state com lateral bar, items placeholder marcados "EM BREVE", MobileNav consistente. **Auditoria + 19 fixes aplicados:** A1 grace period time-limited, A2 `encryptedCredentials` nullable (migration 0010), B1 MobileNav unified, B2 Workspace page real, B3 `window.__cioWorkspaceId` fallback, B4 error boundary script, B5 dedup link enrichment, B6 partition pruning queries, B7 origin regex relaxed (aceita localhost+IPv4), C1 "EM BREVE" visual + opacity-60, C2 attribution status real (query count utm_mappings + matched gateway_events), C3 `tracking/error.tsx`, C4 stat card tone `danger` com CTA inline, C5 a11y (caption sr-only, th scope, aria-live, aria-current, dl/dt/dd). **Tests:** 36 novos Vitest (validator schema + helpers service) — total 202 passando. **Smoke E2E manual documentado** em `docs/smoke/1.4.A-tracking-cdp.md` (13 cenários). TDs novos 094-100 documentados em `docs/tech-debt.md` (workspace_id poisoning longer-term + Vary header + SLA cold start + script rename anti-adblock + Sentry browser + build/minify step + domain ownership verification).
- [x] **1.4.B** — Visitor↔Buyer matching + UTM Stitcher 2.0 (~3h entrega + 2h audit fixes vs 4h estimado) ✅ entregue 2026-05-12 + auditoria pos-entrega no mesmo dia: **Cascata visitor matching** (4 estratégias com confidence decrescente — `deterministic_xcode` 1.0 quando `gateway_events.externalCode === tracking_visitors.visitorId` via link enrichment do `criation-tracking.js` (com validação UUID v4 estrita pos-audit), `clickid` 0.9 com lookback 7d cruzando fbclid/gclid/ttclid no gateway com `tracking_visitors.first/lastClickId` filtrado por tipo (estratégia DORMENTE até TD-105 — adapters não extraem fbclid hoje), `utm_recency` 0.7 com lookback 24h por `utm_campaign` com log explícito de conflitos, `reverse_email` 0.85 disparado por `criation('identify', email)` com OVERRIDE de eventos `unmatched` — caso de uso primário). **Schema deltas:** migration `0011_visitor_buyer_matching.sql` adiciona em `gateway_events`: `matched_visitor_id` (soft FK), `visitor_match_strategy`, `visitor_match_confidence numeric(5,4)`, `visitor_matched_at` + 3 índices parciais (matched visitors, pending matches, customer_email pra reverse). **Update bidirecional ao matchear:** `gateway_events` (matched + strategy + confidence + ts), `tracking_visitors.identified_buyer_email_hash` (sticky via COALESCE), `tracking_events.matched_buyer_email_hash` retroativo (todos eventos do visitor — fanout 1.4.9 ganha EMQ alto em PageViews históricos). **UTM Stitcher 2.0 — visitor-aware:** nova estratégia `visitor` (confidence 0.95) inserida na cascata entre Manual e Meta literal — quando matcher achou visitor, usa first/last UTMs do `tracking_visitors` pra resolver campaign mesmo se `gateway_events.utm_campaign` veio vazio ou com `{{ad.name}}` literal (fix automático pra TD-083). Cascata final: Manual → Visitor → Meta literal → Perfect (UTM gateway) → Unmatched. **Reverse matching:** `process-tracking-event.ts` agora dispara `matchGatewayEventsForIdentifiedVisitor` quando `criation('identify', email)` chega no browser — busca `gateway_events` recentes (30d) do mesmo email_hash e cria o link retroativo (caso comum: cliente compra primeiro via Hotmart, depois acessa lead magnet onde identify roda). **Trigger.dev:** `stitch-gateway-event` task agora chama `matchVisitorForGatewayEvent` ANTES do stitcher (mesma task, ordem importa). **Idempotência:** `gateway_events.visitor_matched_at` + `stitched_at` checados em ambos paths; re-run safe. **Tests:** 17 novos Vitest (10 matcher service incluindo cascata + idempotência + precedência xcode>clickid>utm; 7 stitcher 2.0 incluindo fallback first-touch + fix TD-083 + manual precedence) — total **219 passando**. **Smoke E2E manual** documentado em `docs/smoke/1.4.B-visitor-buyer-matching.md` (não executado em prod ainda).
- [x] **1.4.9** — Meta CAPI fanout (Meta-only) (~7-8h entrega + 2h audit pos-entrega vs 6-8h estimado) ✅ entregue 2026-05-12 (12 steps em 7 commits: `68be223..289bdd3`) + **audit pos-1.4.9 mesmo dia** (2 commits adicionais: `cdec0ae` + `be55bf8`). **Resultado:** pipeline end-to-end Meta CAPI funcional — `browser → /api/v1/track → tracking_events → process-tracking-event → fanout-meta-capi → Meta CAPI v25.0` com cron defensivo `*/10min` + retro re-fanout pós-matcher. **Entregas:** (1) `criation-tracking.js` v2.1 gera `_fbp`/`_fbc` quando Pixel ausente; (2) `capi_events` particionada mensal por event_time + 18 colunas Meta P1 + RLS retroativo nas partition filhas (migration 0013/0014 aplicadas em prod); (3) `capi/hashing.ts` com 9 normalizers + `hashForMeta`/`hashForGoogle` namespaces (67 testes); (4) `capi/dedup.ts` event_id determinístico cross-channel (11 testes); (5) plain IP/UA migration 0015 + adapter updates Hotmart/Kiwify/Eduzz/generic + TD-108 retention 30d (6 testes adapters); (6) `capi/meta.adapter.ts` builder Meta CAPI v25.0 com consent gating (`ad_storage=denied`→skip, `ad_user_data=denied`→LDU), external_id pre/post-match, CTWA, action_source, event_name mapping Criation→Meta canonical, value/currency/order_id do gateway (23 testes); (7) `capi.service.ts` orquestrador (load+decrypt+build+POST+persist + retry classification, 9 testes); (8) `fanout-meta-capi.ts` Trigger.dev v3 task + cron defensivo pickup `*/10min` (sweep tracking_events pending >5min); (9) wiring inicial em `process-tracking-event` + retro re-fanout (50 events cap, status NOT 'sent' filter pra evitar Meta dedup waste); (10) wizard `/configuracoes/meta/eventos` com status + modo teste + top eventos 7d; (11) `/tracking` aba Fanout com stats reais + tabela últimos 10 capi_events; (12) pino redact paths PII (hashed + plain + Meta payload deep paths, 7 testes). **Audit pos-1.4.9 (mesmo dia):** 2 bugs P0 corrigidos antes de ir pra prod — `MAX_FANOUT_ATTEMPTS=10` cap previne loop infinito cron→trigger→cron; `events_received=0` da Meta agora classifica como `failed retry=false` (antes marcava `sent` silenciosamente). 4 P1 fechados: TD-107 phone normalizer unificado em `security/hash.ts` (preserva `+` original, fix global pra Hotmart/Kiwify/Eduzz adapters), rate-limit per workspace no cron (`row_number() PARTITION BY` cap 20/workspace), wizard `trim()` em disabled state, retro re-fanout filtrado. 4 P2 fechados: type-unsafe casts removidos (Zod schemas typed), Hotmart `.passthrough()`, `getActiveMetaConnection` filtra `deletedAt`, `REDACT_PATHS` exportado. 2 P3 fechados: `/tracking` `revalidate=60`, audit log em `updateMetaTestEventCode`, `idempotencyKey` previne triggers paralelos. **5 TDs documentados:** TD-108 LGPD retention 30d (bloqueio pré-cliente real), TD-109 pure gateway fanout (Fase 2), TD-110 EMQ baseline via Dataset Quality API (2.4.5), TD-111 CTWA payload validation (1.4.9.5), TD-112 stats single-query optimization (defer). **Total suite: 351 passando** (was 219 antes da sessão). **Ação operacional pendente:** `pnpm trigger deploy` pra ativar tasks em prod. **Pós:** 1.4.9.B implementa Google EC; 1.4.9.C cleanup `click_id_store` legacy; 1.4.9.5 valida o conjunto em prod real.

<details><summary>Spec original completa</summary>

**Crítico** — [ADR-013](./docs/adr/ADR-013-meta-platform-2026.md) + [ADR-014](./docs/adr/ADR-014-criation-as-cdp.md) + [audit Meta 2026-05](./docs/audits/META_API_2026-05.md). **Escopo:** fanout server-side só pra Meta CAPI; Google EC vai pra 1.4.9.B (dividido pelo mapeamento arquitetural — escopo original "Meta + Google" não cabia em 5h e Google não tem OAuth ainda). **Schema deltas:** `capi_events` ganha colunas Meta P1 (`event_source_url`, `action_source`, `client_ip_address inet`, `client_user_agent`, `fbc`, `fbp`, `external_id_hash`, `data_processing_options jsonb + _country + _state`, `opt_out`, `pixel_id`, `partner_agent`, `test_event_code`, `attribution_window`, `dedup_status`, `messaging_channel`, `ctwa_clid`) + particionamento mensal por `event_time`. **Services novos:** `capi.service.ts` (orquestrador — lê `tracking_events.fanout_meta_status='pending'`, enfileira), `capi/meta.adapter.ts` (builder payload CAPI v25.0 — user_data com em/ph/fbp/fbc/external_id_hash/IP/UA, custom_data com value/currency/order_id, LDU country=0/state=0), `capi/hashing.ts` (SHA-256 lowercase trim + normalização Meta-spec — **test suite dedicado** porque é bug-prone), `capi/dedup.ts` (event_id determinístico cross-channel). **Trigger.dev:** `fanout-meta-capi.ts` (task por evento, retry/backoff/DLQ nativo, atualiza `tracking_events.fanout_meta_status`/`_sent_at`/`_error`), cron pickup defensivo varre pending >5min, **`process-tracking-event` estendido** pra enfileirar re-fanout retroativo (últimos 7d) quando matcher 1.4.B popula `matched_buyer_email_hash`. **Fix crítico `criation-tracking.js` (GAP descoberto no mapeamento):** script hoje lê `_fbp`/`_fbc` cookies do browser mas **não gera quando ausentes** — cliente sem Pixel = `fbp` vazio em 100% dos eventos = EMQ degradado. Adicionar: gerar `_fbp=fb.1.{ts}.{random}` quando ausente; setar `_fbc=fb.1.{ts}.{fbclid}` quando há fbclid na URL. **UI:** wizard CAPI Meta novo em `/configuracoes/meta/eventos` ("Configure eventos de conversão" sem cap de 8 — AEM ilimitado desde jun/2025), pixel picker (cliente pode ter múltiplos), test_event_code toggle (modo teste antes de produção), `/tracking` aba Fanout expandida com % enviado Meta + EMQ baseline + erros recentes. **Policy decisions documentadas:** `opt_out=true` quando `consent_state.ad_storage='denied'` (mas **não enviar request** — LDU é fallback EEA-like); `external_id_hash` pré-match = `sha256(workspace_id + visitor_id)`, pós-match troca pra `sha256(workspace_id + matched_buyer_email_hash)` e re-fanout retroativo; `action_source='website'` default, `business_messaging` quando `ctwa_clid` presente. **Rate limiting:** ~2000 calls/h por ad_account (Trigger.dev concurrency limit), batch até 1000 events/request quando fila >100. **PII redaction:** pino redact paths `user_data.em`, `user_data.ph`, `user_data.fn`, `user_data.ln`, `user_data.ge`, `user_data.db`, `user_data.ct`, `user_data.st`, `user_data.zp` **antes** do logger ver payload. **Pós:** 1.4.9.B implementa Google EC; 1.4.9.C cleanup schema legacy; 1.4.9.5 valida o conjunto em prod.

</details>

- [x] **1.4.9.B** — Google EC fanout via **Data Manager API** + OAuth Google antecipado (~7-8h entrega + 1h audit pos-entrega vs 6-8h estimado) ✅ entregue 2026-05-15 (13 steps em 11 commits + 2 commits infra + 2 commits audit fixes: `fdb6be3..9772b28`) + **audit pos-1.4.9.B mesmo dia** (2 commits adicionais: `e6e90f2` + `9772b28`). **Resultado:** pipeline end-to-end Google EC funcional — `browser → /api/v1/track → tracking_events → process-tracking-event → fanout-google-data-manager → Data Manager API v1` com cron defensivo `*/10min` + retro re-fanout pós-matcher + cron diário `google-token-refresh` (03:30 UTC) detectando `invalid_grant`. **Entregas:** (1) ADR-015 spike Data Manager API vs ConversionUploadService; (2) schema deltas migration 0016 (`google_connections` + `google_ads_accounts` 1:N + `google_conversion_action_mappings`); (3) `hashForGoogleDataManager` namespace + 21 testes; (4) OAuth flow PKCE + 6 scopes na MESMA consent screen + callback `/api/oauth/google/callback`; (5) REST client Google Ads metadata (`listAccessibleCustomers` + `getCustomerSelf` + `listManagedCustomers` + `listConversionActions`); (6) `capi/google.adapter.ts` builder Data Manager API events:ingest com 18 testes — `destinations.operatingAccount.accountId/productDestinationId`, `events.adIdentifiers.gclid|gbraid|wbraid` fallback ladder, `userData.userIdentifiers[].emailAddress|phoneNumber|address` SHA-256 hex, `consent.adUserData|adPersonalization`, `transactionId` cross-channel dedup, `validateOnly` test mode; (7) `capi/google.service.ts` orquestrador (load+decrypt+build+POST+persist + retry classification + MAX_FANOUT_ATTEMPTS=10 + refresh inline 5min buffer); (8) `fanout-google-data-manager.ts` Trigger.dev v3 task + cron pickup `*/10min` (sweep tracking_events pending >5min, cap 20/workspace); (9) wiring em `process-tracking-event` (Meta + Google initial fanout paralelo + retro re-fanout per-provider); (10) wizard `/configuracoes/google/conversoes` (StatusBlock + multi-customer AccountPicker + MappingsBlock 11 event names × conversion actions dropdown + TestModeBlock); (11) `/tracking` aba Google com stats reais + tabela últimos 10 capi_events; (12) `google-token-refresh` task + cron diário 03:30 UTC + `refreshGoogleAndValidate` detectando `invalid_grant`; (13) pino redact paths Google Data Manager (`events[*].userData.userIdentifiers[*].{emailAddress,phoneNumber,address.*}` + `events[*].adIdentifiers.{gclid,gbraid,wbraid}` + variantes wildcard, +2 testes). **Infra entregue:** `syncEnvVars` extension empurra 17 env vars do `.env.local` pro Trigger.dev cloud no `pnpm trigger:deploy`; `SKIP_ENV_VALIDATION` fallback no `trigger.config.ts` viabiliza indexer dentro do build container sem `.env.local`; deploy v20260515.6 ativo em prod env do Trigger.dev cloud com 15 tasks (Meta + Google + processo + tokens + cron). **Audit pos-1.4.9.B (mesmo dia):** 0 P0, 4 P1 corrigidos: (1) `listRetroFanoutCandidates` parametrizado por provider — antes filtrava só `fanout_meta_status` excluindo Google retro quando Meta já 'sent'; (2) `ensureFreshAccessToken` detecta `invalid_grant` inline + marca connection `expired` imediato (antes queimava 24h até cron descobrir); (3) `getActiveGoogleConnectionByWorkspace` filtra `status='active'` (bug idêntico Meta P1 #13 cdec0ae); (4) audit logs nas 4 Server Actions Google (paridade com Meta `updateMetaTestEventCode`). 4 P2 hygiene fixados: remove casts redundantes `as unknown as Record` em `persistCapiEvent`, early-exit no `toggleGoogleTestMode` quando estado já igual, `softDeleteMapping` filtra `workspaceId` (belt-and-suspenders), wizard `export const revalidate = 60`. 1 P3 fixado: `ClickIdResult` vira discriminated union narrowing automatic. **7 TDs documentados:** TD-113 streetAddress/addressLine drift, TD-114 persistSkippedCapiEvent Google fields, TD-115 refresh_token rotation, TD-116 race cron+inline refresh, TD-117 ghost `is_default` em soft-deleted accounts, TD-118 CTA "Reconectar Google" wizard, TD-119 email notification "conexão expirou". **Total suite: 392 passando** (was 351 antes da sessão; +41 testes Google hashing+adapter+redact). **Bloqueios externos pendentes pra cliente real:** OAuth verification submission (2-6 semanas Google review), Developer Token Basic access (1-2 dias úteis), domínio `criation.io` verificado em Search Console, `/privacy` + `/terms` reais. **Pós:** 1.4.9.5 valida o conjunto 1.4.8 + 1.4.9 + 1.4.9.B em prod real. + [audit Google 2026-05](./docs/audits/GOOGLE_API_2026-05.md). **Por que antecipa parte de 2.10:** ADR-014 promete fanout multi-platform desde Fase 1; sem token Google não dá pra enviar pra Google. **Spike concluído 2026-05-13** → decisão Data Manager API (ADR-015): (a) Google explicitamente "doesn't recommend implementing new offline conversion workflows using the Google Ads API"; (b) restrição de 2-fev-2026 já em vigor afeta a Criation como new developer (`CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE` para session_attributes + IP); (c) Customer Match Fase 3 obrigatoriamente usa Data Manager API (`UserDataService` deprecando 1-abr-2026 pra tokens novos); (d) GA4 fanout 2.10.5 reusa mesma API via `destinations[]` array. **Endpoint canônico:** `POST https://datamanager.googleapis.com/v1/events:ingest` (Data Manager API v1, GA out/2025, v1.6 atual de 2026-05-07). **Schema deltas (revisados pós-ADR-015):** `google_connections` ganha `grantedScopes jsonb`, `granted_data_manager_scope boolean`, `granted_ads_scope boolean`, `managerCustomerId`, `loginCustomerIdHeader`, `adsApiVersion default 'v24'`, `dataManagerApiVersion default 'v1'`, `oauthClientVerificationStatus`, `googleUserId/Email/Name`, `lastTokenRefreshAt`, `tokenRefreshFailures`, `refreshTokenInvalidatedAt`, `partnerAgent`, `testAccountFlag`. **REMOVIDO vs audit original:** `developer_token_tier` (Data Manager API não usa). `customer_id`/`customer_name` ficam `@deprecated`. **Tabelas novas:** `google_ads_accounts` (1:N de `google_connections` — multi-customer Agency); `google_conversion_action_mappings` (workspace + ad_account + internal_event_name → **`product_destination_id`** — renomeado de `conversion_action_resource_name` por vocabulário Data Manager API — **sem isso, fanout falha 100%**). `tracking_events` ganha `gad_source` + `srsltid` (audit §3). `capi_events` ganha colunas Google-specific revisadas: `google_customer_id`, `google_product_destination_id` (renomeado), `google_click_id_used`, `google_click_id_type`, `google_user_identifiers_count`, `google_consent_ad_user_data`, `google_consent_ad_personalization`, `google_order_id`, `google_request_id` (NOVO — `requestId` retorno Data Manager API), `google_validate_only boolean` (NOVO — flag modo teste). **OAuth Google flow:** Server Action `connectGoogle`, callback `/api/auth/google/callback` (state + PKCE), scopes pedidos na MESMA consent screen: `https://www.googleapis.com/auth/datamanager` + `https://www.googleapis.com/auth/adwords` + `https://www.googleapis.com/auth/cloud-platform` (todos sensitive — verification mandatória, submit em paralelo, timeline 2-6 semanas). **Metadata (descoberta de contas + conversion actions):** Google Ads API REST `v24` (Data Manager API não tem esses endpoints) — `customers:listAccessibleCustomers` + per customer `SELECT customer_client...FROM customer_client` + `SELECT conversion_action...FROM conversion_action WHERE status='ENABLED'`. Persistir em `google_ads_accounts` + `conversion_actions jsonb`. **Developer Token Basic** aplicado **só para Google Ads API REST metadata** (não está no hot path do fanout) — quota 15k/dia mais que suficiente. **Service:** `capi/google.adapter.ts` — builder payload Data Manager API `events:ingest` (`destinations[].operatingAccount.accountId` (customer_id) + `destinations[].productDestinationId` (conversion_action_id) + `events[].adIdentifiers.gclid|gbraid|wbraid` (fallback ladder) + `events[].userData.userIdentifiers[].emailAddress|phoneNumber|address` hashed SHA-256 hex + `events[].consent.adUserData|adPersonalization` (`CONSENT_GRANTED|CONSENT_DENIED|CONSENT_UNSPECIFIED`) + `events[].transactionId` (= event_id Criation = mesmo do Meta CAPI 1.4.9) + `events[].eventSource: 'WEB'` + `events[].conversionValue` + `events[].currency` + `events[].eventTimestamp` RFC 3339 + `validateOnly` no body do request quando wizard em modo teste). **Trigger.dev:** **`fanout-google-data-manager.ts`** (renomeado de `fanout-google-ads.ts` por ADR-015 — reflete o endpoint real). Batch até 2000 events/request. Concurrency limit per workspace (não global — sem developer token gargalo). **UI:** wizard Conversion Action mapping em `/configuracoes/google/conversoes` (CRUD `google_conversion_action_mappings`), multi-customer picker pós-OAuth, toggle **modo teste = `validateOnly: true`** (equivalente Meta `test_event_code`). **Token refresh:** estender `token-refresh.service.ts` pra `google_connections` (job 1x/24h — refresh tokens Google não expiram por tempo mas detectam `invalid_grant` cedo). **PII hashing:** reusar `capi/hashing.ts` da 1.4.9. Adicionar `hashForGoogleDataManager` namespace (Google Data Manager pede SHA-256 hex ou base64 — confirmar `encoding: 'HEX'` no payload + lowercase trim + strip diacritics no nome). **Cross-platform dedup:** mesmo `event_id` Criation enviado como `transactionId` pra Data Manager API + `eventID` pra Meta CAPI + (cliente client-side) `transaction_id` no Google Tag — Google dedupa atualizando value, Meta dedupa filtrando.

- [x] **1.4.9.C** — Cleanup tabela legacy `click_id_store` (~20min vs ~30min estimado) ✅ entregue 2026-05-15 (1 commit: `22dfbf5`). **Resultado:** schema estável antes da 1.4.9.5 — dead schema (vetor de drift) eliminado. **Pre-drop validation:** grep `src/` confirmou zero writers, zero readers; `SELECT count(*) FROM click_id_store` em prod retornou 0 rows + `last_insert = null` (tabela nunca recebeu INSERT). **Migration 0017_drop_click_id_store.sql** aplicada em prod via mcp supabase (drop 4 indexes + drop table). Code: removida declaração `clickIdStore` em `src/lib/db/schema/tracking.ts` (28 linhas), removido `ClickId` type re-export em `src/lib/db/schema/index.ts`, removidas RLS policy + ENABLE em `src/lib/db/rls.sql`. Single-PR (regra 16 só aplica com dual-write ativo, não era o caso). Typecheck ok, suite 392/392.

- [ ] **1.4.9.5** — Shadow validation end-to-end em prod real (~8-10h trabalho ativo + 5-7d wait calendar) 🔴 **bloqueada por OAuth Google rework de vídeo demo** (pediu refilmagem 2026-05-28; Vinicius escolheu adiar — Trilha B desenvolver primeiro). Roadmap original tinha gate antes de 1.6, mas 1.5/1.6 entregues sem essa validação porque cliente alpha = Vinicius e dado real ainda não conectado. Reativar quando OAuth aprovar + cliente real disponível. **Motivo:** subsistema de tracking (1.4.A captura + 1.4.B matcheia + 1.4.8 atribui + 1.4.9 envia Meta + 1.4.9.B envia Google + 1.4.9.C schema limpo) está **feature-complete** neste ponto. Até aqui validado contra fixtures sintéticas (testes Vitest + smoke E2E manuais por sessão). Bugs reais (iOS Safari ITP, conflito com pixel/GTM pré-existente do cliente, encoding pt-BR em payload Hotmart prod, UTM `{{ad.name}}` literal em campanhas Meta com 5+ anos de naming caótico, EMQ baixo por hash format errado, dedup com pixel do cliente quebrado por event_id divergente, LDU flag não respeitando Consent state, Google Conversion Action mapping errado, MCC `login-customer-id` header faltando) só aparecem com dado real. **Última janela barata antes de 1.6/1.7 exporem o dado ao cliente** — matcher com falso positivo faz cliente ver venda atribuída à campanha errada no dashboard e perder confiança em 5min. Bug interno é barato; bug visível ao cliente é caro. Esta sessão valida **o conjunto 1.4.8 (UTM Stitcher) + 1.4.9 (Meta CAPI) + 1.4.9.B (Google EC) em prod**, não em isolado. **Setup (sequencial):** (1) deploy staging com domínio próprio + HTTPS estável (Vercel `gru1`) servindo `criation-tracking.js` via CDN; (2) snippet instalado em 1 landing real (site da AGC ou cliente amigo alpha); (3) 1 conexão Hotmart **prod** ativa (opcional Kiwify/Eduzz); (4) Meta ads **e Google Ads** ativos R$200-500 cada com convenção UTM correta apontando pra landing instrumentada; (5) consent banner mínimo pra Consent Mode v2 read funcionar; (6) Meta Events Manager + Test Events configurados pra ler EMQ shadow; (7) Google Ads conversion actions com Enhanced Conversions habilitado em modo teste. **Camada 1 — captura (1.4.A + fix fbp/fbc da 1.4.9):** script carrega sem conflito com pixel/GTM, ITP Safari iOS não quebra cookie `_cio_vid`, Consent Mode v2 read funciona, eventos chegam no volume esperado, partição mensal `tracking_events` aguenta, rate limit 600/min não estoura, **`_fbp` gerado quando ausente** (validação do fix da 1.4.9), **`_fbc` setado quando fbclid presente**. **Camada 2 — matching (1.4.B):** visitor↔buyer dispara em venda real, reverse matching via `identify` funciona em fluxo lead magnet→compra, sem falsos positivos cross-workspace (RLS aguenta tráfego real), `matched_buyer_email_hash` retroativo populado nos `tracking_events` históricos. **Camada 3 — atribuição (1.4.8):** stitcher matcheia campanhas Meta+Google reais (não fixture), TD-083 (`{{ad.name}}` literal) resolvido automaticamente, aggregates em `campaigns` incrementam atomic sem race, [PRE-PROD-VALIDATION-1.4.8.md](./docs/checklists/PRE-PROD-VALIDATION-1.4.8.md) executado com dado real. **Camada 4 — fanout Meta (1.4.9):** **EMQ baseline ≥7 no Events Manager** após 7d, event_id dedup com pixel cliente confirmado (sem double-count em Events Manager → Diagnostics), hash format conforme spec Meta (SHA-256 lowercase trim), `action_source` correto por evento type, LDU respeita Consent state, fbp/fbc presentes em ≥80% dos eventos (validação do fix do script), `capi_events` log preserva payload + response code. **Camada 5 — fanout Google (1.4.9.B):** **Google EC match rate ≥60%** no conversions report, header `login-customer-id` correto em MCC, `conversion_action_resource_name` mapeia corretamente por evento, gclid OR wbraid OR gbraid fallback funciona, consent field `ad_user_data`/`ad_personalization` propagado de `tracking_events.consent_state`, decisão Data Manager API validada (ou refactor flaggado se a API canônica mudou). **Compliance:** TD-104 LGPD erasure path simulado com titular request real (visitor + buyer + capi_events apagados sem residual). **Entregáveis:** `docs/smoke/1.4.9.5-shadow-validation-e2e.md` documentando cenários executados por camada, bugs encontrados (severidade P0/P1/P2), fixes aplicados, **EMQ baseline Meta + Google EC match rate** (números reais, não suposição), novos TDs abertos. **Definição de pronto:** zero P0 nas 5 camadas; EMQ Meta ≥7 (com 7d de dado); Google EC match rate ≥60%; GATE 1.4.8 + TD-104 verdes com dado prod; decisão escrita go/no-go pra 1.6 com lista do que mudou (ou não) na especificação do dashboard baseado no que o dado real revelou.
- [x] **1.5** — Onboarding wizard + alocação de 50 créditos signup_bonus (~10h efetivo vs 4h estimado) ✅ entregue 2026-05-28 (commit `1ededa3`). **Restruct mid-sessão** após feedback UX: 7 passos → **3 estágios** (perfil + credits page + tour interativo no dashboard). **Form perfil revamped** com gateways multi-select (8 opções incluindo "Outro"/"Nenhum") + faturamento mensal 5 buckets (<100k → >5M) + investimento ads 5 buckets (<10k → >300k). **Credits page** celebratória com saldo + CTA enterPlatform. **Tour interativo** via react-joyride 3.x com tooltip custom glassmorphism theme-aware + 12 stops (sidebar nav 10 items + topbar notifications + profile). **Middleware gate** via cookie `criation_onboarding_done` + whitelist `/configuracoes/gateways/*/connect` durante onboarding. **Schema deltas**: `users.profile_context jsonb` (0019) + enum `users.onboarding_step` reduzido pra `('perfil', 'credits', 'completed')` (0020) + `users.tour_completed_at timestamptz` (0021). **TD-013 fechado** — welcome email migrado pra Trigger.dev `send-welcome-email` task com retry 5x backoff exponencial. **TD-018 fechado** — anti-fraude burst extraído como helper `detectSignupBurst` + 7 testes Vitest. Pages deletadas: gateway/utm-check/google/primeira-analise/tour (do wizard). Components deletados: ProgressBar/SkipButton/StepSkipActions/AdvanceStepButton/BackButton/GatewayPicker/UtmHealthScore. Suite 431 → 453.

#### Semana 2 — Dashboard & Campanhas

- [x] **1.6** — Dashboard funil 8 etapas + Mixpanel-style multi-widget (~15h efetivo vs 5h estimado — escopo expandido pra Mixpanel-level por escolha estratégica) ✅ entregue 2026-05-28 (commits `bc94f09` main + `6ae9256` polish). **15 sub-PRs**. Stack: Recharts 3.8 + react-grid-layout 2.2 (rewrite React 19-ready) + Visx (defer pra cohort/sankey). **12 widgets renderizados**: 6 KPI cards (Faturamento/Lucro/ROAS/Investimento/CAC/Ticket médio com delta % + sparkline 14d + invertDeltaPolarity pra CAC) + FunnelPyramid 8 etapas com pirâmide invertida proporcional à posição + drop-off pills nomeadas (CTR/Page Load/Lead Rate/Checkout/Aprovação/Confirmação/Retenção) + 5 presets funcionais (VSL direto/Webinar/Lead magnet/WhatsApp/Trial SaaS) + Custom com toggle por etapa + SalesVsInvestmentChart (ComposedChart area+lines) + TopCreativesTable sortable com lifecycle status + ChannelMixDonut + UtmSourceTable com ROAS colorido + CohortHeatmap LTV (CSS grid + color-mix). **DashboardGrid drag-drop** com `draggableCancel` permitindo cliques em botões. **Saved views CRUD** (`dashboard_layouts` 0022 com RLS workspace+user; userId NULL = shared) + dropdown SavedViewsBar com modal de criação. **DashboardFiltersBar sticky** com URL search params como source of truth: período (10 presets) / comparação / atribuição (last-click ativo, demais "em breve") / canais multi / produtos multi / funil nomeado single. **Funis nomeados** (`dashboard_funnels` 0023) com landing pattern + UTM pattern + product*ids[] + `/configuracoes/funis` admin CRUD. **Queries reais** em `dashboard-metrics.ts` (6 queries paralelas: KPI/daily/funnel/channel/UTM/creatives) com toggle `hasWorkspaceData` (>=5 gateway_events em 30d → real, senão mock + badge "exemplo"). Atribuição last-click via `matched*\*`fields (ja populados pelo UTM Stitcher 1.4.8). Channel mapping utm_source → canal canônico. **Empty states per widget** +`/dashboard/loading.tsx`skeleton com shimmer. **+64 testes** (channel-mapping/period-range/mock-data/funnel-presets). **Smoke doc** em`docs/smoke/1.6-dashboard.md` com 12 áreas checklist. Suite 453 → 517. **Bug discovery**: react-grid-layout v1 silenciava drag em React 19 (`findDOMNode` removido); migrou pra v2.x com nodeRef pattern.
- [x] **1.7** — /campanhas listagem + detalhe + comparativo (~9h efetivo vs 4h estimado — escopo expandido pra Mixpanel-level por escolha estratégica) ✅ entregue 2026-05-29 (commit `003f2fd` main + 8 commits cadeia bug fixes Meta E2E `90f7d93` → `40aca0c`). **7 sub-PRs**. **Listagem `/campanhas`**: filtros URL-driven (período/status/plataforma/busca/ad_account com dropdown) + paginação 25/pg via CTE (`COUNT(*) OVER ()`) + colunas com conversoes/receita/ROAS coloridos. **Detalhe `/campanhas/[id]`**: 8 KPI cards reusando `<KpiCard>` do dashboard (Gasto/Receita/Cliques/CTR/Conv/ROAS/Impressões/CPA com `invertDeltaPolarity`) + delta % vs período anterior + sparkline 7-30d + chart Recharts ComposedChart (receita area + gasto line + cliques/conv eixo direito) + AdSetsTreeTable expansível (click chevron expande ads aninhados com bullet "↳") + CreativesGallery grid responsivo (2-5 cols) com thumbnails Meta + badge "Vídeo" quando video_url + status pill. **Comparativo `/campanhas/comparativo`**: MVP side-by-side com 2 dropdowns (com `excludeId`) + botão swap + tabela 10 métricas + delta % com vencedor highlighted (`lowerIsBetter` pra CPA/CPC/CPM). **Atribuição**: last-click via `gateway_events.matched_campaign_id` (UTM Stitcher 1.4.8). **Queries novas**: `src/lib/db/queries/campaign-detail.ts` (getCampaignHeader/Kpis/DailySeries/AdSetsWithAds/Creatives/listCampaignsForCompare) + `listAdAccountsByWorkspace` em meta-connections. **Utils puros** em `src/lib/campanhas/comparison.ts` (deltaPct, formatMetricValue, totalPages) + 19 testes Vitest. **Smoke doc** em `docs/smoke/1.7-campanhas.md` com 8 áreas. **8 bugs fixes na cadeia Meta E2E** descobertos durante teste real (Vinicius 32 ad accounts multi-BM agência): (1) connectHref direto pra /api/oauth/meta/start (layout (onboarding) bloqueava /bem-vindo/meta legacy), (2) callback agrega ad accounts de TODOS os BMs via listMyAdAccounts + iteração businesses + dedup (era só businesses[0]), (3) replaceAdAccounts ON CONFLICT usar EXCLUDED.\* per-row (era input.accounts[0] estático), (4) filtro por ad account na barra (/campanhas misturava 800+ campaigns de 24 contas), (5) listAdAccountsByWorkspace via Drizzle query builder (db.execute retornava snake_case), (6) remover conceito de "ad account default" pra modelo agência (AdAccountPicker virou AdAccountList read-only), (7) **Meta API v25 não aceita video_3/15/30_sec_watched_actions** — retornava HTTP 400 #100 (#100), causa de TODOS os workspaces terem 0 ad_insights. **Trigger.dev deploy v20260529.2 ativo em prod** (deployei via MCP). **Estado real produto**: 32 ad accounts conectadas, 917 campaigns (51 ACTIVE), insights agora populando. Suite **536/536**. Detalhes em [[reference-meta-api-v25-gotchas-2026-05]] + [[project-status-2026-05-29-sessao-1-7-meta-e2e]].
- [ ] **GATE pré-1.7.5**: instalar `criation-tracking.js` em 1 landing real (~30min setup + esperar venda real). Atualmente dashboard mostra spend/CTR/cliques mas receita/ROAS/CAC zerados porque tracking não capturou nenhum visitor real. Os 106 gateway_events nos últimos 30d são webhooks sandbox de teste (sem UTM/fbclid). Pré-req pra ver E2E completo: snippet em `/configuracoes/tracking-script` colado no `<head>` da landing alpha (Vinicius) + adicionar domínio na allowlist + padronizar UTM nas campanhas Meta (utm_source=facebook, utm_campaign=<nome consistente>). Sem esse gate, todo trabalho de matching (1.4.8/1.4.B) + fanout CAPI (1.4.9/B) fica em "feature complete mas não exercitado em prod". Pode rodar em paralelo com 1.7.5/1.8.
- [ ] **1.7.5** — `creditService` implementação completa: checkBalance, consume, allocate, refund, expireBatch, getHistory + atomicidade FOR UPDATE + ordem de consumo (~5h) ⚠️ **base do billing — não pule**

#### Semanas 2-3 — Estúdio Quick

- [ ] **1.8** — claude.service + bloco de transição + integração com creditService (pré-flight + consume on success) (~4h)
- [ ] **1.9** — `analisar.video_ad` (Quick) + fluxo /estudio/analisar/nova com preview de custo (~5h)
- [ ] **1.10** — Typewriter effect e polling otimizado (~2h)
- [ ] **1.11** — Página de resultado: 8 seções completas + footer com saldo após consumo (~4h)

#### Semana 3 — Billing

- [ ] **1.12** — billing.service abstrato (Asaas + Stripe) + integração com creditService.allocate em webhooks (~5h) ⚠️ **complexidade adicional**
- [ ] **1.13** — Checkout (planos + packs), paywalls com lógica de recomendação, upgrade in-product (~4h) ⚠️ **complexidade adicional**
- [ ] **1.14** — credit-expiration.task (Trigger.dev v3 daily) + alerts.job MVP (~3h)

#### Semana 4 — Compliance e fechamento

- [ ] **1.14.5** — Consent Mode v2 + LDU + PII redaction audit (~4h) ⚠️ **pré-requisito legal pro launch**
- [ ] **1.15** — Fechamento da Fase 1 (polish + smoke tests) (~3h)

### Riscos

- **Subestimar a 1.4.8 (UTM Stitcher).** É o cérebro da atribuição. Edge cases de UTM bagunçada (caracteres especiais, encoding errado, valores duplicados com case diferente) tomam horas. Reserve 8h, não 5h.
- **Pular a 1.4.9.5 (shadow validation end-to-end) achando que smoke E2E com fixture basta.** Não basta. 1.4.A/1.4.B/1.4.8/1.4.9/1.4.9.B validadas só contra fixtures sintéticas têm bugs invisíveis em browsers reais (iOS Safari ITP, conflito com pixel/GTM do cliente), em payloads gateway prod (encoding pt-BR, timezone, campos opcionais ausentes), em UTM de campanhas Meta+Google com 5+ anos de naming caótico (literal `{{ad.name}}`, espaços, acentos, duplicatas) e — pior — em **EMQ baixo no Meta Events Manager** por hash format errado ou event_id dedup quebrado com pixel do cliente, e em **match rate baixo no Google EC** por conversion_action mapping errado ou `login-customer-id` header faltando em MCC. 1.4.9.5 é o **último checkpoint antes do dado de tracking virar UI** (1.6 dashboard funil + 1.7 /campanhas). Bugs achados depois de 1.6 ter shippado significam cliente vendo "venda atribuída à campanha errada" e perdendo confiança — bug visível é caro, bug interno é barato. Esta sessão também absorve o GATE 1.4.8 + TD-104 LGPD que estavam pendentes em isolado.
- **Pular 1.7.5 (creditService completo)** achando que dá pra "fazer só o consume na 1.8 e o resto depois". Não dá. allocate, refund, expireBatch, ordem de consumo precisam estar prontos antes de webhooks de pagamento (1.12) e do credit-expiration.task (1.14). Sessão dedicada de 5h economiza 15h de retrabalho.
- **Race condition na atomicidade do `consume`.** Sem `SELECT FOR UPDATE` no balance row, 2 análises paralelas podem deduzir simultaneamente e gerar saldo negativo. Teste explícito de race condition é obrigatório (v0.6 §4.11).
- **Pular 1.14.5 (Consent Mode v2)** pensando que dá pra fazer "depois do launch". Não dá. Custo agora: 4h. Custo após auditoria ANPD ou bloqueio Google: dezenas de horas + risco financeiro real.
- **Tentar incluir 12 pipelines do Estúdio na Fase 1.** O escopo do MVP é UM pipeline (`analisar.video_ad`). Os outros 11 vão na Fase 2. Não negocie isso com você mesmo.
- **Custos de pipeline divergentes da estimativa.** Se você não validou na pré-Fase 0 (1-2h gastando R$10), prepare-se para descobrir agora que Modelar YouTube custa R$8 e não R$5. Recalibre `pipeline_costs.cost_credits` via /admin/pipelines (Sessão 3.15) **antes** de Fase 2 trazer os outros pipelines com mesmo erro.
- **Beta com estranhos.** Convide 2-3 pessoas que vão te dar feedback honesto, não estranhos da internet que somem após o primeiro erro.
- **Pular smoke tests da 1.15.** Achar que "passou nos E2E" é suficiente. Smoke manual com clique a clique pega coisas que E2E não pega. Inclua: signup → trial 50 créditos alocados → análise → saldo cai → paywall ao zerar.

---

## Fase 2 — Consistência

> _"Funciona pra um caso" → "Funciona pra qualquer combinação razoável de gateway + plataforma + ad network"._

**Duração:** ~6 semanas (~80-100h)
**Sessões:** 2.1 → 2.15.5 (16 sessões)
**Detalhe completo:** [v0.6 §3.3](./docs/criation-io-arquitetura-v06.html#p3-3)

### Objetivo

O produto entrega valor consistente para diferentes tipos de operação. Estúdio completo (12 pipelines + 4 modos), alertas automáticos, Google Ads ao lado de Meta, colaboradores, transações de email confiáveis, hardening de segurança proativo.

### Pré-requisito

Fase 1 com **marco de validação atingido** (3 betas + 1 pagante real). Sem isso, Fase 2 é castelo de areia.

### Definição de pronto

- [ ] Processamento de áudio (FFmpeg) funcionando — via task Trigger.dev v3 ou worker Railway, decidido na 2.1; extrai áudio em <60s
- [ ] Deepgram transcreve com diarização e timestamps
- [ ] **Os 12 pipelines do Estúdio funcionam** em 4 modos: Analisar, Modelar, Variar, Comparar
- [ ] **Cada um dos 11 pipelines novos tem `cost_credits` calibrado** em pipeline_costs com base em medições reais (não defaults)
- [ ] **Preview de custo em créditos obrigatório** em todo botão "Analisar" / "Modelar" / "Variar" / "Comparar"
- [ ] Browserless extrai sales pages corretamente (HTML + screenshots full-page)
- [ ] /admin/capi-observability mostra EMQ por evento, alerta se cair abaixo de 7.0
- [ ] tracking.service centralizado (formaliza o stub da 1.4.9)
- [ ] /referencias funcional como biblioteca curada (não marketplace)
- [ ] alerts.job dispara 11 tipos: queda CTR, custo subindo, conversão caindo, criativo fadigando, etc.
- [ ] **Alertas de créditos ativos**: `credits_running_low`, `credits_expiring_soon`, `pack_repurchase_pattern` (sugere upgrade) — v0.6 §4.16
- [ ] Push PWA funciona em iOS 16.4+ e Android
- [ ] **SSE streaming real** durante análises (não polling)
- [ ] Google Ads conectado via OAuth, sync de campanhas funciona em paralelo ao Meta
- [ ] Colaboradores: 3 roles (owner, admin, analyst), convites por email
- [ ] **17 emails transacionais** com domínio autenticado (SPF, DKIM, DMARC), templates revisados
- [ ] /produtos com mapeamento manual completo (gateway product → product no app)
- [ ] Segmentação do funil por escopo (campaign, adset, ad, creative)
- [ ] **Threat model STRIDE** documentado em `docs/threat-model.md`
- [ ] CSP em modo enforce (não Report-Only) sem violations em prod
- [ ] **Rate limit universal** em todos endpoints sensíveis
- [ ] CSRF protection completa em Route Handlers mutantes

### Marco de validação (gate para Fase 3)

- [ ] **10-15 clientes pagantes ativos** (não trials, pagantes mensais recorrentes)
- [ ] **Pelo menos 5 em planos Pro ou Agency** (não só Starter — Starter sozinho não paga infra)
- [ ] **NPS ≥ 30** (escala -100 a +100; 30+ é "produto serve")
- [ ] **Pelo menos 3 retornos orgânicos:** clientes que voltaram numa segunda semana sem você empurrar
- [ ] **Tempo médio de análise ≤ 2 min** (incluindo upload de vídeo até resultado renderizado)
- [ ] **Zero incidentes P1** nos últimos 14 dias
- [ ] **Margem agregada por plano ≥ 65%** (medida via `/admin/financeiro` planejado pra Fase 3, ou planilha temporária com dados de credit_transactions). Se algum plano cair abaixo, recalibrar `cost_credits` antes de Fase 3 (v0.6 §4.16).
- [ ] **Custos reais por pipeline calibrados** com dados reais (não mais estimativa). Diff de cada pipeline vs estimativa em `pipeline_costs.estimated_real_cost_brl` ≤ 15%. Aceitável até 30%, mas obrigatório recalibrar antes da Fase 3.
- [ ] **Pelo menos 1 cliente comprou pack** de overage (valida que o fluxo funciona em produção, não só em testes).

### Sessões

#### Semanas 5-6 — Áudio + pipelines completos

- [ ] **2.1** — Processamento de áudio (FFmpeg): decidir Trigger.dev v3 task vs Railway worker e implementar (~4-5h)
- [ ] **2.2** — Deepgram integration (~3h)
- [ ] **2.3** — Estúdio Deep + restante dos 12 pipelines (~6h)
- [ ] **2.4** — Browserless.io integration (~3h)
- [ ] **2.4.5** — /admin/capi-observability + tracking.service centralizado (~4h) — integrar Dataset Quality API (puxar EMQ histórico Meta) — ver [ADR-013](./docs/adr/ADR-013-meta-platform-2026.md)
- [ ] **2.5** — Otimização pipelines sales_page (caching + paralelização) (~3h)

#### Semanas 7-8 — Referências + Alertas + Streaming

- [ ] **2.6** — Análise de referências (4 tipos) (~4h)
- [ ] **2.7** — alerts.job completo (11 tipos) (~3h)
- [ ] **2.8** — /alertas central completa + push PWA (~4h)
- [ ] **2.9** — SSE streaming real das análises (~3h)
- [ ] **2.10** — Google Ads integration (~6h, expandida pós-auditoria) — ver [audit Google 2026-05](./docs/audits/GOOGLE_API_2026-05.md). Escopo expandido: Google Ads API v24 pinada + Developer Token tiers + OAuth verification application + Manager Account (MCC) + login_customer_id header + 14 colunas novas em `google_connections` + tabelas `google_ads_accounts` (1:N) e `google_conversion_action_mappings`. Spike Data Manager API obrigatório antes de fechar scope (UserDataService deprecando 1-abr-2026 para tokens novos). Submeter OAuth client verification em paralelo (timeline 2-6 semanas). ADR-015 a ser escrito durante prep desta sessão.
- [ ] **2.10.5** — GA4 fanout opcional (Measurement Protocol) (~2h) — ver [audit Google 2026-05](./docs/audits/GOOGLE_API_2026-05.md). Toggle "enviar para GA4 também" no `/configuracoes/conexoes`. Fanout via Measurement Protocol em paralelo a Meta CAPI/Google Ads. Off por default. Cliente que tem GA4 pode ativar.

#### Semanas 9-10 — Colaboração + Email + Closing

- [ ] **2.11** — Colaboradores com 3 roles (~3h)
- [ ] **2.12** — 17 emails transacionais completos (~4h)
- [ ] **2.13** — /produtos completo + mapeamento (~3h)
- [ ] **2.14** — Segmentação do funil por escopo (~2h)
- [ ] **2.14.5** — First-party CNAME para tracking script (~3h) — ver [ADR-014](./docs/adr/ADR-014-criation-as-cdp.md). Wizard que ensina cliente a apontar `track.dominio-cliente.com → t.criation.io` via CNAME, Vercel emite cert SSL automático. Cookie de visitor_id passa a ser setado no domínio do cliente — cobre Safari ITP / iOS bem (importante para infoprodutor mobile-heavy).
- [ ] **2.15** — Fechamento Fase 2 — auditoria + polish (~3h)
- [ ] **2.15.5** — Threat model + CSP enforce + rate limit universal (~5h) ⚠️ **hardening pré-escala**

### Riscos

- **Pular a 2.15.5 (hardening).** É a sessão menos divertida da Fase 2 e a mais importante. Depois que /admin entra no ar na Fase 3, retrofit de threat model + CSP enforce custa o triplo. Faça agora.
- **SSE com mock ao invés de stream real.** Vai parecer que funciona. Quando abrir 50 análises simultâneas em produção, latência percebida explode.
- **Escopo creep em /referencias (2.6).** É **biblioteca curada**, não marketplace de criativos da galera. Cada hora gasta em "feature legal" aqui é hora não gasta no loop de aprendizado da Fase 3, que é o diferencial real.
- **Os 12 pipelines em massa.** Implemente em ondas: primeiro Analisar (4 pipelines), depois Modelar (4), depois Variar+Comparar (4). Cada onda revisada e mergeada antes da próxima começar.
- **Email transacional sem autenticação de domínio.** Mandar email do `criation.io` sem SPF/DKIM/DMARC = 30%+ vai pra spam. Configure no início da 2.12, não no final.

---

## Fase 3 — Retenção

> _"O produto fica mais inteligente quanto mais é usado, e o admin opera o negócio sem SQL ad-hoc."_

**Duração:** ~6 semanas (~90-110h)
**Sessões:** 3.1 → 3.16 (17 sessões)
**Detalhe completo:** [v0.6 §3.4](./docs/criation-io-arquitetura-v06.html#p3-4)

### Objetivo

Pegar o **diferencial único** do Criation que ninguém mais tem: o **loop de aprendizado** (measure outcome → match copy → aggregate → improve prompts) e construir o admin operacional para escalar para 100+ clientes sem você queimar gasolina manualmente.

### Pré-requisito

Fase 2 com marco de validação atingido (10-15 pagantes, NPS ≥ 30).

### Definição de pronto

**Loop de aprendizado**

- [ ] measure-outcome.job aguarda 14 dias (`step.sleep`) e mede performance real do criativo após análise
- [ ] Tela "Antes/Depois" em cada análise: usuário vê o que mudou e o impacto numérico
- [ ] learning_signals coleta todos eventos relevantes (analise gerada, recomendação aplicada, métrica subiu/desceu)
- [ ] match-copy.job semanal: identifica padrões em copies que performaram bem por nicho
- [ ] learning-aggregation.job + views: dados agregados alimentam prompts canary

**Admin operacional**

- [ ] Admin shell com role `super_admin`, controle de acesso, audit log
- [ ] /admin: dashboard de negócio (MRR, ARR, churn, LTV, CAC, NPS)
- [ ] /admin/usuarios: lista, busca, filtros, **impersonation com timeout de 30 min**, audit log de toda ação admin
- [ ] /admin/prompts: versioning semver, **canary deploy** (5% → 25% → 100%), rollback 1-clique
- [ ] /admin/claude: observability de toda request (latência, custo, output token, model)
- [ ] /admin/jobs: status Trigger.dev v3, retry manual, dead letter queue

**Cost & Operations**

- [ ] **/admin/financeiro completo** (v0.6 §4.16): MRR/ARR por plano, margem agregada por plano, margem por crédito vendido, % clientes em margem negativa, custo médio por análise/pipeline, burn rate Anthropic API
- [ ] **Drill-down por cliente** com sugestões automáticas (contactar, sugerir upgrade, marcar VIP)
- [ ] **5 alertas automáticos de margem** ativos: margem agregada < 65%, cliente individual em margem negativa por 30 dias, pipeline 30%+ acima do estimado, mudança preço Anthropic > 15%, burn rate > 2x média
- [ ] **Relatório financeiro mensal** automatizado (gerado dia 1 do mês, distribuído via email + Slack)
- [ ] **Recalibração trimestral** documentada como processo (mesmo que primeira execução não tenha mudanças)
- [ ] **DR runbook** em `docs/disaster-recovery.md` testado em staging (restore de backup funciona)
- [ ] **Feature flags operacionais** (não mais stub) — ligar/desligar features sem deploy
- [ ] /admin/saude com SLOs em tempo real

**CAPI premium**

- [ ] Eventos completos: Lead, CompleteRegistration, AddToCart, ViewContent (além de Purchase, IC já implementados)
- [ ] Predicted LTV via modelo simples por cohort
- [ ] Customer Match sync para Agency (lista de clientes de alto valor para lookalike)
- [ ] Attribution settings configuráveis pelo usuário (1d/7d/28d click, 1d view)

**Compliance e ops**

- [ ] DPIA LGPD assinado em `docs/dpia-lgpd.md`
- [ ] Runbooks operacionais em `docs/runbooks/` (incidentes comuns)
- [ ] Diagramas de arquitetura atualizados em `docs/architecture/`
- [ ] Exportações PDF/CSV/XLS/JSON robustas com queue e download seguro
- [ ] Programa de afiliados completo (links únicos, rastreio, comissões, payout)
- [ ] PWA instalável (manifest, service worker, offline shell, push notifications)
- [ ] /admin/pipelines: configurar prompts, modelos, parâmetros sem deploy
- [ ] /admin/pipelines: **editar `cost_credits` de cada pipeline** com preview de impacto ("Mudar Modelar YouTube de 15 para 17 afeta 12% dos usuários ativos. Margem agregada de Agency vai de 74% para 76%"). Histórico em `pipeline_costs_history`. v0.6 §4.3.

### Marco de validação (gate para Fase 4)

- [ ] **30-50 clientes pagantes** ativos
- [ ] **Margem agregada por plano ≥ 70%** em Pro e Agency, ≥ 50% no Starter (Starter pode ser quase break-even em escala baixa). Medida via /admin/financeiro do v0.6 §4.16.
- [ ] **% de clientes em margem negativa < 2%** (idealmente 0). Se há cliente em margem negativa, decisão consciente de admin (cliente VIP, custo de aquisição já amortizado).
- [ ] **Burn rate Anthropic API ≤ 30% da receita total** (custo direto de Claude API não pode passar de 30% pra deixar espaço pra outros custos + lucro).
- [ ] **Pelo menos 1 caso documentado** de "usuário melhorou ROAS após análise" — confirmado pelo measure-outcome.job, não auto-relato.
- [ ] **Loop de aprendizado deu ao menos 1 ciclo completo:** insights da agregação semanal foram aplicados em prompt canary, ROI das análises subiu mensuravelmente.
- [ ] **Zero downtime > 30 min** no último mês.
- [ ] **Churn mensal ≤ 8%** (saudável para SaaS B2B; >12% sinaliza problema de produto).
- [ ] **NPS ≥ 50** (subiu desde a Fase 2).
- [ ] **Recalibração trimestral de pipeline_costs executada** ao menos 1 vez (mesmo que sem mudanças). Provoca o hábito.

### Sessões

#### Semanas 11-12 — Loop de aprendizado

- [ ] **3.1** — measure-outcome.job (`step.sleep` 14d) (~4h)
- [ ] **3.2** — Tela "Antes/Depois" em análises (~3h)
- [ ] **3.3** — learning_signals coleta completa (~3h)
- [ ] **3.4** — match-copy.job (weekly) (~3h)
- [ ] **3.5** — learning-aggregation.job + views (~4h)

#### Semanas 13-14 — Programa de afiliados + Admin

- [ ] **3.6** — Programa de afiliados completo (~4h)
- [ ] **3.7** — Admin shell + controle de acesso (~3h)
- [ ] **3.8** — /admin dashboard de negócio (~4h)
- [ ] **3.9** — /admin/usuarios + impersonation (~4h)
- [ ] **3.10** — /admin/prompts com versioning + canary (~4h)
- [ ] **3.11** — /admin/claude + /admin/jobs observability (~3h)
- [ ] **3.11.5** — /admin/financeiro completo (margem agregada por plano, % clientes negativos, custo por pipeline real vs estimado, burn rate Anthropic) + DR runbook + Feature flags + alertas automáticos de margem (~6h) ⚠️ **operações sustentáveis · v0.6 §4.16**

#### Semanas 15-16 — CAPI premium + Compliance + Polish

- [ ] **3.12** — CAPI expansion: eventos completos + predicted LTV + Customer Match + CTWA (Click-to-WhatsApp, diferencial BR) (~6h) — ver [ADR-013](./docs/adr/ADR-013-meta-platform-2026.md)
- [ ] **3.13** — Exportação robusta (PDF/CSV/XLS/JSON) (~3h)
- [ ] **3.13.5** — DPIA LGPD + runbooks + diagramas (~5h)
- [ ] **3.14** — PWA completo (~3h)
- [ ] **3.15** — Pipeline Configuration admin (~5h)
- [ ] **3.16** — Fechamento Fase 3 (~3h)

### Riscos

- **Subestimar a 3.11.5 (cost modeling).** Você está prestes a queimar margem. Sem dashboard de custo infra, você só descobre que perde dinheiro quando alguém pergunta. Implemente.
- **Admin "meia bomba".** Se vai ter /admin/prompts, **tem que ter canary deploy**. Backdoor admin sem proteção = chance de quebrar produção em 100 clientes ao mesmo tempo. Faça completo ou não faça.
- **Pular DPIA LGPD (3.13.5).** Relatório de impacto é obrigatório para SaaS B2B sério. Cliente Agency vai pedir auditoria — não ter DPIA = perder contrato grande.
- **Loop de aprendizado sem dados suficientes.** Com 30 clientes, agregações podem ter ruído alto. Aceite que os primeiros ciclos do learning serão diretivos (você revisa manualmente) antes de virar autônomo.
- **Programa de afiliados antes do produto reter.** Atrair via afiliação produto que ainda churna 20%/mês = jogar dinheiro fora. Se NPS está abaixo de 50 no início da Fase 3, considere atrasar a 3.6.

---

## Fase 4 — Polish + Launch

> _"O produto parece feito por uma empresa de 50 pessoas, não por um founder com Claude Code."_

**Duração:** ~2-3 semanas (~30-40h)
**Sessões:** 4.1 → 4.10 (10 sessões)
**Detalhe completo:** [v0.6 §3.5](./docs/criation-io-arquitetura-v06.html#p3-5)

### Objetivo

Cada toque, cada transição, cada empty state pensado. Performance verde no Lighthouse. Segurança auditada externamente. Acessibilidade WCAG AA. Launch público no Product Hunt.

### Pré-requisito

Fase 3 com marco de validação atingido (30-50 pagantes, margem positiva, loop de aprendizado vivo).

### Definição de pronto

**Polish visual**

- [ ] Design system auditado, refinos aplicados (espaçamento, tipografia, hierarquia)
- [ ] Micro-animações em transições, hover states, loading, empty states
- [ ] Landing page final com demo interativo (não só vídeo)
- [ ] **Página /precos final com créditos como unidade clara** ("Pro: R$497/mês — 375 créditos. Veja o que cabe: ~75 análises Deep, ou 25 Modelar YouTube") + tooltip "como funcionam os créditos"
- [ ] Onboarding polido + 100% empty states cobertos com mensagem útil
- [ ] **Empty state "Sem créditos suficientes" pulido** com CTAs claros (pack vs upgrade)
- [ ] Páginas de erro 404, 500, 503 customizadas e na voz do produto

**Unit economics confirmadas**

- [ ] **Margem agregada por plano ≥ 70% Pro/Agency, ≥ 50% Starter** nos últimos 30 dias antes do launch
- [ ] **Zero clientes em margem negativa** (ou todos os negativos com flag explícita "VIP/aceitável")
- [ ] **`pipeline_costs` calibrado** com dados reais dos últimos 90 dias, diff vs estimativa ≤ 15%
- [ ] **Cost dashboard estável** — métricas atualizam sem erro, alertas configurados

**Performance**

- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 90, Best Practices ≥ 95
- [ ] Core Web Vitals todos em verde (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Bundle size auditado, chunks lazy-loaded apropriadamente
- [ ] Imagens otimizadas (next/image), fonts com `font-display: swap`

**Qualidade**

- [ ] 3 fluxos E2E críticos com 0% flaky em 50 runs consecutivos
- [ ] Coverage ≥ 80% global, ≥ 90% em utils e services
- [ ] Zero erro JS no Sentry de severity error nos últimos 7 dias

**Segurança**

- [ ] OWASP Top 2021 auditado (já parcialmente coberto pela 2.15.5; aqui é validação final)
- [ ] Penetration test executado por consultor externo
- [ ] Bug bounty configurado (HackerOne ou alternativa)
- [ ] 2FA admin enforcement validado
- [ ] Logs sem PII confirmado em produção

**Acessibilidade**

- [ ] WCAG AA: contraste, navegação por teclado, screen reader compatibility
- [ ] axe-core CI passando sem violations em rotas principais

**Observability**

- [ ] SLOs definidos e monitorados:
  - 99.5% uptime mensal (budget de erro: 3.6h)
  - p95 latência dashboard < 500ms
  - p95 latência análise quick < 30s
  - error rate < 0.1%
- [ ] /admin/saude mostra SLOs em tempo real
- [ ] Better Stack monitorando todos endpoints críticos
- [ ] Sentry com sourcemaps em todas camadas
- [ ] Runbook de incident em `docs/incident-runbook.md`

**Launch**

- [ ] Domínio final com SSL
- [ ] Emails autenticados (SPF, DKIM, DMARC)
- [ ] Backup automático testado (restore em staging funciona)
- [ ] Status page pública (Better Stack)
- [ ] Email `suporte@criation.io` ativo
- [ ] Documentação para usuários completa em `/ajuda`
- [ ] 5 artigos de blog seed publicados
- [ ] Press kit: logo variações, screenshots, 1-pager, fundador bio
- [ ] Product Hunt assets: hunter engaged, gallery images, video demo 60s, comment 1º preparado
- [ ] Threads sociais drafted (Twitter, LinkedIn)
- [ ] Email para lista beta drafted

### Marco de launch

- [ ] **Product Hunt live** numa terça ou quarta (melhor performance histórica)
- [ ] **Mínimo 100 upvotes nas primeiras 4h** (validação básica de tração)
- [ ] **Status page mostra 100% uptime no dia**
- [ ] **Você em standby 8-10h no dia D** pra responder comentários e capturar feedback

### Sessões

- [ ] **4.1** — Design system final (audit + refinos) (~4h)
- [ ] **4.2** — Micro-animações e transições (~3h)
- [ ] **4.3** — Landing page final + demo interativo (~5h)
- [ ] **4.4** — Onboarding polido + empty states (~3h)
- [ ] **4.5** — Performance audit e otimização (~4h)
- [ ] **4.6** — Testes E2E completos dos 3 fluxos críticos (~3h)
- [ ] **4.7** — Security audit (OWASP) (~3h)
- [ ] **4.8** — Accessibility (WCAG AA) (~3h)
- [ ] **4.9** — Observability de produção + SLOs (~3h)
- [ ] **4.10** — Launch checklist + Product Hunt (~2h)

### Riscos

- **Polish sem fim.** Estabeleça budget de 3 semanas máx. Refinos infinitos não vendem mais; lançamento sim. Se a Fase 4 estourou 4 semanas, lance e refine pós-launch.
- **Subestimar o dia D.** Tenha 8-10h livres no dia, em standby. Não é hora de atender cliente da agência ou jantar fora.
- **Lançar sem 4.7 e 4.8.** "Faço depois" = nunca. Custo agora: 6h. Custo de descobrir vulnerabilidade pós-launch num cliente Agency: imensurável.
- **Product Hunt como única estratégia de launch.** PH dá um boost de 24-48h. Tenha thread Twitter, post LinkedIn, email beta, e 2-3 posts em comunidades relevantes (ex: comunidades de copy/perf no BR) prontos para o mesmo dia.

---

## Pós-launch — primeiras 4 semanas

Não é parte do roadmap formal, mas o que você faz aqui define se a tração inicial vira retenção real.

### Semana 1 (launch week)

- Monitoramento reforçado, equipe (você) em standby
- Responder cada comentário PH dentro de 30 min nas primeiras 8h
- Capturar feedback negativo em backlog priorizado
- Daily check-in com SLOs: tudo verde?

### Semana 2-4

- Bugs P1/P2 do feedback do launch resolvidos
- Onboarding refinado com base em telemetria PostHog (onde usuários abandonam?)
- Primeiro post-mortem público (em formato changelog/blog) sobre o launch — humildade gera conexão
- Iniciar planejamento da v0.6 com base em feedback estruturado

### Métricas para olhar

- DAU/MAU ratio (≥ 20% saudável)
- Time to first value (signup → primeira análise) — meta < 10 min
- Churn cohort do launch — semana 1, 2, 4 retention
- NPS pós-30-dias

---

## Filosofia de execução

Princípios que ficam de pé em qualquer fase. Quando estiver em dúvida, volte aqui.

1. **Estratégia antes de copy. Argumento antes de UI. Schema antes de tela.** Toda vez que pular essa ordem, vai fazer 2x.
2. **Multi-tenant é cultural, não técnico.** Toda nova feature: "como isso se comporta com 2 workspaces?". Esquecer disso = vazamento de dados depois.
3. **Compliance é Fase 1, não item de polish.** ANPD, LGPD, Consent Mode, PII redaction — tudo cedo. Tarde = caro.
4. **Não construa admin pela metade.** Half-done admin é backdoor. Faça completo ou não faça.
5. **Cost modeling é continuous, não event.** Olhe margem por usuário toda semana, não só quando estourar.
6. **Toda análise consome crédito calibrado pelo custo real.** Se um pipeline novo entra, custo em créditos é definido com base em medição real, não em achismo. Recalibração trimestral é hábito, não exceção.
7. **Margem é número público interno.** Todo founder check-in semanal: qual a margem agregada por plano? Se não sabe, /admin/financeiro está quebrado ou foi pulado.
8. **Validação com usuário real é gate, não checkbox.** Se 3 betas não terminam o ciclo, há problema real. Pare e descubra qual.
9. **CLAUDE.md é o prompt mais importante do projeto.** Atualize toda vez que descobrir um padrão ou regra novo. Documento vivo. **A referência ao v0.6 (especialmente Parte 4) precisa estar no CLAUDE.md desde a Sessão 0.3** — sem isso, Claude Code vai gerar código com modelo flat antigo.
10. **Cada feature nova com teste no mesmo PR.** Coverage não é número arbitrário; é prova que a próxima refatoração não vai quebrar o que existe.
11. **Logs sem PII. Sempre. Sem exceção.** Toda hora você roda `pnpm audit:pii` e zero hits ou refatora antes do merge.
12. **Quando o desenvolvimento se desviar, volte ao v0.6.** Cada seção é um contrato. Use como árbitro de discussões internas.

---

## Glossário rápido

- **AGC** — Agência Criation.io
- **CRT** — App Criation.io (este produto)
- **HWS** — App Hey Whispa (outro produto, fora do escopo)
- **CAPI** — Conversions API (server-side tracking para Meta/Google)
- **LDU** — Limited Data Use (Meta), enforcement automático quando consent revogado
- **EMQ** — Event Match Quality (score Meta de qualidade do evento CAPI)
- **DPIA** — Data Protection Impact Assessment (relatório de impacto LGPD)
- **STRIDE** — framework de threat modeling (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)
- **DR** — Disaster Recovery
- **SLO** — Service Level Objective
- **PII** — Personally Identifiable Information

---

## Referências

- [`docs/criation-io-arquitetura-v06.html`](./docs/criation-io-arquitetura-v06.html) — arquitetura completa, comandos para Claude Code por sessão
- [`docs/criation-io-arquitetura-v06.html#p4-0`](./docs/criation-io-arquitetura-v06.html#p4-0) — **Parte 4: Modelo de Negócio e Sistema de Créditos** (planos, custos, schema, fluxos, observabilidade)
- [`CLAUDE.md`](./CLAUDE.md) — contrato técnico para Claude Code (criado na Sessão 0.3)
- [`AGENTS.md`](./AGENTS.md) — agents especializados do projeto (criado na Sessão 0.3)
- [`docs/cost-model.md`](./docs/cost-model.md) — projeção de custo unitário por plano (criado na Sessão 3.11.5)
- [`docs/threat-model.md`](./docs/threat-model.md) — STRIDE por componente (criado na Sessão 2.15.5)
- [`docs/dpia-lgpd.md`](./docs/dpia-lgpd.md) — DPIA assinado (criado na Sessão 3.13.5)
- [`docs/disaster-recovery.md`](./docs/disaster-recovery.md) — DR runbook (criado na Sessão 3.11.5)
- [`docs/incident-runbook.md`](./docs/incident-runbook.md) — runbook de incidentes (criado na Sessão 4.9)

---

_Boa construção._
