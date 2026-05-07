# Tech Debt — Itens conhecidos por sessao

Catalogo de itens deferidos. Cada item tem **gate** explicito (quando precisa estar feito para destravar o proximo passo) e **razao** de adiamento.

## Decisoes de infra resolvidas (2026-05-07)

Estas nao sao itens de divida — sao decisoes ja aplicadas, registradas aqui para rastreabilidade.

- **Supabase em `sa-east-1` (Sao Paulo).** Migrado de `us-west-2` para reduzir RTT cliente -> DB no publico-alvo (BR). Ref atual: `kxcljhjnpizznzdcgiyt`. Combina com Vercel `gru1` (vide CLAUDE.md §1).
- **Data API desabilitada no novo projeto.** Acesso ao Postgres exclusivamente via Drizzle/postgres-js + Supavisor (transaction pooler porta 6543 para runtime, sessao 5432 para drizzle-kit/migrations). Decisao reduz superficie de ataque e for a as RLS a viver no Postgres, nao numa camada PostgREST paralela.
- **`drizzle.config.ts` agora carrega `.env.local` antes de ler `process.env`.** Mesma correcao em `src/lib/db/seeds/index.ts` e `scripts/research/validate-pipeline-costs.js`.
  - **Root cause:** drizzle-kit (CLI), `tsx` (seed) e `node` (validate-pipeline-costs) rodam fora do runtime Next.js. Apenas `next dev`/`next build` carregam `.env.local` automaticamente. Sem o loader, `process.env.DATABASE_URL` ficava `undefined` e drizzle-kit caia com `url: undefined`.
  - **Correcao:** `process.loadEnvFile(resolve(cwd, '.env.local'))` (Node 20.12+/24, com feature-detection). Em `seeds/index.ts`, os imports de `../index` e `../schema` foram movidos para dynamic import dentro de `seed()` para garantir que o loader rode antes da avaliacao de `db/index.ts` (que le `DATABASE_URL` no top-level).
  - **Por que nao adicionar `dotenv`:** API nativa do Node cobre o caso e nao adiciona dep. Se algum dia precisarmos de cascata `.env` -> `.env.local` -> `.env.production.local`, reavaliar.

## Pre-Fase 0 / Fase 0

| Item                                           | Razao de adiar                                                                   | Gate                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Migracao KEK/DEK envelope encryption (ADR-010) | Fase 0/1 nao tem token OAuth de cliente persistido — vetor de ataque inexistente | **Antes da Sessao 1.3** (primeiro OAuth Meta token persistido) — bloqueante |

## Fase 1 — Sessao 1.1 (criados em 2026-05-07)

| Item                                                               | Razao de adiar                                                                              | Gate                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| haveibeenpwned password check                                      | Padrao de senha (10+ chars, letra+digito) ja eh razoavel; HIBP adiciona dependencia externa | Antes de promover qualquer usuario a admin                               |
| 2FA TOTP (admin/super_admin)                                       | Nao ha admin promovido ainda no MVP                                                         | Antes de promover qualquer admin (Sessao 3.x — admin shell)              |
| OAuth Google login                                                 | Reduzir surface area da 1.1                                                                 | Reavaliar em 2.x (oportunidade UX)                                       |
| Convite por token (workspace_invites)                              | Nao ha feature de colaboradores                                                             | Sessao 2.11 (collaborators)                                              |
| Click IDs middleware (fbclid/gclid/ttclid/msclkid) — TTL 90d       | Nao ha CAPI ainda                                                                           | **Sessao 1.4.9 (CAPI)** — bloqueante                                     |
| CSRF double-submit cookie + header validation                      | Server Actions tem protecao Origin nativa do Next                                           | Antes de Route Handlers admin (`/admin/impersonate` em 3.x) — bloqueante |
| DIY signup verification + reset emails via Resend (templates JSX)  | Supabase SMTP padrao funciona; React Email renderer ja instalado para Welcome               | Sessao 1.14.5 (Compliance) — configurar Supabase Auth Hooks              |
| `users.created_at` sem `withTimezone: true`                        | Schema legacy, nao bloqueia funcionalidade                                                  | Migration aditiva agendar para fim da Fase 1 (1.15 polish)               |
| Resend response unhappy-path retry                                 | Falhas atuais apenas logadas                                                                | Antes de 1.5 (onboarding wizard depende de email confiavel)              |
| `proxy.ts` em vez de `middleware.ts` (Next 16 deprecation warning) | Funcional; rename trivial mas nao bloqueia                                                  | Antes de 1.5 (final cleanup pre-onboarding)                              |

## Fase 1 — Sessao 1.1 — testes diferidos

| Item                                                                                       | Cobertura atual                                                    | Gate                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Vitest signup.test.ts (happy path + email duplicado + senha curta + honeypot + rate limit) | Validators cobertos via `auth.test.ts`; flow completo no smoke 1.1 | Sessao 1.7.5 (full creditService coverage) ou 1.15 polish                             |
| Vitest login.test.ts (happy + senha errada + email nao verificado + rate limit)            | Validators cobertos; flow no smoke                                 | Idem                                                                                  |
| Vitest reset.test.ts (request + token valido + token expirado)                             | Validators cobertos; flow no smoke                                 | Idem                                                                                  |
| Vitest anti-fraude.test.ts (4 signups mesmo IP -> audit_logs entry)                        | Logica testavel; precisa stub de Supabase signUp + DB seed         | Sessao 1.5 (onboarding) — combinar com testes de signup_bonus expiration              |
| Playwright E2E `e2e/auth/{signup-completo,login-flow,reset-senha}.spec.ts`                 | Coberto por smoke manual em SMOKE_1.1                              | Sessao 1.15 (polish + smoke automatizado pre-Fase 2) — bloqueante para gate da Fase 1 |
| Vitest credit.service.test.ts (DB-bound — idempotency, balance increment)                  | Apenas validacao de input testada                                  | Sessao 1.7.5 (full creditService implementation)                                      |

## Sessao 1.1 — observabilidade diferida

| Item                                                                        | Razao                                                                    | Gate                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Correlation ID propagacao via AsyncLocalStorage (HIGH-001 do audit pre-1.1) | `correlation.ts` define o storage mas ninguem chama `runWithCorrelation` | **Sessao 1.2** (Logging & Observability sub-sessao) |
| Sentry instrumentation em Server Actions                                    | Sentry instalado mas nao integrado                                       | Sessao 1.2                                          |
| PostHog analytics events para signup/login/verify                           | PostHog instalado dormente                                               | Sessao 1.5 (onboarding — primeiros eventos uteis)   |

## Pre-deploy producao

| Item                                                                          | Razao                                          | Gate                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `next.config.ts` headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options) | Stub atual sem headers                         | Antes de qualquer deploy publico              |
| `src/lib/db/rls.sql` migrar para migration numerada Drizzle                   | Standalone fora do drizzle-kit; risco de drift | Antes de Fase 2 (quando RLS comeca a evoluir) |

## Polish (LOW priority)

| Item                                                                    | Razao                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `dialog.tsx` e `sheet.tsx` overlay com `bg-black/80` hardcoded          | Token `--color-overlay` nao existe ainda             |
| `Skeleton` sem `aria-busy="true"` e `role="status"`                     | A11y polish — ja funciona com screen readers basicos |
| `ThemeToggle` placeholder com `opacity-0` aparece abruptamente no mount | Adicionar `transition-opacity duration-200`          |

---

## Resumo de prioridades

**Bloqueante para Sessao 1.3:** migracao KEK/DEK (ADR-010)
**Bloqueante para Sessao 1.4.9:** Click IDs middleware
**Bloqueante para Sessao 1.5:** Correlation ID propagacao + Resend retry
**Bloqueante para Sessao 1.15 (Fase 1 close):** E2E Playwright para 3 fluxos criticos
**Bloqueante para 3.x admin:** CSRF double-submit, 2FA TOTP, haveibeenpwned

Itens sem gate explicito sao polish — abordar quando bater no caminho.
