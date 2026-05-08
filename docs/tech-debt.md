# Tech Debt — Criation.io

## Convencao

Cada TD tem ID estavel TD-NNN. Numeracao sequencial; IDs nao mudam ao longo do tempo. Status explicito (Open / In Progress / Closed). Severidade explicita (Alta / Media / Baixa). TDs fechados nao somem — vao para `## Closed (historico)` com hash do commit que fechou e data.

Convencao de fechamento:

```
**Status:** Closed (<hash curto>, YYYY-MM-DD)
**Closed em:** Sessao X.Y, [contexto]
**Validacao:** [arquivo de audit ou referencia]
```

Quando o fechamento for decisao de infra (registro documental, sem commit associado), usar `Closed (—, YYYY-MM-DD)` e `Closed em: Decisao de infra`.

Severidade:

- **Alta** — bloqueia producao publica, vulnerabilidade ativa, ou bloqueante declarado de gate de sessao.
- **Media** — divida tecnica genuina com gate distante; impacto futuro previsivel; cobertura faltando.
- **Baixa** — cosmetico, polish, ergonomia.

## Indice

| ID     | Titulo                                                              | Status | Severidade | Gate                                       |
| ------ | ------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------ |
| TD-004 | Migracao KEK/DEK envelope encryption (ADR-010)                      | Open   | Alta       | Sessao 1.3 — bloqueante                    |
| TD-006 | 2FA TOTP (admin/super_admin)                                        | Open   | Alta       | Sessao 3.x — bloqueante                    |
| TD-010 | CSRF double-submit cookie + header validation                       | Open   | Alta       | Sessao 3.x — bloqueante                    |
| TD-019 | Playwright E2E auth (signup-completo, login-flow, reset-senha)      | Open   | Alta       | Sessao 1.15 — bloqueante Fase 1            |
| TD-021 | Correlation ID propagacao via AsyncLocalStorage                     | Open   | Alta       | Sessao 1.2                                 |
| TD-024 | next.config.ts headers (CSP, HSTS, X-Frame-Options, X-Content-Type) | Open   | Alta       | Antes de qualquer deploy publico           |
| TD-005 | haveibeenpwned password check                                       | Open   | Media      | Antes de promover qualquer usuario a admin |
| TD-008 | Convite por token (workspace_invites)                               | Open   | Media      | Sessao 2.11 (collaborators)                |
| TD-009 | Click IDs middleware (fbclid/gclid/ttclid/msclkid) — TTL 90d        | Open   | Media      | Sessao 1.4.9 (CAPI) — bloqueante           |
| TD-011 | DIY signup/reset emails via Resend (templates JSX)                  | Open   | Media      | Sessao 1.14.5 (Compliance)                 |
| TD-013 | Resend response unhappy-path retry                                  | Open   | Media      | Antes de Sessao 1.5                        |
| TD-015 | Vitest signup.test.ts                                               | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-016 | Vitest login.test.ts                                                | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-017 | Vitest reset.test.ts                                                | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-018 | Vitest anti-fraude.test.ts                                          | Open   | Media      | Sessao 1.5 (onboarding)                    |
| TD-020 | Vitest credit.service.test.ts (DB-bound)                            | Open   | Media      | Sessao 1.7.5                               |
| TD-022 | Sentry instrumentation em Server Actions                            | Open   | Media      | Sessao 1.2                                 |
| TD-025 | rls.sql migrar para migration numerada Drizzle                      | Open   | Media      | Antes de Fase 2                            |
| TD-029 | loginWithPassword over_request_rate_limit handling                  | Open   | Media      | Sessao 2.x                                 |
| TD-007 | OAuth Google login                                                  | Open   | Baixa      | Sessao 2.x — reavaliar                     |
| TD-012 | users.created_at sem withTimezone: true                             | Open   | Baixa      | Sessao 1.15 polish                         |
| TD-014 | proxy.ts em vez de middleware.ts (Next 16 deprecation)              | Open   | Baixa      | Antes de Sessao 1.5                        |
| TD-023 | PostHog analytics events para signup/login/verify                   | Open   | Baixa      | Sessao 1.5 (onboarding)                    |
| TD-026 | dialog/sheet overlay com bg-black/80 hardcoded                      | Open   | Baixa      | sem gate                                   |
| TD-027 | Skeleton sem aria-busy e role=status                                | Open   | Baixa      | sem gate                                   |
| TD-028 | ThemeToggle placeholder FOUC no mount                               | Open   | Baixa      | sem gate                                   |

## Open

### TD-004 — Migracao KEK/DEK envelope encryption (ADR-010)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.3 — bloqueante
**Manifesta hoje?** Latente — Fase 0/1 nao tem token OAuth de cliente persistido, vetor de ataque inexistente

**Descricao:** Decisao arquitetural ja documentada em ADR-010 mas nao implementada. Necessaria antes do primeiro OAuth Meta token persistido em meta_connections / google_connections.

**Fix sugerido:** Implementar conforme ADR-010 — KEK em Vercel/Supabase secrets, DEK gerada por workspace, cifrar tokens OAuth no insert.

**Arquivo:** —

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, gate definido em ADR-010

### TD-006 — 2FA TOTP (admin/super_admin)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 3.x (admin shell) — bloqueante
**Manifesta hoje?** Nao — sem admin promovido no MVP

**Descricao:** Supabase Auth tem MFA built-in. ADR-011 prepara migration path: estender no admin shell sem reestruturar. Bloqueante para qualquer promocao de admin.

**Fix sugerido:** Habilitar Supabase MFA, adicionar enrollment flow no admin shell. Forcar enrollment em conta admin antes de aceitar primeiro login privilegiado.

**Arquivo:** —

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, gate definido em ADR-011

### TD-010 — CSRF double-submit cookie + header validation

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 3.x (Route Handlers admin) — bloqueante
**Manifesta hoje?** Nao — Server Actions tem protecao Origin nativa do Next; nenhum Route Handler admin em producao

**Descricao:** Server Actions do Next 16 protegem contra CSRF via verificacao de Origin header. Route Handlers mutantes (POST/PUT/DELETE) precisam de defesa explicita: double-submit cookie + verificacao Origin server-side. CLAUDE.md regra 15.

**Fix sugerido:** Implementar lib/security/csrf.ts com cookie HMAC-SHA256 e wrapper requireCsrf() para Route Handlers admin.

**Arquivo:** —

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, regra 15 do CLAUDE.md

### TD-019 — Playwright E2E auth (signup-completo, login-flow, reset-senha)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.15 (polish + smoke automatizado pre-Fase 2) — bloqueante para gate da Fase 1
**Manifesta hoje?** Latente — coberto por smoke manual em SMOKE_1.1_2026-05-07.md e SMOKE_1.1_2026-05-08.md

**Descricao:** Tres specs E2E necessarios para automatizar caminhos criticos: signup-completo (signup -> email -> verify -> bem-vindo), login-flow (senha errada -> generica, senha certa -> dashboard, magic link), reset-senha (request -> email -> aplicar -> login com nova senha).

**Fix sugerido:** Playwright + Supabase Auth Email com mailbox de teste (mailosaur, mailtrap ou mailinator API). Ambiente de teste isolado com seed de usuarios.

**Arquivo:** e2e/auth/\*.spec.ts (a criar)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, bloqueante de gate Fase 1

### TD-021 — Correlation ID propagacao via AsyncLocalStorage

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.2 (Logging & Observability sub-sessao)
**Manifesta hoje?** Sim — correlation.ts define o storage mas ninguem chama runWithCorrelation; logs nao tem correlationId real propagado, apenas o gerado no middleware

**Descricao:** HIGH-001 do audit pre-1.1. Middleware gera x-correlation-id (UUID v4) e seta em headers, mas o pino logger nao captura via mixin de getCorrelationId() porque AsyncLocalStorage.run nao e ativado.

**Fix sugerido:** Wrapper requestScope() em src/lib/correlation.ts que envelopa o handler em als.run(correlationId, ...). Aplicar em proxy.ts/middleware.ts e em entry points de Server Actions.

**Arquivo:** src/lib/correlation.ts (existe mas inativo)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, HIGH-001 do audit pre-1.1

### TD-024 — next.config.ts headers (CSP, HSTS, X-Frame-Options, X-Content-Type)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Antes de qualquer deploy publico
**Manifesta hoje?** Sim — producao em www.criation.io e preview em \*.vercel.app sem CSP/HSTS

**Descricao:** next.config.ts atual e stub vazio (`const nextConfig: NextConfig = {}`). Sem headers de seguranca aplicados em respostas. Vulneravel a clickjacking, MIME sniffing, ataques de injecao mitigaveis por CSP.

**Fix sugerido:** `headers async () => [{ source: '/(.*)', headers: [...] }]` com Strict-Transport-Security (max-age 1y, includeSubDomains, preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimal, e CSP em report-only inicial.

**Arquivo:** next.config.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-005 — haveibeenpwned password check

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Antes de promover qualquer usuario a admin
**Manifesta hoje?** Nao — sem admin promovido, vetor inexistente

**Descricao:** Padrao de senha atual (10+ chars, letra + digito) ja eh razoavel; HIBP adiciona dependencia externa. Defense in depth para contas privilegiadas quando admins forem promovidos.

**Fix sugerido:** Integrar haveibeenpwned API range query no signup e em update de senha de admins. Cache via Upstash 24h por hash prefix.

**Arquivo:** src/lib/validators/auth.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-008 — Convite por token (workspace_invites)

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 2.11 (collaborators)
**Manifesta hoje?** Nao — feature de colaboradores ainda nao existe

**Descricao:** Tabela workspace_invites criada no schema (token, expires_at, accepted_at) mas o flow end-to-end de envio de convite + aceite ainda nao implementado. Hoje todos os usuarios tem exatamente 1 workspace_member com role=owner.

**Fix sugerido:** Implementar criar/listar/revogar/aceitar conforme Sessao 2.11. Email transacional via Resend, redirect handler em /api/auth/callback similar ao verify-email.

**Arquivo:** src/lib/db/schema/auth.ts (workspaceInvites)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-009 — Click IDs middleware (fbclid/gclid/ttclid/msclkid) — TTL 90d

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.4.9 (CAPI) — bloqueante
**Manifesta hoje?** Nao — CAPI ainda nao implementado, atribuicao nao acontece

**Descricao:** Middleware deve capturar fbclid/gclid/ttclid/msclkid em cookies first-party com TTL de 90 dias para atribuicao tardia em CAPI. Atribuicao degrada se ausente quando CAPI for implementado, mas nao bloqueia signup/login/dashboard hoje.

**Fix sugerido:** Estender src/middleware.ts (ou proxy.ts pos-rename) para detectar query params e setar cookies HttpOnly/Secure/SameSite=Lax.

**Arquivo:** src/middleware.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-011 — DIY signup/reset emails via Resend (templates JSX)

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.14.5 (Compliance) — configurar Supabase Auth Hooks
**Manifesta hoje?** Nao — Supabase SMTP padrao funciona; Welcome email via Resend ja existe

**Descricao:** Hoje o email de verificacao e o reset password vem do template padrao do Supabase Auth (sem branding Criation). Resend + React Email renderer ja instalados (usado em welcome.tsx).

**Fix sugerido:** Configurar Supabase Auth Hooks (Send Email Hook) apontando para webhook que renderiza JSX e dispara via Resend. Templates: Confirmation, Recovery, MagicLink, Invite.

**Arquivo:** src/emails/, src/lib/email/resend.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-013 — Resend response unhappy-path retry

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Antes de Sessao 1.5 (onboarding wizard depende de email confiavel)
**Manifesta hoje?** Latente — falhas atuais apenas logadas (authLogger.error); email perdido se Resend retornar 5xx

**Descricao:** sendTransactional() em src/lib/email/resend.ts retorna `{ ok: false, reason: 'send_failed' }` sem retry. Welcome email no callback verify-email falha silenciosa via .catch(). Para flows criticos (welcome, futuras notificacoes), retry e dead-letter sao necessarios.

**Fix sugerido:** Wrapper com retry exponencial (1s/3s/9s, 3 tentativas) + dead-letter em tabela email_failures para reenvio manual. Ou trocar para Trigger.dev v3 task com retry built-in.

**Arquivo:** src/lib/email/resend.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-015 — Vitest signup.test.ts

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.7.5 (full creditService coverage) ou 1.15 polish
**Manifesta hoje?** Latente — validators cobertos via auth.test.ts; flow completo apenas no smoke manual (SMOKE_1.1_2026-05-07.md, SMOKE_1.1_2026-05-08.md)

**Descricao:** Cobertura unit+integration do flow signup ausente. Cenarios: happy, email duplicado, senha curta/sem digito, honeypot rejeicao silenciosa, rate limit Upstash, rate limit Supabase 429.

**Fix sugerido:** vi.mock('@/lib/supabase/server') + pgmem ou container Postgres. Stub de signUp + DB seed minimo.

**Arquivo:** src/lib/services/auth.service.ts (target dos testes)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-016 — Vitest login.test.ts

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.7.5 ou 1.15 polish
**Manifesta hoje?** Latente — validators cobertos; flow no smoke

**Descricao:** Mesmo gap de cobertura do TD-015 mas para login. Cenarios incluem mensagem generica em senha errada, mensagem especifica em email_not_confirmed, rate limit Upstash. Quando TD-029 fechar, adicionar cenario de rate limit Supabase em login.

**Fix sugerido:** Mesmo padrao do TD-015 com mock de signInWithPassword.

**Arquivo:** src/lib/services/auth.service.ts (target dos testes)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-017 — Vitest reset.test.ts

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.7.5 ou 1.15 polish
**Manifesta hoje?** Latente — validators cobertos; flow no smoke

**Descricao:** Cobertura ausente para requestPasswordReset e updatePassword. Cenarios: request silent-success (anti-enumeration), token valido aplica nova senha, token expirado retorna TOKEN_EXPIRED.

**Fix sugerido:** Mock de resetPasswordForEmail + updateUser. Mesmo padrao dos outros testes diferidos.

**Arquivo:** src/lib/services/auth.service.ts (target dos testes)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-018 — Vitest anti-fraude.test.ts

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.5 (onboarding) — combinar com testes de signup_bonus expiration
**Manifesta hoje?** Latente — logica testavel; precisa stub de Supabase signUp + DB seed

**Descricao:** Validacao de countRecentSignupsByIpHash + insert em audit_logs com event_type=fraud_alert_signup_burst quando count >= 3. Os 4 signups completam normalmente (nao bloqueia).

**Fix sugerido:** Test que executa 4 signups consecutivos com mesmo ipHash, verifica audit_logs row e payload.count.

**Arquivo:** src/lib/services/auth.service.ts (logica D3), src/lib/db/queries/users.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-020 — Vitest credit.service.test.ts (DB-bound)

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.7.5 (full creditService implementation)
**Manifesta hoje?** Latente — apenas validacao de input testada (amount > 0, idempotencyKey present)

**Descricao:** Cobertura DB-bound de allocate ausente. Cenarios: idempotent hit retorna mesmo transactionId, dois allocate concorrentes com keys distintas convergem em balance correto, error handling de unique violation em race lookup-then-insert.

**Fix sugerido:** Test container Postgres + drizzle migrate + seed minimo. Em paralelo aos testes de consume/refund quando 1.7.5 chegar.

**Arquivo:** src/lib/services/credit.service.test.ts (estender)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-022 — Sentry instrumentation em Server Actions

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.2
**Manifesta hoje?** Latente — Sentry instalado dormente; Vercel logs cobrem diagnostico basico (usado no debug de 5ef2098)

**Descricao:** @sentry/nextjs em dependencies mas sem Sentry.init() ativo. Server Actions throws nao capturados estruturadamente; AuthError(INTERNAL) e outras exceptions se perdem em logs Vercel sem stack agregada.

**Fix sugerido:** sentry.server.config.ts + sentry.client.config.ts conforme docs Sentry Next 16. Captura automatica em Route Handlers e Server Actions via wrapper.

**Arquivo:** —

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-025 — rls.sql migrar para migration numerada Drizzle

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Antes de Fase 2 (quando RLS comeca a evoluir)
**Manifesta hoje?** Latente — rls.sql funciona; risco de drift se schema mudar e RLS nao acompanhar

**Descricao:** src/lib/db/rls.sql roda standalone via scripts/db/apply-rls.ts. Drizzle nao gerencia, nao detecta drift. Risco amplifica quando RLS evoluir junto com schema.

**Fix sugerido:** Quebrar rls.sql em migrations Drizzle numeradas (uma por tabela ou por logical group). drizzle-kit nao gera ALTER TABLE ENABLE RLS automaticamente — usar SQL custom em migrations geradas.

**Arquivo:** src/lib/db/rls.sql, scripts/db/apply-rls.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-029 — loginWithPassword over_request_rate_limit handling

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-08, Sessao 1.1
**Gate:** Sessao 2.x
**Manifesta hoje?** Latente — login funciona; rate limit do Supabase em login e cenario menos comum que signup, mas falha generica em INVALID_CREDENTIALS se disparar

**Descricao:** loginWithPassword em src/lib/services/auth.service.ts trata error.code === 'email_not_confirmed' e fall-through generico para INVALID_CREDENTIALS, mas nao trata over_request_rate_limit (HTTP 429 em login). Falhas atuais caem em INVALID_CREDENTIALS, levando o usuario a tentar de novo e amplificar o rate limit. Classe distinta de erro: brute-force de login vs email-send em signup (TD-029 vs commit 5ef2098).

**Fix sugerido:** Branch espelho ao adicionado em signupWithPassword no commit 5ef2098: detectar `error.status === 429` ou `error.code === 'over_request_rate_limit'` e retornar AUTH_ERROR_CODES.RATE_LIMITED com mensagem actionable.

**Arquivo:** src/lib/services/auth.service.ts (loginWithPassword)

**Historico:**

- 2026-05-08: descoberto durante diagnostico do fix 5ef2098 (Bloco 3, signup rate limit). Classe distinta de erro: brute-force de login vs email-send em signup.

### TD-007 — OAuth Google login

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 2.x — reavaliar
**Manifesta hoje?** Nao — UX nice-to-have

**Descricao:** Reduzido da surface area da Sessao 1.1 para focar no caminho critico email/senha + magic link. ADR-011 prepara migration path: signInWithOAuth({ provider: 'google' }) sem refactor.

**Fix sugerido:** Adicionar provider Google em Supabase Auth, button no login-form, configurar redirect_uri no Google Cloud Console.

**Arquivo:** src/app/(auth)/login/login-form.tsx

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-012 — users.created_at sem withTimezone: true

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.15 (polish — fim da Fase 1)
**Manifesta hoje?** Latente — discrepancia visual de timestamps sem impacto funcional (ex: credit_transactions.created_at exibe 13:31Z vs public.users.email_verified_at 10:31Z para o mesmo evento)

**Descricao:** Schema legacy: users, workspaces, workspace_members e algumas outras tabelas usam timestamp sem withTimezone: true. Algumas colunas na mesma tabela usam withTimezone (email_verified_at, joined_at), gerando deslocamento na leitura. CLAUDE.md regra 8 exige TIMESTAMPTZ em todas as colunas de data.

**Fix sugerido:** Migration aditiva: ALTER TABLE ... ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC'. Aplicar em todas as colunas timestamp afetadas.

**Arquivo:** src/lib/db/schema/auth.ts, src/lib/db/schema/billing.ts (parcial), outras

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, baseline schema

### TD-014 — proxy.ts em vez de middleware.ts (Next 16 deprecation)

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Antes de Sessao 1.5 (final cleanup pre-onboarding)
**Manifesta hoje?** Sim — `pnpm dev` e `pnpm build` emitem warning "The middleware file convention is deprecated. Please use proxy instead."

**Descricao:** Next 16 renomeou conceito de middleware para proxy. Funcionamento identico, apenas o filename muda (e o nome do default export). Sem quebra ate o major seguinte.

**Fix sugerido:** Renomear src/middleware.ts -> src/proxy.ts, ajustar src/lib/supabase/middleware.ts para src/lib/supabase/proxy.ts. Manter `export const config` matcher.

**Arquivo:** src/middleware.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-023 — PostHog analytics events para signup/login/verify

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 1.5 (onboarding — primeiros eventos uteis)
**Manifesta hoje?** Nao — PostHog instalado dormente, sem visibilidade de funil

**Descricao:** posthog-js em dependencies. Eventos uteis: signup_attempted, signup_succeeded, email_verified, login_attempted, login_succeeded.

**Fix sugerido:** Init PostHog no client (PostHogProvider em layout). Track events em useEffect ao receber resposta de Server Action ou via queue server-side.

**Arquivo:** —

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-026 — dialog/sheet overlay com bg-black/80 hardcoded

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** sem gate
**Manifesta hoje?** Nao — design system gap

**Descricao:** Token --color-overlay nao existe no design system 3-layer. Componentes shadcn/ui dialog.tsx e sheet.tsx usam bg-black/80 hardcoded.

**Fix sugerido:** Adicionar --color-overlay no token primitive layer + semantic, atualizar dialog.tsx e sheet.tsx para usar bg-[var(--color-overlay)].

**Arquivo:** src/components/ui/dialog.tsx, src/components/ui/sheet.tsx

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-027 — Skeleton sem aria-busy e role=status

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** sem gate
**Manifesta hoje?** Nao — funciona com screen readers basicos

**Descricao:** A11y polish do Skeleton — adicionar aria-busy="true" e role="status" para anunciar estado de carregamento explicitamente.

**Fix sugerido:** Adicionar atributos no Skeleton component default e em wrappers especializados.

**Arquivo:** src/components/ui/skeleton.tsx

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

### TD-028 — ThemeToggle placeholder FOUC no mount

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** sem gate
**Manifesta hoje?** Sim — FOUC visual durante hydration do tema

**Descricao:** Placeholder com opacity-0 transita para opacity-100 sem transition. Resultado: pop visual no mount.

**Fix sugerido:** Adicionar transition-opacity duration-200 no className do placeholder.

**Arquivo:** src/components/theme-toggle.tsx (ou path equivalente)

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1

## Closed (historico)

Ordem cronologica reversa. Como TD-001 a TD-003 foram fechados na mesma data (decisoes de infra, sem hash), ordem por numero TD ascendente esta OK.

### TD-001 — Supabase em sa-east-1 (Sao Paulo)

**Status:** Closed (—, 2026-05-07)
**Severidade:** Media
**Closed em:** Decisao de infra
**Validacao:** —

**Descricao:** Migrado de us-west-2 para reduzir RTT cliente -> DB no publico-alvo (BR). Ref atual: kxcljhjnpizznzdcgiyt. Combina com Vercel gru1 (vide CLAUDE.md §1).

**Historico:**

- 2026-05-07: aplicado em decisao de infra

### TD-002 — Data API Supabase desabilitada

**Status:** Closed (—, 2026-05-07)
**Severidade:** Media
**Closed em:** Decisao de infra
**Validacao:** —

**Descricao:** Acesso ao Postgres exclusivamente via Drizzle/postgres-js + Supavisor (transaction pooler porta 6543 para runtime, sessao 5432 para drizzle-kit/migrations). Decisao reduz superficie de ataque e forca as RLS a viver no Postgres, nao numa camada PostgREST paralela.

**Historico:**

- 2026-05-07: aplicado em decisao de infra

### TD-003 — drizzle.config.ts carrega .env.local antes de process.env

**Status:** Closed (—, 2026-05-07)
**Severidade:** Media
**Closed em:** Decisao de infra
**Validacao:** —

**Descricao:** Mesma correcao em src/lib/db/seeds/index.ts e scripts/research/validate-pipeline-costs.js.

Root cause: drizzle-kit (CLI), tsx (seed) e node (validate-pipeline-costs) rodam fora do runtime Next.js. Apenas `next dev`/`next build` carregam .env.local automaticamente. Sem o loader, process.env.DATABASE_URL ficava undefined e drizzle-kit caia com `url: undefined`.

Correcao: process.loadEnvFile(resolve(cwd, '.env.local')) (Node 20.12+/24, com feature-detection). Em seeds/index.ts, os imports de ../index e ../schema foram movidos para dynamic import dentro de seed() para garantir que o loader rode antes da avaliacao de db/index.ts (que le DATABASE_URL no top-level).

Por que nao adicionar dotenv: API nativa do Node cobre o caso e nao adiciona dep. Se algum dia precisarmos de cascata .env -> .env.local -> .env.production.local, reavaliar.

**Historico:**

- 2026-05-07: aplicado em decisao de infra
