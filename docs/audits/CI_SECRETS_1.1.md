# CI Secrets — Sessao 1.1

GitHub Actions secrets necessarios para CI verde apos merge da Sessao 1.1.

Configurar via: `Settings -> Secrets and variables -> Actions -> New repository secret`.

## Required (sem isso CI fica vermelho)

| Secret                          | Origem                                               | Uso no CI                                             |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                  | Supabase staging connection string                   | `pnpm test` (DB-bound tests futuras), `pnpm build`    |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase staging project URL                         | env validation no build                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase staging anon key                            | env validation no build                               |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase staging service role                        | Tests que usam `createServiceClient()`                |
| `ENCRYPTION_KEY`                | `openssl rand -hex 32` (gerar especifico para CI)    | env validation; testes de encryption                  |
| `UPSTASH_REDIS_REST_URL`        | Upstash dashboard                                    | env validation; testes que importam rate-limit module |
| `UPSTASH_REDIS_REST_TOKEN`      | Upstash dashboard                                    | idem                                                  |
| `HASH_SALT`                     | `openssl rand -base64 32` (gerar especifico para CI) | env validation                                        |

## Optional

| Secret              | Quando precisa                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| `RESEND_API_KEY`    | Quando E2E rodar contra Resend de verdade. Ate la, `vitest.setup.ts` faz fallback. |
| `ANTHROPIC_API_KEY` | Sessao 1.8+ (claude.service tests)                                                 |

## Importante

- **Use Supabase staging, nao prod.** Os tests podem inserir/deletar rows.
- **Gerar `ENCRYPTION_KEY` e `HASH_SALT` especificos para CI.** Nao reutilizar os de dev local — vazamento via logs do CI seria problema.
- **`@supabase/ssr` v0.10 funciona em CI** sem nada extra.

## Apos adicionar

- [ ] Re-rodar workflow do CI no PR atual: `gh workflow run ci.yml -r feat/auth-1.1`
- [ ] Verificar status: `gh pr checks <PR-number>`
- [ ] Se ainda vermelho, debugar via `gh run view <run-id> --log-failed`
