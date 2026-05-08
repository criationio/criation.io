# SMOKE 1.1 — 2026-05-08 (caminho crítico, pós-fixes)

## Contexto

Sessão 1.1 destravada após 3 blocos de fixes. Smoke caminho crítico end-to-end em preview branch-aliased da `feat/auth-1.1`. Audit anterior (`SMOKE_1.1_2026-05-07.md`) registrou smoke parcial pré-bug. Este fecha o ciclo.

## Ambiente

- Branch: `feat/auth-1.1`
- HEAD do smoke: `5ef2098` (caminho crítico)
- HEAD pós-refactor: `e2d63ac` (tech-debt)
- Preview: `criation-io-git-feat-auth-11-criationios-projects.vercel.app`
- User real: `bgeller05@gmail.com`
- Workspace criado: `826f1cd2...`

## Fixes aplicados nesta sessão

| Bloco | Commit    | Data       | Descrição                                                    |
| ----- | --------- | ---------- | ------------------------------------------------------------ |
| 1     | `7214a7b` | 2026-05-07 | Drizzle lazy-init — DATABASE_URL em build-time               |
| 2     | `8df954f` | 2026-05-07 | request-origin helper com allowlist                          |
| 2     | `ae70bf7` | 2026-05-07 | service + callers recebem origin do request                  |
| 3     | `5ef2098` | 2026-05-08 | handle Supabase email rate limit (429) em signupWithPassword |
| docs  | `e2d63ac` | 2026-05-08 | refactor tech-debt.md pra IDs estáveis                       |

## Caminho crítico — evidência end-to-end

| Etapa                                                                                                    | Timestamp (UTC)      | Estado                               |
| -------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| `auth.users` insert                                                                                      | 2026-05-08T10:30:00Z | OK                                   |
| `public.users` mirror + workspace + member                                                               | mesma janela         | OK                                   |
| Email Supabase enviado, user clicou link                                                                 | até 10:30:30Z        | OK                                   |
| `auth.users.email_confirmed_at` server-side                                                              | 10:30:30Z            | OK                                   |
| Handler `/api/auth/callback/verify-email` rodou                                                          | ~10:31Z              | OK — comprova fix Site URL + Bloco 2 |
| `markEmailVerified` → `public.users.email_verified_at`                                                   | 10:31:21Z            | OK                                   |
| `allocate` → `credit_transactions` row natural (key `signup_bonus_<userId>`, trigger=email_verification) | 10:31:21Z            | OK                                   |
| `credit_balances` row: balance=50, signup_balance=50, signup_expires_at=2026-08-06 (~90d)                | 10:31:21Z            | OK                                   |

## Estado de credit_balances pós-smoke

| workspace_id                  | balance | signup_expires_at | origem                       |
| ----------------------------- | ------- | ----------------- | ---------------------------- |
| `826f1cd2...` (bgeller05)     | 50      | 2026-08-06        | flow real email_verification |
| `3404132d...` (vinibenavides) | 50      | 2026-08-06        | backfill manual_backfill     |
| `ce75fb9b...` (me@criation)   | 50      | 2026-08-06        | backfill manual_backfill     |

## Validações implícitas

- Site URL + Additional Redirect URLs Supabase corrigidos (handler ressuscitado)
- Bloco 2 `getRequestOrigin()` derivando origin do request, allowlist aceita `criation-io-git-feat-auth-11-...vercel.app`
- Drizzle lazy-init Bloco 1 funciona em runtime real (handler executou queries DB)
- `creditService.allocate` flow completo (lookup idempotente miss → tx insert → balance upsert → bucket update → log+return)
- Backfill anterior coexistindo sem conflito (idempotency*key suffix `\_backfill*` separa namespace)
- Bloco 3 fix de rate limit `5ef2098` deployado — não exercitado neste smoke (não precisou)

## Notas e observações

- `smoke.burst.1@mailinator.com` (criado 11:05Z, sem confirm) — teste de anti-fraude burst manual. Não foi pra `credit_balances` (correto — só recebe quem confirma email).
- Discrepância visual de timestamps em `credit_transactions.created_at` (mostra 13:31Z) vs `public.users.email_verified_at` (10:31Z) é a inconsistência TIMESTAMPTZ pré-existente já documentada como **TD-012** (`users.created_at` sem `withTimezone: true`). Gate: Sessão 1.15 polish. Não é bug deste smoke.

## Cobertura de testes — gap registrado

Smoke caminho crítico foi manual com user real. Cobertura automatizada do flow signup → callback → allocate ainda é zero. Gap rastreado em:

- **TD-015** — Vitest `signup.test.ts` (gate Sessão 1.7.5 ou 1.15)
- **TD-020** — Vitest `credit.service.test.ts` (DB-bound) (gate Sessão 1.7.5)
- **TD-019** — Playwright E2E auth (signup-completo, login-flow, reset-senha) (gate Sessão 1.15, bloqueante Fase 1)

## TDs novos descobertos nesta sessão

- **TD-029** — `loginWithPassword` `over_request_rate_limit` handling. Descoberto durante diagnóstico do fix `5ef2098`. Não exercitado neste smoke (caminho crítico é signup, não login). Gate: Sessão 2.x.

## Conclusão

Sessão 1.1 caminho crítico VERDE em produção. PR #2 pronto pra merge `feat/auth-1.1` → `develop`.
