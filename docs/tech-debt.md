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

| ID         | Titulo                                                              | Status | Severidade | Gate                                       |
| ---------- | ------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------ |
| TD-004     | Migracao KEK/DEK envelope encryption (ADR-010)                      | Open   | Alta       | Sessao 2.15.5 — hardening (movido de 1.3)  |
| TD-006     | 2FA TOTP (admin/super_admin)                                        | Open   | Alta       | Sessao 3.x — bloqueante                    |
| TD-010     | CSRF double-submit cookie + header validation                       | Open   | Alta       | Sessao 3.x — bloqueante                    |
| TD-019     | Playwright E2E auth (signup-completo, login-flow, reset-senha)      | Open   | Alta       | Sessao 1.15 — bloqueante Fase 1            |
| TD-021     | Correlation ID propagacao via AsyncLocalStorage                     | Open   | Alta       | Sessao 1.2                                 |
| TD-024     | next.config.ts headers (CSP, HSTS, X-Frame-Options, X-Content-Type) | Open   | Alta       | Antes de qualquer deploy publico           |
| ~~TD-030~~ | ~~Trigger.dev cron de Meta token refresh~~                          | Closed | Alta       | Sessao 1.4 — fechado                       |
| TD-005     | haveibeenpwned password check                                       | Open   | Media      | Antes de promover qualquer usuario a admin |
| TD-008     | Convite por token (workspace_invites)                               | Open   | Media      | Sessao 2.11 (collaborators)                |
| TD-009     | Click IDs middleware (fbclid/gclid/ttclid/msclkid) — TTL 90d        | Open   | Media      | Sessao 1.4.9 (CAPI) — bloqueante           |
| TD-011     | DIY signup/reset emails via Resend (templates JSX)                  | Open   | Media      | Sessao 1.14.5 (Compliance)                 |
| TD-013     | Resend response unhappy-path retry                                  | Open   | Media      | Antes de Sessao 1.5                        |
| TD-015     | Vitest signup.test.ts                                               | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-016     | Vitest login.test.ts                                                | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-017     | Vitest reset.test.ts                                                | Open   | Media      | Sessao 1.7.5 ou 1.15 polish                |
| TD-018     | Vitest anti-fraude.test.ts                                          | Open   | Media      | Sessao 1.5 (onboarding)                    |
| TD-020     | Vitest credit.service.test.ts (DB-bound)                            | Open   | Media      | Sessao 1.7.5                               |
| TD-022     | Sentry instrumentation em Server Actions                            | Open   | Media      | Sessao 1.2                                 |
| TD-025     | rls.sql migrar para migration numerada Drizzle                      | Open   | Media      | Antes de Fase 2                            |
| TD-029     | loginWithPassword over_request_rate_limit handling                  | Open   | Media      | Sessao 2.x                                 |
| TD-031     | Email "sua conexao Meta expirou" via Resend                         | Open   | Media      | Sessao 2.12 (transactional emails)         |
| TD-033     | Vitest dos services Meta + queries + actions                        | Open   | Media      | Sessao 1.15 polish                         |
| TD-034     | Playwright E2E OAuth Meta flow                                      | Open   | Media      | Sessao 1.15                                |
| TD-037     | Re-encrypt lazy on decrypt (reEncryptIfNeeded)                      | Open   | Media      | Sessao 2.15.5 (hardening)                  |
| TD-038     | Rate limiter por workspace pra chamadas Meta API                    | Open   | Media      | Sessao 1.4.9 (CAPI sender)                 |
| TD-007     | OAuth Google login                                                  | Open   | Baixa      | Sessao 2.x — reavaliar                     |
| TD-012     | users.created_at sem withTimezone: true                             | Open   | Baixa      | Sessao 1.15 polish                         |
| TD-014     | proxy.ts em vez de middleware.ts (Next 16 deprecation)              | Open   | Baixa      | Antes de Sessao 1.5                        |
| TD-023     | PostHog analytics events para signup/login/verify                   | Open   | Baixa      | Sessao 1.5 (onboarding)                    |
| TD-026     | dialog/sheet overlay com bg-black/80 hardcoded                      | Open   | Baixa      | sem gate                                   |
| TD-027     | Skeleton sem aria-busy e role=status                                | Open   | Baixa      | sem gate                                   |
| TD-028     | ThemeToggle placeholder FOUC no mount                               | Open   | Baixa      | sem gate                                   |
| TD-032     | System User Token UI (cola token de SU em vez de OAuth)             | Open   | Baixa      | Fase 3 (plano Agency)                      |
| TD-035     | Cleanup periodico de meta_data_deletion_requests antigos            | Open   | Baixa      | Sessao 3.13.5 (DPIA)                       |
| TD-036     | Per-tenant override de marketing_api_version                        | Open   | Baixa      | Quando Meta v26 sair                       |
| TD-039     | accessTier (Standard vs Advanced) dinamico apos OAuth               | Open   | Baixa      | Sessao 2.10 ou 2.4.5                       |
| TD-040     | partner_agent enviado em chamadas Meta API                          | Open   | Baixa      | Sessao 1.4.9 (CAPI sender)                 |

## Open

### TD-004 — Migracao KEK/DEK envelope encryption (ADR-010)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Gate:** Sessao 2.15.5 — hardening (movido de 1.3 por ADR-013)
**Manifesta hoje?** Latente — single-key AES-256-GCM versionada (encryption.ts) cobre o caso ate 50 clientes piloto. Sem rotacao de chave em curso. Tokens OAuth Meta cifrados desde Sessao 1.3 com formato v1:iv:tag:cipher.

**Descricao:** Decisao arquitetural documentada em ADR-010. Implementacao interim em src/lib/encryption.ts com chave unica versionada via env var ENCRYPTION_KEY. ADR-013 (Sessao 1.3) decidiu adiar a migracao envelope KEK/DEK pra 2.15.5 (threat model + hardening universal) por ser suficiente pro estagio atual.

**Fix sugerido:** Implementar conforme ADR-010 — KEK em Vercel/Supabase secrets, DEK gerada por workspace, cifrar tokens OAuth no insert. Migration aditiva: novas linhas usam DEK; linhas antigas re-cifradas via TD-037 (lazy re-encrypt).

**Arquivo:** src/lib/encryption.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1, gate definido em ADR-010 como bloqueante de 1.3
- 2026-05-09: gate movido pra 2.15.5 por decisao em ADR-013. Single-key versionada validada como suficiente pro escopo atual (Fase 1 piloto)

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

### TD-030 — Trigger.dev cron de Meta token refresh

**Status:** Closed (—, 2026-05-09)
**Severidade:** Alta
**Descoberto:** 2026-05-09, Sessao 1.3
**Closed em:** Sessao 1.4 — task `meta-token-refresh-cron` agendada cron daily 03:00 UTC
**Validacao:** src/lib/trigger/tasks/meta-token-refresh.ts + listConnectionsNeedingRefresh() em meta-connections queries

**Descricao:** Tokens Meta long-lived expiram em 60 dias se nao refreshados. Service token-refresh.service.ts implementa a logica (extend via Meta `fb_exchange_token` quando expires < 7d, marca expired apos 3 falhas). Sessao 1.4 configurou Trigger.dev v3 e adicionou meta-token-refresh-cron schedules.task que roda daily 03:00 UTC, lista conexoes via listConnectionsNeedingRefresh(7), refresha sequencialmente, loga summary.

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, deferido oficialmente pra 1.4 conforme plano consolidado
- 2026-05-09: closed em Sessao 1.4 — meta-token-refresh-cron + meta-token-refresh task implementados

### TD-031 — Email "sua conexao Meta expirou" via Resend

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 2.12 (transactional emails completos)
**Manifesta hoje?** Latente — token-refresh.service marca status='expired' apos 3 falhas, mas usuario nao eh notificado por email. Pode demorar pra perceber via UI.

**Descricao:** Quando refresh do token Meta falha 3x consecutivas, conexao vai pra status='expired' e syncs param. Usuario precisa receber email automatico explicando o que houve e como reconectar (link direto pra /configuracoes/conexoes). Sessao 2.12 vai criar 17 templates transacionais — incluir esse junto.

**Fix sugerido:** Template JSX em src/emails/meta-connection-expired.tsx + chamada de sendTransactional() dentro do refreshIfNeeded() quando newFailureCount >= MAX_FAILURES. Usar dominio autenticado (SPF/DKIM/DMARC).

**Arquivo:** src/emails/meta-connection-expired.tsx (a criar), src/lib/services/token-refresh.service.ts (chamada do email)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, deferido pra 2.12 (sessao dedicada de emails)

### TD-032 — System User Token UI (cola token de SU em vez de OAuth)

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Fase 3 (plano Agency)
**Manifesta hoje?** Nao — schema ja suporta (isSystemUserToken boolean + systemUserId text), apenas UI faltando. User OAuth com refresh automatico cobre o caso atual.

**Descricao:** Meta System User Tokens nao expiram (vs user tokens 60d). Diferencial pra plano Agency: cliente cola token gerado em business.facebook.com/settings/system-users, dispensa OAuth. Schema preparado em ADR-013. UI nao prioritaria pra MVP (admin do app usa OAuth normal).

**Fix sugerido:** Componente em /configuracoes/conexoes com toggle "Conectar via System User Token" → form com input pra colar token + select de business_id. Validacao: chama getMe() pra confirmar token valido. Persiste com isSystemUserToken=true. Token-refresh task pula esses (logica ja implementada).

**Arquivo:** src/app/(app)/configuracoes/conexoes/system-user-form.tsx (a criar)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, deferido pra Fase 3 (Agency feature)

### TD-033 — Vitest dos services Meta + queries + actions

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 1.15 polish (junto com TD-015/016/017/020)
**Manifesta hoje?** Latente — coberto por smoke manual da 1.3. CLAUDE.md regra 18 pede coverage > 80% pra services.

**Descricao:** 4 arquivos sem cobertura unit:

- src/lib/services/meta.service.ts (9 metodos: exchange, extend, getMe, listPermissions, listBusinesses, listOwnedDomains, listOwnedAdAccounts, listMyAdAccounts, listOwnedPixels)
- src/lib/services/oauth-state.service.ts (gen + consume)
- src/lib/services/token-refresh.service.ts (refreshIfNeeded com path system-user, no-expiry, not-needed, success, failed, expired)
- src/lib/db/queries/meta-connections.ts (5 funcoes)
- src/lib/actions/meta-connections.ts (3 actions)

**Fix sugerido:** msw pra mockar Meta API responses; Upstash mocked via in-memory map. Container Postgres pra queries DB-bound. Testes priorizados:

1. Token refresh edge cases (expirado, system user, sucesso, falha 3x)
2. OAuth state consume (one-shot validation)
3. listBusinesses + listOwnedDomains (Zod schema parsing)
4. syncMetaConnection edge cases (token revogado → TOKEN_EXPIRED)

**Arquivo:** \*.test.ts colocados ao lado de cada source

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3

### TD-034 — Playwright E2E OAuth Meta flow

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 1.15 (Playwright sera instalado junto com TD-019)
**Manifesta hoje?** Latente — coberto por smoke manual confirmado em 2026-05-09. Spec da 1.3 pediu E2E test mas Playwright ainda nao foi configurado no projeto.

**Descricao:** Spec da Sessao 1.3 (v0.6) menciona E2E: "state invalido rejeita, token encriptado no banco (blob base64), refresh automatico". Sem Playwright instalado, smoke manual cobre. Quando Playwright entrar (TD-019, gate 1.15), adicionar specs de OAuth Meta como suite separada.

**Fix sugerido:** e2e/meta/oauth.spec.ts com cenarios: state invalido na callback retorna /bem-vindo/meta?status=invalid, token persiste encriptado (formato v1:base64:base64:base64), pos-conexao /configuracoes/conexoes lista a conta. Mock parcial do Meta OAuth dialog via test users.

**Arquivo:** e2e/meta/\*.spec.ts (a criar)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, agrupado com TD-019 (Playwright base)

### TD-035 — Cleanup periodico de meta_data_deletion_requests antigos

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 3.13.5 (DPIA + LGPD erasure job)
**Manifesta hoje?** Nao — endpoint stub apenas registra requests. Sem volume hoje.

**Descricao:** Tabela meta_data_deletion_requests acumula sem retencao. Cada request tem signed_request_payload jsonb (~1KB). Em escala de 1000 requests/mes a tabela cresce ~1MB/mes — nao critico, mas nao ha politica de retencao. Sessao 3.13.5 vai criar job real de purge de PII (status='pending' → 'completed'); ao mesmo tempo criar TTL pra requests 'completed' antigas (>180d).

**Fix sugerido:** Trigger.dev task semanal: DELETE FROM meta_data_deletion_requests WHERE status='completed' AND processed_at < now() - interval '180 days'. Auditar antes de aplicar (loga count + criterion).

**Arquivo:** src/lib/trigger/tasks/data-deletion-cleanup.ts (a criar em 3.13.5)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3

### TD-036 — Per-tenant override de marketing_api_version

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Quando Meta lancar v26 (estimativa: jul-set/2026)
**Manifesta hoje?** Nao — todos os tenants usam env.META_GRAPH_VERSION (v25.0 atual).

**Descricao:** Schema meta_connections.marketing_api_version existe (per-tenant override planejado em ADR-013) mas codigo atual usa exclusivamente env.META_GRAPH_VERSION em todas as chamadas (graphUrl helper em meta.service.ts). Util quando Meta lancar v26 e quisermos rollout gradual: A/B testing entre tenants antes de bumping global.

**Fix sugerido:** Refatorar graphUrl() para receber connection opcional e priorizar connection.marketingApiVersion sobre env. UI em /admin pra editar versao por tenant (Sessao 3.x).

**Arquivo:** src/lib/services/meta.service.ts (graphUrl)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, schema preparado mas codigo nao consome

### TD-037 — Re-encrypt lazy on decrypt (reEncryptIfNeeded)

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 2.15.5 (hardening) ou quando rotacionar ENCRYPTION_KEY pela primeira vez
**Manifesta hoje?** Nao — chave nao rotacionada ainda.

**Descricao:** ADR-010 prescreve "lazy rotation" — quando decrypt acontece em token cifrado com chave antiga, re-cifra com chave atual e atualiza row. encryption.ts ja implementa reEncryptIfNeeded() mas nenhum service chama. Quando ENCRYPTION_KEY for rotacionada pela primeira vez, rows antigas continuarao decifrando OK (cross-version decrypt funciona) mas nunca migram.

**Fix sugerido:** No syncMetaConnection() e no refreshIfNeeded(), apos decrypt() bem-sucedido, chamar reEncryptIfNeeded(ciphertext) e se rotated=true atualizar coluna encryptedAccessToken + encryptionKeyVersion no banco. Aplicar tambem em google_connections quando 2.10 entrar.

**Arquivo:** src/lib/services/token-refresh.service.ts, src/lib/actions/meta-connections.ts

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, encryption helper existe ha tempo mas nunca consumido

### TD-038 — Rate limiter por workspace pra chamadas Meta API

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 1.4.9 (CAPI sender — quando chamadas comecam a escalar)
**Manifesta hoje?** Nao — apenas chamadas durante OAuth callback + sync manual. Volume baixo.

**Descricao:** Meta tem hard-cap de ~2000 calls/h por ad account + 1000 events/request. Quando 1.4.9 (CAPI sender) e 1.4 (sync-campaigns.job) entrarem, volume escala. Sem rate limiter por workspace, um cliente Black Friday pode estourar quota e impactar outros (quota Meta eh por app developer, nao por client). Audit recomendou em META_API_2026-05.md secao 4 (riscos criticos).

**Fix sugerido:** Estender lib/rate-limit/upstash.ts com `metaApiLimiter = ratelimit('meta-api', '1000/1h')` chaveado por workspace_id. Wrapper em meta.service.ts envelopando metaFetch() — checa limit antes de cada call, fila com Trigger.dev se exceder. Backoff exponencial em RESOURCE_EXHAUSTED.

**Arquivo:** src/lib/rate-limit/upstash.ts, src/lib/services/meta.service.ts (metaFetch wrapper)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, recomendado pelo audit Meta 2026-05

### TD-039 — accessTier (Standard vs Advanced) dinamico apos OAuth

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 2.10 (Google Ads vai ter analogo) ou 2.4.5 (CAPI observability dashboard)
**Manifesta hoje?** Nao — coluna accessTier sempre 'standard' (default). Sem App Review aprovado, nao ha distincao real.

**Descricao:** Schema meta_connections.accessTier text default 'standard' adicionado em ADR-013 mas nunca populado dinamicamente. Quando a Criation passar por App Review e receber Advanced Access pra ads_management, OAuth callback deveria detectar e popular accessTier='advanced'. Hoje todos uniformes como 'standard'.

**Fix sugerido:** Apos listPermissions(), checar se permissions inclui 'ads_management' com status='granted' E se app_review_status (chamada futura) eh 'approved'. Se sim, setar accessTier='advanced'. UI em /configuracoes/conexoes mostra badge differente. Implementar quando Sessao 2.10 fizer o mesmo pra Google Ads.

**Arquivo:** src/app/api/oauth/meta/callback/route.ts, src/lib/db/queries/meta-connections.ts

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3

### TD-040 — partner_agent enviado em chamadas Meta API

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-09, Sessao 1.3
**Gate:** Sessao 1.4.9 (CAPI sender — onde partner_agent eh visivel no Events Manager)
**Manifesta hoje?** Nao — coluna populada (default 'criation-io-v1') mas nunca enviada como header/param. Meta nao tem como atribuir nossas chamadas a Criation hoje.

**Descricao:** Schema meta_connections.partner_agent text default 'criation-io-v1' criado em ADR-013. Util pro Meta Events Manager agregar metricas de qualidade por partner (ex: EMQ medio das chamadas Criation). Hoje meta.service.ts nao envia esse campo. Naturalmente entra em 1.4.9 (CAPI sender) onde vira parte do payload do evento.

**Fix sugerido:** Em capi_events payload (Sessao 1.4.9), adicionar `partner_agent: connection.partnerAgent`. Nao precisa em chamadas read-only de campanhas/insights. Apontar pro Events Manager exibir agrupado.

**Arquivo:** src/lib/services/capi.service.ts (a criar em 1.4.9)

**Historico:**

- 2026-05-09: descoberto em Sessao 1.3, planejado pra 1.4.9

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
