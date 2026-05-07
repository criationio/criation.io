# AUDIT_STATE — 2026-05-07

Read-only audit do repositorio Criation.io em `/Users/viniciusbenavides/App-Criation-Io`.
Branch: `develop` · Last commit: `d220244` · Auditoria: somente leitura.

---

## 16. Executive Summary

O repositorio esta solido para o ponto declarado: Sessoes 0.1 → 0.4 v2 + post-fixes (FunnelPyramid sofisticado, fix de hidratacao, funnel vars em `:root`) estao concluidas. Build verde (TS/lint/test). 45 tabelas no schema Drizzle batem exatamente com 45 `ENABLE ROW LEVEL SECURITY` em `rls.sql`. Seeds populam 7 pipelines + 3 packs + 5 feature flags. Encryption AES-256-GCM com versionamento por chave + 6 testes Vitest passando.

**Surpresa principal**: o sistema de creditos ja esta presente no schema (`credit_balances`, `credit_transactions`, `credit_packages`, `pack_purchases`, `pipeline_costs`, `pipeline_costs_history`, `processed_webhook_events`) e no seed — mas o CLAUDE.md nao menciona "creditos / pipeline_costs / Parte 4 / v0.6" em lugar nenhum. Isso indica que o domain do credits foi modelado em DB sem ainda ter codigo de aplicacao consumidor (nenhum service, action, ou query usa essas tabelas — verificado via grep). Outras divergencias relevantes: stack instalada e Next.js **16.2.4** (CLAUDE.md diz "Next.js 15"); `@supabase/ssr` ausente (cliente legacy `@supabase/supabase-js` em uso direto, com `service_role_key` exposta no `createServerClient`); nenhum import de `neverthrow`, `@trigger.dev/sdk`, `pino-pretty`, `@tanstack/react-query`, `@sentry/nextjs`, `posthog-js`, `zustand` em `src/` apesar de instalados (sao dependencias dormentes); env vars criticas (`DATABASE_URL`, `ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc) estao todas com `.optional()` em `src/env.ts`; `correlation.ts` define `correlationStorage` mas **ninguem** chama `.run()` ou `.enterWith()` — o middleware gera o ID em header mas nao popula o AsyncLocalStorage; `dark:` prefix usado em 6 arquivos (incompativel com a estrategia `[data-theme='light']`); `lib/errors/APpError.ts` (Regra 7 do CLAUDE.md) **nao existe**; pasta `src/lib/db/queries/` (Regra 3) **nao existe**.

Em resumo: foundation forte, schema completo, design system v2 excelente — mas a camada de aplicacao (services, queries, actions, auth via SSR, observabilidade conectada) ainda esta inteiramente por construir, e a divergencia "Next 15 vs Next 16" no CLAUDE.md ja precisa ser ajustada antes da Sessao 1.1.

---

## 1. Git

**Current branch:** `develop`
**Last commit:** `d220244 fix(css): move funnel vars out of @theme to prevent tree-shake`

**Last 10 commits (one-line):**

```
d220244 fix(css): move funnel vars out of @theme to prevent tree-shake
a28e5f1 fix(ui): hydration errors and funnel pyramid background rendering
be6c416 refactor(ui): sophisticated FunnelPyramid with proportional bars and bottleneck banner
60f42da feat(ui): design system with 3-layer tokens (v2 — corrected violet palette)
c11023f chore(skills): add frontend-design skill locally
db584c6 docs: complete CLAUDE.md, AGENTS.md, onboarding, ADRs and glossary
308d559 chore: database schema complete — 45 tables, RLS, encryption, seeds (Session 0.2)
2a08522 ci: add GitHub Actions workflows for CI and preview deploys
8f9bce6 chore: initial project setup — Criation.io SaaS
e34f83b Initial commit from Create Next App
```

**`git status`:** working tree limpo, 3 untracked files (nao deletados conforme instrucoes):

- `.claude/settings.local.json`
- `package-lock.json`
- `validate-pipeline-costs.js`

**Branches:**

- Local: `develop` (atual, up-to-date com `origin/develop`)
- Remotas: `origin/HEAD -> origin/main`, `origin/develop`, `origin/main`

---

## 2. Stack instalada (declared vs lockfile)

| Pacote                  | `package.json` | `pnpm-lock.yaml` | OK                                     |
| ----------------------- | -------------- | ---------------- | -------------------------------------- |
| `next`                  | `16.2.4`       | `16.2.4`         | ✅                                     |
| `react`                 | `19.2.4`       | `19.2.4`         | ✅                                     |
| `react-dom`             | `19.2.4`       | `19.2.4`         | ✅                                     |
| `typescript`            | `^5`           | `5.9.3`          | ✅                                     |
| `tailwindcss`           | `^4`           | `4.2.4`          | ✅                                     |
| `drizzle-orm`           | `^0.45.2`      | `0.45.2`         | ✅                                     |
| `drizzle-kit`           | `^0.31.10`     | `0.31.10`        | ✅                                     |
| `@supabase/supabase-js` | `^2.105.1`     | `2.105.1`        | ✅                                     |
| `@supabase/ssr`         | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |
| `neverthrow`            | `^8.2.0`       | `8.2.0`          | ✅ instalado, **0 imports em src/** ⚠️ |
| `pino`                  | `^10.3.1`      | `10.3.1`         | ✅                                     |
| `@t3-oss/env-nextjs`    | `^0.13.11`     | `0.13.11`        | ✅                                     |
| `@trigger.dev/sdk`      | `^4.4.5`       | `4.4.5`          | ✅ instalado, **0 imports em src/** ⚠️ |
| `inngest`               | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |
| `resend`                | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |
| `@upstash/*`            | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |
| `stripe`                | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |
| Asaas SDK (qualquer)    | **AUSENTE**    | **AUSENTE**      | ❌ ABSENT                              |

**Pacotes instalados sem nenhum import em `src/**`** (grep `from '<pkg>'`):

- `@sentry/nextjs` — 0 usos
- `@tanstack/react-query` — 0 usos
- `@tanstack/react-query-devtools` — 0 usos
- `@trigger.dev/sdk` — 0 usos
- `neverthrow` — 0 usos
- `pino-pretty` — 0 usos (mas referenciado como `target` no `logger.ts` em runtime)
- `posthog-js` — 0 usos
- `zustand` — 0 usos

Estes sao "dormentes" — declarados na stack mas nao consumidos em codigo de aplicacao (esperado neste estagio inicial; ainda assim relevante para o snapshot).

---

## 3. Drizzle schema

Arquivos em `src/lib/db/schema/`:

| Arquivo          | Tabelas exportadas                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.ts`       | `prompt_versions`, `claude_request_logs`, `admin_audit_log`, `feature_flags`                                                                                           |
| `affiliates.ts`  | `affiliates`, `affiliate_referrals`, `affiliate_commissions`                                                                                                           |
| `alerts.ts`      | `alert_rules`, `alerts`, `notifications`                                                                                                                               |
| `analyses.ts`    | `analyses`, `analysis_results`, `references_lib`                                                                                                                       |
| `auth.ts`        | `users`, `workspaces`, `workspace_members`, `workspace_invites`                                                                                                        |
| `billing.ts`     | `subscriptions`, `credit_balances`, `credit_transactions`, `credit_packages`, `pack_purchases`, `pipeline_costs`, `pipeline_costs_history`, `processed_webhook_events` |
| `campaigns.ts`   | `campaigns`, `ad_sets`, `ads`, `ad_insights`, `ad_creatives`                                                                                                           |
| `connections.ts` | `meta_connections`, `google_connections`, `gateway_connections`                                                                                                        |
| `gateway.ts`     | `gateway_products`, `gateway_events`, `gateway_events_dlq`                                                                                                             |
| `learning.ts`    | `learning_signals`, `matched_copy_patterns`, `measure_outcomes`                                                                                                        |
| `tracking.ts`    | `utm_mappings`, `utm_stitching_log`, `capi_events`, `capi_event_log`, `click_id_store`, `consent_logs`                                                                 |
| `index.ts`       | barrel + types (sem `pgTable`)                                                                                                                                         |

**Total de tabelas:** **45** ✅ (bate com snapshot esperado).

**Colunas-chave verificadas:**

`subscriptions`:

- `credits_per_cycle` ✅
- `current_cycle_start` ❌ ABSENT — mas existe `current_cycle_started_at` ⚠️
- `current_cycle_end` ❌ ABSENT — mas existe `current_cycle_ends_at` ⚠️

(Colunas presentes com nome diferente do snapshot esperado. Funcionalidade equivalente, mas naming nao bate.)

`analyses`:

- `pipeline_id` ✅ (text, notNull)
- `credits_consumed` ✅ (integer, notNull, default 0)
- `credit_transaction_id` ✅ (uuid, FK -> credit_transactions.id)

`users`:

- `signup_ip_hash` ✅
- `user_agent_hash` ❌ ABSENT — coluna chama-se `signup_user_agent_hash` ⚠️
- `fingerprint` ❌ ABSENT — coluna chama-se `signup_fingerprint` ⚠️

(Conteudo esta la com prefixo `signup_*`. Nomes diferentes do snapshot, porem alinhados com naming consistente.)

**Tabelas de creditos esperadas:** todas ✅

- `credit_balances` ✅
- `credit_transactions` ✅
- `pipeline_costs` ✅
- `credit_packages` ✅
- `pack_purchases` ✅

Plus extras nao listados no snapshot: `pipeline_costs_history`, `processed_webhook_events`.

**Colunas principais por tabela** (selecionadas — nome + tipo):

`users`: id (uuid), email (text), name (text), avatar_url (text), signup_ip_hash (text), signup_user_agent_hash (text), signup_fingerprint (text), email_verified_at (timestamptz), created_at, updated_at.

`workspaces`: id (uuid), name (text), slug (text), plan_id (text), created_at, updated_at, deleted_at.

`subscriptions`: id (uuid), workspace_id (uuid FK), plan_id (text), status (text), payment_provider (text), provider_subscription_id, provider_customer_id, credits_per_cycle (integer), current_cycle_credits_remaining (integer), current_cycle_started_at (timestamptz), current_cycle_ends_at (timestamptz), cancellation_scheduled_at, cancelled_at, created_at, updated_at.

`credit_balances`: workspace_id (uuid PK FK), balance (integer), signup_balance (integer), signup_expires_at (timestamptz), subscription_balance (integer), subscription_expires_at, pack_balance (integer), admin_balance (integer), admin_expires_at, updated_at.

`credit_transactions`: id (uuid), workspace_id, user_id, type (text), source (text), amount (integer), analysis_id (text), pipeline_id (text), pack_purchase_id (uuid), subscription_id (uuid FK), idempotency_key (text), reason (text), metadata (jsonb), created_at.

`credit_packages`: id (uuid), sku (text), name (text), credits (integer), price_brl_cents (integer), price_usd_cents (integer), validity_days (integer), active (boolean), display_order (integer), created_at.

`pack_purchases`: id (uuid), workspace_id, user_id, package_id (uuid FK), credits_granted, credits_remaining, expires_at, payment_provider, payment_id, amount_paid_cents, currency, status, activated_at, expired_at, created_at.

`pipeline_costs`: pipeline_id (text PK), cost_credits (integer), estimated_real_cost_brl (decimal 10,2), description (text), active (boolean), effective_from (timestamptz), updated_at, updated_by_user_id (uuid FK).

`analyses`: id, workspace_id, user_id, pipeline_id (text), status, input_type, input_url, input_text, video_duration_seconds (integer), credits_consumed (integer), credit_transaction_id (uuid FK), trigger_job_id (text), error_message, started_at, completed_at, created_at, updated_at.

(Demais tabelas seguem padroes equivalentes; lista completa em `src/lib/db/schema/*.ts`.)

---

## 4. RLS

`src/lib/db/rls.sql`:

- **`ENABLE ROW LEVEL SECURITY` ocorrencias:** **45** ✅
- Total tables (§3): **45**
- **Tabelas sem RLS:** **nenhuma** ✅ — perfeito alinhamento.
- Linhas totais com `CREATE POLICY` ou `ALTER TABLE` no arquivo: 101.

---

## 5. Seeds

Localizacao: `src/lib/db/seeds/index.ts` (unico arquivo).

| Trecho           | Conteudo                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creditPackages` | Insere 3 packs: `pack_100` (100 creditos / R$ 149,00 / 60d), `pack_300` (300 / R$ 399 / 60d), `pack_700` (700 / R$ 899 / 60d) ✅                                                                        |
| `pipelineCosts`  | Insere 7 pipelines: `analisar.video_ad` (1c), `comparar.analyses` (2c), `variar.video_ad` (3c), `analisar.deep` (7c), `modelar.sales_page` (8c), `analisar.sales_page` (9c), `modelar.youtube` (11c) ✅ |
| `featureFlags`   | Insere 5 flags: `estudio_quick_enabled`, `estudio_deep_enabled`, `capi_meta_enabled`, `affiliates_enabled`, `google_ads_enabled`                                                                        |

Cobertura exata do snapshot esperado: 7 pipelines ✅, 3 packs ✅. Bonus: 5 feature flags.

---

## 6. Auth

**`src/lib/supabase/client.ts`** — usa `createClient` de `@supabase/supabase-js` (cliente legacy). **Nao usa `@supabase/ssr`** ⚠️. Funcao exportada: `createBrowserClient()` (apesar do nome, usa `createClient` direto, nao o helper SSR).

**`src/lib/supabase/server.ts`** — usa `createClient` de `@supabase/supabase-js`. Define:

- `createServerClient()` — instancia com `SUPABASE_SERVICE_ROLE_KEY` no escopo do modulo ⚠️ (service_role exposto em qualquer chamada server-side)
- `createAnonServerClient()` — anon
- `getSession()` — usa `supabase.auth.getSession()` ⚠️ (Supabase recomenda `getUser()` no servidor; getSession nao revalida com Auth Server)
- `getUser()` — wrap de `getSession().user`
- `requireAuth()` — redirect para `/login` se sem user

**`src/middleware.ts`** — gera `x-correlation-id`, faz rewrite de subdominios `app.criation.io` → `/(app)` e `adm.criation.io` → `/(admin)`. **Nao protege** rotas (sem checagem de cookie/sessao). Matcher exclui assets estaticos.

**Pages (`src/app/`):**

- `(public)/page.tsx` — landing
- `(public)/demo/page.tsx`
- `(public)/precos/page.tsx`
- `(app)/dashboard/page.tsx`
- `(app)/estudio/page.tsx`
- `(admin)/overview/page.tsx`
- `(admin)/admin/design-system/page.tsx`
- `api/health/route.ts`
- `api/webhooks/.gitkeep` (placeholder)

**Pasta `src/app/(auth)/` ou `(public)/login`:** ❌ ABSENT — nao existe pagina de login. `requireAuth()` faz redirect para `/login` que nao existe.

---

## 7. Design system

**`src/app/globals.css`:**

**Variaveis dentro de `@theme inline { }`:**
`--font-sans`, `--font-mono`, `--text-{2xs,xs,sm,base,md,lg,xl,2xl,3xl,4xl}` (e cada `--line-height`), `--radius-{xs,sm,md,lg,xl,2xl}`, `--default-transition-duration`, `--default-transition-timing-function`, `--color-bg`, `--color-bg-elevated`, `--color-bg-muted`, `--color-bg-subtle`, `--color-bg-emphasis`, `--color-fg`, `--color-fg-muted`, `--color-fg-subtle`, `--color-fg-disabled`, `--color-fg-on-accent`, `--color-border`, `--color-border-strong`, `--color-border-focus`, `--color-accent`, `--color-accent-hover`, `--color-accent-active`, `--color-accent-subtle`, `--color-accent-muted`, `--color-success`, `--color-success-bg`, `--color-success-border`, `--color-warning`, `--color-warning-bg`, `--color-warning-border`, `--color-danger`, `--color-danger-bg`, `--color-danger-border`, `--color-info`, `--color-info-bg`, `--color-info-border`, `--color-bottleneck-creative`, `--color-bottleneck-creative-bg`, `--color-bottleneck-creative-border`, `--color-bottleneck-page`, `--color-bottleneck-page-bg`, `--color-bottleneck-page-border`, `--color-bottleneck-audience`, `--color-bottleneck-audience-bg`, `--color-bottleneck-audience-border`, `--color-bottleneck-offer`, `--color-bottleneck-offer-bg`, `--color-bottleneck-offer-border`, `--color-signal-{green,amber,red,gray}`, `--color-chart-{1..8}`.

**Variaveis dentro de `:root { }` regular:** `--color-funnel-1` ... `--color-funnel-8` (8 vars).

**`[data-theme='light'] { }`:** sobrescreve a maioria das semanticas para light mode.

**Checks:**

- 8 `--color-funnel-N` em `:root` (fora do `@theme`) ✅ (ultima fix d220244)
- 4 vars de bottleneck (`creative`, `page`, `audience`, `offer`) + variantes `-bg` e `-border` — **ainda dentro de `@theme inline`** ⚠️ (snapshot esperado: deveriam ter sido movidas tambem para `:root` por consistencia com a logica de tree-shake)

**Files em `src/components/product/`:** `BottleneckBadge.tsx`, `EmptyState.tsx`, `FunnelPyramid.tsx`, `MetricCard.tsx`, `PageHeader.tsx`, `SignalDot.tsx`, `SplashLogo.tsx`.

**Files em `src/components/ui/`:** `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `select`, `sheet`, `skeleton`, `sonner`, `table`, `tabs`, `tooltip` (`.tsx` cada).

**Uso de `dark:` prefix em `.tsx`:** **6 ocorrencias** distribuidas em 6 arquivos:

- `src/app/(admin)/overview/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/estudio/page.tsx`
- `src/app/(public)/demo/page.tsx`
- `src/app/(public)/precos/page.tsx`
- `src/components/ui/card.tsx`

⚠️ Conflito: o sistema usa `[data-theme='light']` (atributo, nao `dark` class). Tailwind v4 sem config de `dark:` configurado para `data-theme` faz com que esses prefixos nao funcionem. Provavel debt de UI gerado por scaffolding inicial — listado em HIGH-002 do snapshot.

---

## 8. `src/env.ts`

Todas as vars sao `.optional()`. Especifico:

| Var                                                                           | Server/Client | Tipo                       | Required?              |
| ----------------------------------------------------------------------------- | ------------- | -------------------------- | ---------------------- |
| `NODE_ENV`                                                                    | server        | enum default `development` | required (com default) |
| `DATABASE_URL`                                                                | server        | `z.url().optional()`       | ⚠️ optional            |
| `SUPABASE_SERVICE_ROLE_KEY`                                                   | server        | `.optional()`              | ⚠️ optional            |
| `ANTHROPIC_API_KEY`                                                           | server        | `.optional()`              | optional               |
| `TRIGGER_SECRET_KEY`                                                          | server        | `.optional()`              | optional               |
| `TRIGGER_API_URL`                                                             | server        | `.optional()`              | optional               |
| `RESEND_API_KEY`                                                              | server        | `.optional()`              | optional               |
| `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`                             | server        | `.optional()`              | optional               |
| `BETTERSTACK_SOURCE_TOKEN`                                                    | server        | `.optional()`              | optional               |
| `ASAAS_API_KEY`/`ASAAS_WEBHOOK_SECRET`                                        | server        | `.optional()`              | optional               |
| `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`                                   | server        | `.optional()`              | optional               |
| `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`                           | server        | `.optional()`              | optional               |
| `NEXT_PUBLIC_APP_URL`                                                         | client        | `.optional()`              | optional               |
| `NEXT_PUBLIC_APP_DOMAIN`/`NEXT_PUBLIC_ADMIN_DOMAIN`                           | client        | `.optional()`              | optional               |
| `NEXT_PUBLIC_SUPABASE_URL`                                                    | client        | `.optional()`              | ⚠️ optional            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                               | client        | `.optional()`              | ⚠️ optional            |
| `NEXT_PUBLIC_SENTRY_DSN`/`NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` | client        | `.optional()`              | optional               |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                          | client        | `.optional()`              | optional               |

**`ENCRYPTION_KEY`/`ENCRYPTION_KEY_V1`/`ENCRYPTION_VERSION`:** ❌ **ABSENT em `env.ts`** — apenas lidos via `process.env` direto em `src/lib/encryption.ts`. Nao validados.

**HIGH-002 confirmado:** vars criticas (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) marcadas `.optional()` — ausentes em runtime so quebram quando o codigo de fato usa, em vez de falhar no boot.

---

## 9. Encryption

**`src/lib/encryption.ts`:**

- Algoritmo: **AES-256-GCM** ✅
- Versionamento: SIM — prefixo `version:` no ciphertext (`v1:iv:authTag:encrypted`).
- KEK/DEK pattern: **NAO** — apenas single-key com rotacao versionada. Nao ha envelope encryption (DEK por linha encriptada com KEK central). Note que ADR-010 propoe envelope encryption mas implementacao atual usa key direta. ⚠️
- Le de `process.env` diretamente (nao do `env`). ⚠️ (Regra 6 implicita: usar `env.ts`).
- Funcoes exportadas: `encrypt()`, `decrypt()`, `reEncryptIfNeeded()`.

**Tests em `src/lib/encryption.test.ts`:** **6 testes** (todos passando).

1. encrypts and decrypts back to original
2. produces different ciphertexts for the same input (random IV)
3. ciphertext starts with current version prefix (`v1:`)
4. decrypts values encrypted with previous key version (cross-version decrypt)
5. reEncryptIfNeeded rotates when version differs
6. reEncryptIfNeeded does not rotate when version matches

---

## 10. Logger e correlation

**`src/lib/logger.ts`:**

- Pino: SIM ✅
- Domain loggers exportados: `logger`, `authLogger`, `billingLogger`, `analysisLogger`, `capiLogger`, `dbLogger` ✅
- Redact paths: `*.email`, `*.password`, `*.token`, `*.key`, `*.secret`, `*.cpf`, `*.phone`, `*.ip`, `email`, `password`, `token`.
- Mixin: injeta `correlationId` automaticamente via `getCorrelationId()`.
- Transport: `pino-pretty` em development, raw em production.

**`src/lib/correlation.ts`:**

- AsyncLocalStorage: SIM ✅ (`correlationStorage`)
- Funcoes: `getCorrelationId()`, `generateCorrelationId()` (sem `runWithCorrelation`)

**Callers de `correlationStorage.run()` / `.enterWith()` / `runWithCorrelation()`:**

- `grep -rn` em `src/`: **0 ocorrencias** ⚠️ HIGH-001 confirmado.
- O middleware gera `x-correlation-id` e seta no header da request/response, mas **nao popula** o AsyncLocalStorage.
- Resultado: `getCorrelationId()` sempre retorna um UUID novo (fallback no `?? crypto.randomUUID()`), e o ID no logger nunca bate com o ID do header.

---

## 11. Docs

**`find docs -maxdepth 2 -type f`:**

- `docs/domain-glossary.md`
- `docs/onboarding.md`
- `docs/design/principles.md`
- `docs/adr/ADR-001-...md` ate `ADR-010-...md` (10 arquivos)
- `docs/audits/` — vazio (este arquivo sera o primeiro)

**`CLAUDE.md` no root:** SIM. Top-level headers (apenas `^# ` e `^## `):

- `# CLAUDE.md — Criation.io`
- `## 1. Stack Tecnica`
- `## 2. Comandos Essenciais`
- `## 3. Regras de Arquitetura (as 20 leis)`
- `## 4. Anti-padroes (nunca faca)`
- `## 5. Convencoes de Nomenclatura`
- `## 6. Padroes de Commit (Conventional Commits)`
- `## 7. Padrao de Branches`

**`AGENTS.md` no root:** SIM. Agents:

- `reviewer`
- `tester`
- `doc-writer`
- `prompt-engineer`
- `migration-writer`

**Grep de keywords em CLAUDE.md:**

- `criation-io-arquitetura-v06` — ❌ AUSENTE
- `Parte 4` — ❌ AUSENTE
- `créditos` — ❌ AUSENTE
- `creditos` — ❌ AUSENTE
- `credits` — ❌ AUSENTE
- `pipeline_costs` — ❌ AUSENTE

⚠️ **Surpresa:** o CLAUDE.md nao menciona o sistema de creditos em lugar nenhum, embora ele esteja completo no schema (§3) e nos seeds (§5).

**ADRs em `docs/adr/`:** 10 arquivos.
| Arquivo | Titulo |
|---|---|
| ADR-001 | Next.js App Router vs Pages Router |
| ADR-002 | Drizzle ORM vs Prisma |
| ADR-003 | Gateway como Fonte da Verdade para Conversoes |
| ADR-004 | Server Actions Thin + Services Pattern |
| ADR-005 | UTM Stitcher em Cascata de 5 Niveis |
| ADR-006 | Multi-tenancy com Workspaces e RLS |
| ADR-007 | Roteamento Asaas + Stripe por Pais |
| ADR-008 | Trigger.dev v3 para Jobs Assincronos |
| ADR-009 | Politica de Uso da service_role_key |
| ADR-010 | Envelope Encryption para Credenciais |

**`docs/audits/AUDIT_2026-05-04_pre-session-1.1.md`:** ❌ NAO EXISTE. Pasta `docs/audits/` esta vazia. (Snapshot esperava 24 findings pre-1.1; este arquivo de auditoria de hoje sera o primeiro registro.)

---

## 12. CI/CD e tooling

**`.github/workflows/`:**
| Arquivo | Proposito |
|---|---|
| `ci.yml` | 4 jobs em paralelo+seq: `lint` (eslint), `typecheck` (tsc --noEmit), `test` (vitest), `build` (depende dos 3, com `SKIP_ENV_VALIDATION=true`) — em push de qualquer branch e PR para main |
| `deploy-preview.yml` | Em PR (open/sync/reopen): `vercel pull` + `vercel build` + `vercel deploy --prebuilt` e comenta URL na PR |

**`.claude/skills/`:**

- `README.md` — index de skills
- `frontend-design/SKILL.md` — skill instalada localmente

**MCP config (`.mcp.json` / `.claude/mcp.json` / `.cursor/`):** ❌ NAO encontrado — busca em `.mcp.json`, `.claude/mcp.json`, `.cursor/` retornou vazio. (MCPs mencionados no system-reminder vem do harness do Claude Code, nao do repositorio.)

**Outros tools:**

- `.husky/` — `commit-msg`, `pre-commit`
- `.prettierrc`, `commitlint.config.js`, `eslint.config.mjs`, `vitest.config.ts`, `drizzle.config.ts`, `next.config.ts`, `postcss.config.mjs`, `vercel.json`, `tsconfig.json`, `components.json`

---

## 13. Sessao 0.4 + later fixes

**`src/components/product/FunnelPyramid.tsx`:** **293 linhas**. Estrutura:

- Tipos: `FunnelStage` (id, label, value, format, conversionFromPrevious, delta, bottleneckType, inlineMetric)
- Props: `FunnelPyramidProps` com `stages`, `selectedStageId`, `onSelectStage`, `loading`, `bottleneckDiagnosis`, `onAnalyzeBottleneck`
- **Drop-off badges:** SIM (formatLost com setas/sinais)
- **Inline metrics:** SIM (`stage.inlineMetric` ou conversionFromPrevious)
- **Conditional bottleneck banner:** SIM (`bottleneckDiagnosis` + `BottleneckPulseDot` + botao `Analisar gargalo`)
- Skeleton loading (8 barras decrescentes)
- Trending icons (`TrendingDown`, `TrendingUp`, `Minus` de lucide)

**Theme toggle:** `src/app/(admin)/admin/design-system/_components/theme-toggle.tsx` (47 linhas).

- **`mounted` guard pattern:** SIM ✅ — usa `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` para hidratar `mounted=true` so apos client mount. Renderiza placeholder `opacity-0` enquanto `!mounted`.
- (Nao existe um theme toggle global em `src/components/`; o unico esta no design-system playground.)

**`src/app/layout.tsx`:** `<html ... suppressHydrationWarning>` SIM ✅.

---

## 14. Build status

| Check               | Resultado | Detalhe                                       |
| ------------------- | --------- | --------------------------------------------- |
| `pnpm tsc --noEmit` | ✅ PASS   | Exit 0, sem erros                             |
| `pnpm lint`         | ✅ PASS   | Exit 0, 0 warnings                            |
| `pnpm test`         | ✅ PASS   | 3 test files, 25 tests, todos passando, 622ms |

**Test files:**

- `src/lib/encryption.test.ts` (6 testes — §9)
- `src/lib/utils/index.test.ts`
- `src/lib/utils/format.test.ts`

(Total 25 — encryption (6) + 19 entre os dois utils.)

`pnpm build` NAO foi executado conforme regra.

---

## 15. Discrepancias vs snapshot esperado

Snapshot esperado declarava: Sessoes 0.1/0.2/0.3/0.4 v2 + post-fixes complete; Next 16 + React 19 + Tailwind v4 + Drizzle + Supabase legacy (sem ssr); neverthrow instalado mas nao usado; 24 findings pre-1.1 (3 CRIT + 5 HIGH + restante triaged).

### Confirmacoes (alinhamento com snapshot)

- ✅ Sessao 0.1/0.2/0.3/0.4 v2 + post-fixes presentes nos commits.
- ✅ Next.js **16.2.4** instalado, React 19.2.4, Tailwind 4.2.4.
- ✅ Drizzle 0.45.2.
- ✅ Supabase legacy (`@supabase/supabase-js` 2.105.1).
- ✅ `@supabase/ssr` ausente.
- ✅ `neverthrow` 8.2.0 instalado, **0 imports** em `src/`.
- ✅ 45 tabelas, RLS em todas.
- ✅ Schema de creditos completo (5 tabelas snapshot + 2 extras).
- ✅ Seeds: 7 pipelines + 3 packs + 5 feature flags.
- ✅ Build verde (TS/lint/test).
- ✅ FunnelPyramid sofisticado com drop-off + inline metrics + bottleneck banner.
- ✅ `suppressHydrationWarning` no `<html>`.
- ✅ Theme toggle com mounted guard.
- ✅ 8 funnel vars em `:root` (fora de `@theme`).

### Divergencias (`⚠️` ou `❌`)

1. ⚠️ **CLAUDE.md fora de sincronia com stack:** declara "Next.js **15** (App Router, React 19, Server Components por padrao)" mas instalado e Next 16.2.4. Atualizar header da Stack Tecnica.

2. ⚠️ **CLAUDE.md sem mencao a creditos:** schema tem `credit_balances/credit_transactions/credit_packages/pack_purchases/pipeline_costs/pipeline_costs_history`; seeds populam 7 pipelines com custo em creditos; mas CLAUDE.md nao tem nenhuma das keywords (`criation-io-arquitetura-v06`, `Parte 4`, `créditos`, `creditos`, `credits`, `pipeline_costs`). Logica de negocio modelada em DB sem documentacao de produto correspondente.

3. ❌ **`docs/audits/AUDIT_2026-05-04_pre-session-1.1.md` nao existe.** A pasta `docs/audits/` esta vazia ate este arquivo. Os 24 findings (3 CRIT / 5 HIGH / 16 med-low) referenciados no snapshot nao foram materializados em arquivo.

4. ⚠️ **Codigo de aplicacao para creditos AUSENTE.** Schema + seeds existem, mas em `src/`:
   - 0 services consumindo `creditBalances`/`creditTransactions`/`pipelineCosts` (grep nao encontra `creditBalances`, `creditTransactions`, `pipelineCosts`, `packPurchases` fora do schema/seeds/index).
   - 0 queries em `src/lib/db/queries/` (a pasta nao existe).
   - 0 actions ou route handlers manipulando creditos.
   - Conclusao: dominio de creditos foi **modelado em DB ainda nao integrado**. Nao foi "abandonado", apenas nao implementado na camada de aplicacao.

5. ❌ **`src/lib/db/queries/` nao existe.** Regra 3 do CLAUDE.md exige queries Drizzle nesse path. Pasta inteira ausente.

6. ❌ **`src/lib/errors/AppError.ts` nao existe.** Regra 7 do CLAUDE.md exige discriminated union de AppError. Pasta `src/lib/errors/` inexistente. (Nao ha services ainda para retornar `Result<T, AppError>`, mas o tipo deveria existir.)

7. ❌ **Nenhuma pagina de login.** `src/lib/supabase/server.ts::requireAuth()` faz redirect para `/login`, mas nao existe `src/app/login` nem `src/app/(public)/login` nem `src/app/(auth)/login`. Auth flow completamente inexistente fora do server util.

8. ⚠️ **`getSession()` no servidor (em vez de `getUser()`):** `src/lib/supabase/server.ts` chama `supabase.auth.getSession()`. Supabase recomenda `getUser()` no SSR (revalida com Auth Server). Combinado com a ausencia de `@supabase/ssr`, isto e parte do CRIT-Supabase-ssr-migration.

9. ⚠️ **`createServerClient()` usa `service_role_key` no escopo modulo.** Toda chamada a esta funcao bypassa RLS sem audit log. Conflita com Regra 4 (CLAUDE.md) e ADR-009. Provavel CRIT.

10. ⚠️ **Bottleneck vars ainda dentro de `@theme inline`:** snapshot esperava-as movidas para `:root` por consistencia com a fix dos funnel vars. As 4 vars + variantes `-bg`/`-border` permanecem em `@theme`. Risco de tree-shake ainda existe se uso for via `var(--color-bottleneck-${type}-bg)` dinamico.

11. ⚠️ **`dark:` prefix em 6 arquivos** com sistema baseado em `[data-theme='light']`. Classes `dark:*` nao se aplicam (Tailwind v4 default reage a `prefers-color-scheme` ou class `dark`, nao a `data-theme`). Listar arquivos: ver §7. HIGH confirmado.

12. ⚠️ **`correlation.ts` orfao:** `correlationStorage` definido mas **nenhum** caller chama `.run()`/`.enterWith()`/`runWithCorrelation()`. Middleware gera ID em header sem popular ALS. `getCorrelationId()` cai sempre no fallback `crypto.randomUUID()`. Logs nao tem ID consistente. HIGH-001 confirmado.

13. ⚠️ **`env.ts` com vars criticas `.optional()`:** `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` todas optional. Build com `SKIP_ENV_VALIDATION=true`. Em runtime, primeiro acesso ao DB/Supabase quebra com mensagem ad-hoc em vez de falhar no boot. HIGH-002 confirmado.

14. ⚠️ **`encryption.ts` le `process.env` direto** (nao do `env.ts`), e `ENCRYPTION_KEY`/`ENCRYPTION_KEY_V1`/`ENCRYPTION_VERSION` ausentes em `env.ts`.

15. ⚠️ **ADR-010 propoe envelope encryption (KEK/DEK)**, mas implementacao em `encryption.ts` e single-key versionada (sem DEK por linha). Divergencia ADR vs codigo.

16. ⚠️ **Pacotes instalados sem uso em src/:** `@sentry/nextjs`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `posthog-js`, `zustand`, `@trigger.dev/sdk`, `neverthrow`, `pino-pretty` (este e usado via string runtime, ok). 7 pacotes "dormentes" nao integrados.

17. ❌ **Pacotes do CLAUDE.md NAO instalados:** `inngest`, `resend`, `@upstash/*`, `stripe`, qualquer SDK Asaas. CLAUDE.md prescreve mas nao estao no `package.json` nem no lockfile.

18. ⚠️ **Subscription columns naming differs from snapshot:** `current_cycle_started_at`/`current_cycle_ends_at` (no schema) vs `current_cycle_start`/`current_cycle_end` (no snapshot). Funcionalmente equivalente.

19. ⚠️ **Users columns naming differs from snapshot:** `signup_user_agent_hash`/`signup_fingerprint` (no schema) vs `user_agent_hash`/`fingerprint` (no snapshot). Funcionalmente equivalente.

20. ⚠️ **`validate-pipeline-costs.js` na raiz** (untracked). 19KB, parece ser script de validacao do `pipeline_costs`. Nao integrado ao CI nem ao `package.json`. Decidir: incorporar a `scripts/`, deletar, ou ignorar via `.gitignore`.

21. ⚠️ **`package-lock.json` na raiz** (untracked). Conflita com pnpm (lockfile da `pnpm-lock.yaml`). Provavel residuo de `npm install` acidental. Anti-padrao Regra (pnpm obrigatorio).

22. ⚠️ **`drizzle/migrations/0000_perpetual_salo.sql`:** uma unica migration inicial. Nao ha sequencia de zero-downtime migrations 3-PR (Regra 16) ainda — esperado, mas notar que o setup foi `db:push` direto, nao migrations versionadas (consistente com schema-first em fase inicial).

23. ⚠️ **Ausencia de MCP config no repo.** Snapshot nao especificou explicitamente, mas dado o uso intenso do Claude Code, nao ha `.mcp.json`/`.cursor/mcp.json` versionado. Setup MCP esta no harness global do dev.

24. ⚠️ **`_perpetual_salo` migration name** — nome auto-gerado pelo drizzle-kit; cosmetico mas dificulta tracking de qual sessao gerou.

**Resumo numeric:**

- Itens ABSENT (`❌`): **6** (6, 5, 7, 17 + entradas ABSENT da tabela §2: `@supabase/ssr`/`inngest`/`resend`/`@upstash`/`stripe`/Asaas + audit pre-1.1 inexistente).
- Divergencias `⚠️`: **18+** marcadas explicitamente acima.
