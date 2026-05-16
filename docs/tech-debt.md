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

| ID         | Titulo                                                                      | Status                           | Severidade | Gate                                                   |
| ---------- | --------------------------------------------------------------------------- | -------------------------------- | ---------- | ------------------------------------------------------ |
| TD-004     | Migracao KEK/DEK envelope encryption (ADR-010)                              | Open                             | Alta       | Sessao 2.15.5 — hardening (movido de 1.3)              |
| TD-006     | 2FA TOTP (admin/super_admin)                                                | Open                             | Alta       | Sessao 3.x — bloqueante                                |
| TD-010     | CSRF double-submit cookie + header validation                               | Open                             | Alta       | Sessao 3.x — bloqueante                                |
| TD-019     | Playwright E2E auth (signup-completo, login-flow, reset-senha)              | Open                             | Alta       | Sessao 1.15 — bloqueante Fase 1                        |
| TD-021     | Correlation ID propagacao via AsyncLocalStorage                             | Open                             | Alta       | Sessao 1.2                                             |
| ~~TD-024~~ | ~~next.config.ts headers (CSP, HSTS, X-Frame-Options, X-Content-Type)~~     | Closed                           | Alta       | Fase A pre-1.4.9.5 — fechado                           |
| ~~TD-030~~ | ~~Trigger.dev cron de Meta token refresh~~                                  | Closed                           | Alta       | Sessao 1.4 — fechado                                   |
| TD-005     | haveibeenpwned password check                                               | Open                             | Media      | Antes de promover qualquer usuario a admin             |
| TD-008     | Convite por token (workspace_invites)                                       | Open                             | Media      | Sessao 2.11 (collaborators)                            |
| TD-009     | Click IDs middleware (fbclid/gclid/ttclid/msclkid) — TTL 90d                | Open                             | Media      | Sessao 1.4.9 (CAPI) — bloqueante                       |
| TD-011     | DIY signup/reset emails via Resend (templates JSX)                          | Open                             | Media      | Sessao 1.14.5 (Compliance)                             |
| TD-013     | Resend response unhappy-path retry                                          | Open                             | Media      | Antes de Sessao 1.5                                    |
| TD-015     | Vitest signup.test.ts                                                       | Open                             | Media      | Sessao 1.7.5 ou 1.15 polish                            |
| TD-016     | Vitest login.test.ts                                                        | Open                             | Media      | Sessao 1.7.5 ou 1.15 polish                            |
| TD-017     | Vitest reset.test.ts                                                        | Open                             | Media      | Sessao 1.7.5 ou 1.15 polish                            |
| TD-018     | Vitest anti-fraude.test.ts                                                  | Open                             | Media      | Sessao 1.5 (onboarding)                                |
| TD-020     | Vitest credit.service.test.ts (DB-bound)                                    | Open                             | Media      | Sessao 1.7.5                                           |
| TD-022     | Sentry instrumentation em Server Actions                                    | Open                             | Media      | Sessao 1.2                                             |
| TD-025     | rls.sql migrar para migration numerada Drizzle                              | Open                             | Media      | Antes de Fase 2                                        |
| TD-029     | loginWithPassword over_request_rate_limit handling                          | Open                             | Media      | Sessao 2.x                                             |
| TD-031     | Email "sua conexao Meta expirou" via Resend                                 | Open                             | Media      | Sessao 2.12 (transactional emails)                     |
| TD-033     | Vitest dos services Meta + queries + actions                                | Open                             | Media      | Sessao 1.15 polish                                     |
| TD-034     | Playwright E2E OAuth Meta flow                                              | Open                             | Media      | Sessao 1.15                                            |
| TD-037     | Re-encrypt lazy on decrypt (reEncryptIfNeeded)                              | Open                             | Media      | Sessao 2.15.5 (hardening)                              |
| TD-038     | Rate limiter por workspace pra chamadas Meta API                            | Open                             | Media      | Sessao 1.4.9 (CAPI sender)                             |
| TD-007     | OAuth Google login                                                          | Open                             | Baixa      | Sessao 2.x — reavaliar                                 |
| TD-012     | users.created_at sem withTimezone: true                                     | Open                             | Baixa      | Sessao 1.15 polish                                     |
| TD-014     | proxy.ts em vez de middleware.ts (Next 16 deprecation)                      | Open                             | Baixa      | Antes de Sessao 1.5                                    |
| TD-023     | PostHog analytics events para signup/login/verify                           | Open                             | Baixa      | Sessao 1.5 (onboarding)                                |
| TD-026     | dialog/sheet overlay com bg-black/80 hardcoded                              | Open                             | Baixa      | sem gate                                               |
| TD-027     | Skeleton sem aria-busy e role=status                                        | Open                             | Baixa      | sem gate                                               |
| TD-028     | ThemeToggle placeholder FOUC no mount                                       | Open                             | Baixa      | sem gate                                               |
| TD-032     | System User Token UI (cola token de SU em vez de OAuth)                     | Open                             | Baixa      | Fase 3 (plano Agency)                                  |
| TD-035     | Cleanup periodico de meta_data_deletion_requests antigos                    | Open                             | Baixa      | Sessao 3.13.5 (DPIA)                                   |
| TD-036     | Per-tenant override de marketing_api_version                                | Open                             | Baixa      | Quando Meta v26 sair                                   |
| TD-039     | accessTier (Standard vs Advanced) dinamico apos OAuth                       | Open                             | Baixa      | Sessao 2.10 ou 2.4.5                                   |
| TD-040     | partner_agent enviado em chamadas Meta API                                  | Open                             | Baixa      | Sessao 1.4.9 (CAPI sender)                             |
| TD-094     | Ingestion key rotacionavel (substitui workspace_id puro)                    | Open                             | Alta       | Antes de launch publico (Fase 4)                       |
| TD-095     | Vary: Origin header no endpoint /api/v1/track                               | Open                             | Baixa      | Quando Allow-Origin deixar de ser `*`                  |
| TD-096     | SLA p99 cold start documentado + monitorado                                 | Open                             | Baixa      | Sessao 1.15 ou 3.11.5                                  |
| TD-097     | Renomear /criation-tracking.js para path neutro (anti-adblock)              | Open                             | Media      | Antes de launch publico (Fase 4)                       |
| TD-098     | Sentry browser SDK no tracking script (telemetry de erros)                  | Open                             | Media      | Fase 3 ou antes launch                                 |
| TD-099     | Build/minify step do criation-tracking.js (esbuild)                         | Open                             | Media      | Antes de launch publico (Fase 4)                       |
| TD-100     | Domain ownership verification via TXT record                                | Open                             | Media      | Fase 3 (Agency plans)                                  |
| TD-101     | persistVisitorMatch em transaction explicita (3 UPDATEs atomicos)           | Closed (audit C1, 2026-05-12)    | —          | —                                                      |
| TD-102     | Reverse matching mais agressivo (sobrescrever unmatched anterior)           | Closed (audit A2, 2026-05-12)    | —          | —                                                      |
| TD-103     | Cache tracking_visitors no stitcher (mesma row lida 2x: matcher+stitcher)   | Open                             | Baixa      | Quando p95 > 1.5s                                      |
| TD-104     | LGPD erasure path — limpa visitor_id+email_hash em 3+ tabelas               | Open                             | Alta       | Antes de primeiro titular request real                 |
| TD-105     | Adapters de gateway extraem fbclid/gclid pra gateway_events                 | Open                             | Media      | Antes de cliente que precise atribuicao via clickid    |
| TD-106     | Migration 0011 — backfill batch + migration 0013 com NOT NULL final         | Open                             | Baixa      | Quando volume justificar (dashboard pending crescer)   |
| TD-107     | Phone normalizer unificado entre security/hash e capi/hashing (bug intl)    | Closed (audit 1.4.9, 2026-05-12) | —          | —                                                      |
| TD-108     | Retention 30d pra plain IP/UA em tracking_events + gateway_events           | Open                             | Alta       | Antes do primeiro cliente real (LGPD compliance)       |
| TD-109     | Pure gateway fanout — Purchase sem browser session nao chega ao Meta        | Open                             | Media      | Quando primeiro cliente sem script Criation conectar   |
| TD-110     | EMQ baseline populate via Dataset Quality API                               | Open                             | Baixa      | Fase 2.4.5 (audit Meta sugeriu)                        |
| TD-111     | CTWA payload validation — recipient_type + outros fields business_messaging | Open                             | Media      | Antes do primeiro cliente com CTWA ativo               |
| TD-112     | getMetaFanoutStats — 1 query unica com FILTER em vez de 4+1                 | Open                             | Baixa      | Quando dashboard p95 > 500ms                           |
| TD-113     | AddressIdentifier.streetAddress vs payload addressLine — naming drift       | Open                             | Baixa      | Quando adapter Google popular address (TD-115)         |
| TD-114     | persistSkippedCapiEvent Google — googleCustomerId null mesmo com account    | Open                             | Baixa      | Quando analytics filtrar capi_events por customer      |
| TD-115     | refresh_token rotation Google nao persistida                                | Open                             | Baixa      | Latente — alta probabilidade de quebrar em prod        |
| TD-116     | Race condition cron + inline refresh Google access_token                    | Open                             | Baixa      | Quando volume cobrar reuso de access (workspace ativo) |
| TD-117     | google_ads_accounts soft-deleted com is_default=true                        | Open                             | Baixa      | Latente — soft-delete + re-OAuth flow                  |
| TD-118     | CTA "Reconectar Google" no wizard quando expired/invalid_grant              | Open                             | Media      | Quando primeiro user vir status='expired' na UI        |
| TD-119     | Notificacao email "sua conexao Google expirou"                              | Open                             | Media      | Quando cron `google-token-refresh` detectar expired    |

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

**Status:** Closed (—, 2026-05-16)
**Severidade:** Alta
**Descoberto:** 2026-05-07, Sessao 1.1
**Closed em:** Fase A pre-1.4.9.5 (audit pre-cliente alpha)
**Validacao:** `pnpm tsc --noEmit` + `pnpm lint` verdes; validacao em prod via `curl -I https://criation.io` apos deploy.

**Descricao:** next.config.ts era stub vazio (`const nextConfig: NextConfig = {}`). Sem headers de seguranca aplicados em respostas. Vulneravel a clickjacking, MIME sniffing, ataques de injecao mitigaveis por CSP.

**Fix aplicado:** `headers async () => [...]` com:

- Strict-Transport-Security (max-age 2y, includeSubDomains, preload)
- X-Frame-Options DENY
- X-Content-Type-Options nosniff
- Referrer-Policy strict-origin-when-cross-origin
- Permissions-Policy minimal (camera/microphone/geolocation/interest-cohort negados)
- `poweredByHeader: false` (remove `X-Powered-By: Next.js`)
- Content-Security-Policy-Report-Only com policy enxuta (`connect-src` so Supabase confirmado via grep; sem dominios externos cross-origin do browser)

CSP ficou em Report-Only porque Next 16 App Router injeta scripts/styles inline (SSR). Migrar pra enforce com nonce-based via middleware fica como **TD-024b** futuro (~2h, estimativa).

Decisao: nao usar `Cross-Origin-Resource-Policy: same-origin` global porque quebraria `/criation-tracking.js` carregando em sites cliente (script tag nao requer CORS mas CORP same-origin bloquearia o response).

**Arquivo:** next.config.ts

**Historico:**

- 2026-05-07: descoberto em Sessao 1.1
- 2026-05-16: closed em Fase A pre-1.4.9.5 — headers de seguranca aplicados, CSP em Report-Only pra observabilidade antes do enforce

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

### TD-094 — Ingestion key rotacionavel substitui workspace_id puro

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Antes de launch publico (Fase 4)
**Manifesta hoje?** Parcialmente mitigado por grace period de 7d + origin allowlist enforce pos-grace (1.4.A.10 audit fix A1).

**Descricao:** `workspace_id` UUID v4 e exposto publicamente via `data-workspace` no `<script>` do cliente (visivel via view-source). Atacante que descobrir UUID pode postar eventos arbitrarios pro endpoint `/api/v1/track`. Hoje mitigado por: (1) origin allowlist enforce apos 7d, (2) rate limit 600/min por workspace. Mas:

- Atacante pode burlar allowlist falsificando header `Origin` em requests server-to-server (origin so e checavel em browsers).
- Burst de rate-limit ainda contamina dados antes de rate-limit kickear.

**Fix sugerido:** Mover pra modelo de ingestion key publico:

- `pk_live_<32bytes_base64>` gerado por workspace, rotacionavel
- Embeded no script via `data-key` (substitui `data-workspace`)
- Server resolve workspace_id a partir da key
- Permite revogacao imediata se key vazar
- Mantem origin allowlist como defesa em profundidade

**Trade-off:** rotacao requer cliente reinstalar script (downtime de captura). Estrategia: support overlap (2 keys ativas simultaneas durante rotation).

**Arquivo afetado:** `src/lib/services/tracking.service.ts`, `src/app/api/v1/track/route.ts`, `public/criation-tracking.js`

**Historico:**

- 2026-05-12: descoberto em audit 1.4.A (fix A1 parcial aplicado — grace period)

### TD-095 — Vary: Origin header no endpoint /api/v1/track

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Quando Allow-Origin deixar de ser `*` (futuro)
**Manifesta hoje?** Nao — `Access-Control-Allow-Origin: *` e constante, sem cache pollution.

**Descricao:** Se um dia eco do `Origin` header em vez de `*` (ex: pra credentials cross-origin), esquecer de adicionar `Vary: Origin` causa cache CDN cross-contamination.

**Fix sugerido:** Adicionar `Vary: Origin` no CORS_HEADERS object antes de fazer essa mudanca.

**Arquivo:** `src/app/api/v1/track/route.ts:31`

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-096 — SLA p99 cold start documentado + monitorado

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Sessao 1.15 (smoke tests Fase 1) ou 3.11.5 (monitoring)
**Manifesta hoje?** Sim em cold start primeiro request (500-1500ms vs target <100ms steady state)

**Descricao:** Endpoint `/api/v1/track` depende de Drizzle client lazy init + Upstash Redis (rate limit HTTP) + Postgres insert + Trigger.dev enqueue HTTP. Fluid Compute reaproveita instancias mas cold start primeiro hit por worker e lento.

**Fix sugerido:**

1. Documentar SLA realista no `vercel.ts` ou README: p99 < 100ms steady-state, p99 < 2s cold.
2. Vercel Analytics dashboard pra tracking de p99/p95/p50.
3. Considerar warmer cron (call /api/v1/health a cada 5min em horario comercial).

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-097 — Renomear /criation-tracking.js para path neutro (anti-adblock)

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Antes de launch publico (Fase 4)
**Manifesta hoje?** Provavel — uBlock Origin e outros adblockers tem rules genericas pra bloquear paths contendo "tracking", "track", "analytics".

**Descricao:** Path atual `/criation-tracking.js` triggera filtros generic-tracking de adblockers. Substituir por path neutro (ex: `/c.js`, `/sdk.js`, ou path hash-based `/_cio/abc.js`) reduz taxa de block.

**Fix sugerido:**

1. Adicionar route `/c.js` (Next.js public route) servindo o mesmo conteudo.
2. Manter `/criation-tracking.js` por 90d como retrocompat.
3. UI de tracking-script gera snippet com novo path.
4. Comunicar mudanca aos clientes existentes.

**Trade-off:** quebra clientes que ja instalaram path antigo durante o periodo de overlap.

**Arquivo:** `public/criation-tracking.js` → `public/c.js`, `src/app/(app)/configuracoes/tracking-script/page.tsx`

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-098 — Sentry browser SDK no tracking script

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Fase 3 (loop de aprendizado) ou antes do launch publico
**Manifesta hoje?** Parcialmente — error boundary `safely()` swallow errors. Em prod nao ha visibilidade de bugs.

**Descricao:** Script tem error boundary mas sem report. Bugs em produção (ex: edge case em Safari iOS 17) ficam invisiveis ate cliente reportar.

**Fix sugerido:** Adicionar reporter minimo (~1KB extra) que faz POST pra `/api/v1/track-error` com `{ message, stack, browser, version }`. Sentry full SDK seria 30KB+ — overkill pra um script de 5KB.

**Arquivo:** `public/criation-tracking.js`

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-099 — Build/minify step do criation-tracking.js

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Antes de launch publico (Fase 4)
**Manifesta hoje?** Script tem 17.9KB unminified / 5.5KB gzipped. Target ADR-014 era <5KB gzipped. Aceitavel hoje mas margin nula.

**Descricao:** Script e servido raw, sem minification. esbuild + terser reduziriam ~50% (estimado 9KB → 3KB gzipped).

**Fix sugerido:**

1. Adicionar `pnpm build:tracking` script que roda esbuild com target ES5 + minify
2. Output em `public/c.js` (ou `criation-tracking.min.js`)
3. Source map publico em `public/criation-tracking.js.map` pra debug
4. CI/CD roda build automatico antes do deploy

**Arquivo:** novo `scripts/build-tracking.mjs` + `package.json`

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-100 — Domain ownership verification via TXT record

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit 1.4.A
**Gate:** Fase 3 (Agency plans) ou multi-tenant escala
**Manifesta hoje?** Nao — origin allowlist resolve pra MVP. Mas qualquer cliente pode adicionar `apple.com` na allowlist deles sem provar posse.

**Descricao:** Allowlist atual confia no que cliente declara. Em escala (Agency com 50 sub-workspaces), policing manual e impraticavel. Solucao padrao: TXT record verification (mesmo padrao Google Search Console, Meta business verification).

**Fix sugerido:**

1. Quando cliente adiciona origem `app.cliente.com`, gerar token: `criation-verify=<random>`
2. Cliente coloca TXT record `criation-verify.app.cliente.com IN TXT "criation-verify=<token>"`
3. Background job tenta DNS resolve a cada 5min ate confirmar
4. Apos confirmar, origem vira "verified" — pode receber eventos
5. Antes da confirmacao: aceita com warning na UI mas marca eventos como `unverified_origin`

**Trade-off:** fricção extra no onboarding. Pode ser opt-in pra Agency plan.

**Arquivo:** novo `src/lib/services/domain-verification.service.ts`

**Historico:**

- 2026-05-12: documentado em audit 1.4.A

### TD-101 — persistVisitorMatch em transaction explicita

**Status:** Closed (audit C1, 2026-05-12)
**Severidade:** Media

**Descricao:** `persistVisitorMatch` fazia 3 UPDATEs sequenciais sem transaction. Estado parcial inconsistente possivel em falhas isoladas.

**Resolucao (mesmo dia):** envolvido em `db.transaction(async (tx) => {...})`. 4 UPDATEs (gateway_events + tracking_visitors + tracking_events + gateway_subscriptions) agora atomicos. Auditoria pos-1.4.B identificou alem do escopo original.

**Arquivo:** `src/lib/db/queries/visitor-buyer-matching.ts` — `persistVisitorMatch`

**Historico:**

- 2026-05-12: documentado durante sessao 1.4.B
- 2026-05-12: closed em audit fix C1 (mesma sessao, pos-implementacao)

### TD-102 — Reverse matching mais agressivo

**Status:** Closed (audit A2, 2026-05-12)
**Severidade:** Baixa (mas auditoria reclassificou como Alta — era o caso de uso primario)

**Descricao:** `matchGatewayEventsForIdentifiedVisitor` so processava eventos com `visitor_matched_at IS NULL`. Como o matcher direto SEMPRE seta `visitor_matched_at` (mesmo em unmatched), o reverse matching nunca disparava em produção real — exceto na janela de poucos segundos antes do enqueue do Trigger.dev rodar pela primeira vez.

**Resolucao:** reverse matching agora SOBRESCREVE eventos com `visitor_match_strategy = 'unmatched'` via novo parametro `overrideUnmatched=true` em `persistVisitorMatch`. Eventos com strategy real (deterministic/clickid/utm_recency) continuam preservados. Strategy correta `reverse_email` (audit A3) foi introduzida na mesma migration.

**Arquivo:** `src/lib/services/visitor-buyer-matcher.service.ts` — `matchGatewayEventsForIdentifiedVisitor`

**Historico:**

- 2026-05-12: documentado durante sessao 1.4.B
- 2026-05-12: severidade reclassificada de Baixa pra Alta na auditoria (era P0 bloqueador)
- 2026-05-12: closed em audit fix A2

### TD-103 — Cache tracking_visitors no stitcher

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, sessao 1.4.B
**Gate:** Quando p95 do `stitch-gateway-event` task > 1.5s
**Manifesta hoje?** Nao — 1 SELECT extra de tracking_visitors em cada stitch nao mexe nos 1.5s alvo.

**Descricao:** Pipeline atual: matcher faz `findVisitorByXcode/ClickId/UtmRecency` (le tracking_visitors), stitcher 2.0 faz outro `db.query.trackingVisitors.findFirst` se matched_visitor_id setado. Mesma row lida 2x.

**Fix sugerido:** Passar visitor row do matcher pro stitcher via parametro (refactor do task `stitch-gateway-event`). Ou: cache in-process com TTL 30s (escopo task scope, nao cross-request).

**Arquivo:** `src/lib/trigger/tasks/stitch-gateway-event.ts` + `src/lib/services/utm-stitcher.service.ts`

**Historico:**

- 2026-05-12: documentado durante sessao 1.4.B

### TD-104 — LGPD erasure path (visitor + email_hash em 3+ tabelas)

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-12, audit pos-1.4.B (achado C4)
**Gate:** **Bloqueia primeiro titular request real** (LGPD Art. 18 III — direito a eliminacao)
**Manifesta hoje?** Nao porque ainda nao temos clientes pagantes nem titulares fazendo request. Quando virar real, sem solucao = exposicao legal.

**Descricao:** Schema documenta `gateway_events.matched_visitor_id` como "Soft FK — visitor pode ser apagado por LGPD/erasure", mas `lib/services/erasure.service.ts` nao existe (`grep -rn "erasure\|lgpd"` no repo retorna apenas comentarios). Quando titular pedir eliminacao, apagar `tracking_visitors` deixa:

- `gateway_events.matched_visitor_id` apontando pra UUID inexistente (orfao silencioso)
- `gateway_events.customer_email_hash` ainda contem o hash do email (PII)
- `tracking_events.matched_buyer_email_hash` espalhado em N particoes mensais
- `tracking_visitors.identified_buyer_email_hash` orfao
- `gateway_subscriptions.identified_visitor_id` orfao + `gateway_subscriptions.origin` jsonb pode ter PII

**Fix sugerido:** novo `lib/services/erasure.service.ts`:

1. Recebe `(workspaceId, emailHashOuVisitorId)`
2. Em transacao: NULL `customer_email_hash` em `gateway_events` (preserva venda mas remove identificacao); NULL `matched_visitor_id` + `visitor_match_*` em `gateway_events`; DELETE em `tracking_visitors`; UPDATE `tracking_events SET matched_buyer_email_hash=NULL` (todas particoes do workspace, janela ampla); NULL `identified_visitor_id` em `gateway_subscriptions`
3. Audit log obrigatorio (regra 4 do CLAUDE.md sobre service_role)
4. Endpoint publico `/api/v1/erasure` com verificacao de identidade (email confirmation link)

Documentar no ADR-014 antes de aceitar primeiro cliente real. Idealmente entregue em sessao dedicada antes do launch.

**Arquivo:** `src/lib/services/erasure.service.ts` (novo) + endpoint route handler + audit_logs entry

**Historico:**

- 2026-05-12: documentado em audit pos-1.4.B (C4)

### TD-105 — Adapters de gateway extraem fbclid/gclid

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit pos-1.4.B (achado A5)
**Gate:** Antes de cliente que precise atribuicao via clickid (ex: ad accounts grandes onde xcode falha por bloqueio Safari ITP)
**Manifesta hoje?** Sim — estrategia `clickid` da cascata visitor-matching e dormente. Sempre cai pra `utm_recency` ou `unmatched`.

**Descricao:** Auditoria identificou que nenhum adapter (Hotmart/Kiwify/Eduzz) extrai `fbclid`/`gclid` pro `gateway_events.fbclid`. `grep -rn fbclid src/lib/services/gateways/` retorna apenas a definicao do tipo, zero usos. Estrategia `clickid` (confidence 0.9) implementada na 1.4.B nunca dispara.

Hotmart 2.x carrega click ids via:

- `tracking.source` (string livre — pode conter fbclid se cliente configurou checkout pra preservar)
- `purchase.origin.xcode` (nosso link enrichment — ja usado por deterministic_xcode)
- Nao expoe fbclid diretamente no payload padrao

**Fix sugerido:** Investigar o que cada gateway expõe:

- Hotmart: tentar parse de `tracking.source` se padrao `fbclid=xxx` ou similar
- Kiwify: investigar `tracker.code2-5` (analogos a code1=visitor_id)
- Eduzz: investigar fields `tracker.code2+`
- Generic webhook: aceitar fbclid no payload custom

Implementar como adapter helper `extractClickIds(payload): { fbclid, gclid, ttclid }` chamado pelo normalizer. Se nada achado, gateway_events.fbclid fica NULL — comportamento atual.

Smoke cenario 2 fica reescrito quando fix entregar.

**Arquivo:** `src/lib/services/gateways/{hotmart,kiwify,eduzz}/normalizer.ts`

**Historico:**

- 2026-05-12: documentado em audit pos-1.4.B (A5)

### TD-106 — Migration 0011 — backfill batch + migration 0013 com NOT NULL final

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, audit pos-1.4.B (C6)
**Gate:** Quando dashboard de pending crescer (volume justificar)
**Manifesta hoje?** Nao — base ainda quase vazia.

**Descricao:** CLAUDE.md regra 16 exige sequencia 3-PR pra migrations: (a) aditivo nullable, (b) backfill, (c) constraint. Migration 0011 fez (a). Migration 0012 fez (c) parcial (CHECK enum + range). Falta (b): backfill que marca todos `gateway_events` antigos sem `visitor_matched_at` como `unmatched`. Sem isso, indice parcial `gateway_events_pending_visitor_match_idx` cresce indefinidamente alimentado por eventos pre-1.4.B que nunca serao processados pelo matcher (pre-data feature).

**Fix sugerido:** migration 0013 (ou job admin) que:

```sql
UPDATE gateway_events
SET visitor_matched_at = now(), visitor_match_strategy = 'unmatched'
WHERE visitor_matched_at IS NULL
  AND created_at < '<data_da_1.4.B>';
```

Em batches de 10k pra nao lock contention. Depois adicionar NOT NULL constraint em `visitor_matched_at` (opcional — manter nullable e ok pra eventos novos no instante entre INSERT e Trigger.dev rodar).

**Arquivo:** futura migration 0013 ou admin task

**Historico:**

- 2026-05-12: documentado em audit pos-1.4.B (C6)

### TD-107 — Phone normalizer unificado (bug em phones internacionais)

**Status:** Closed (audit 1.4.9, 2026-05-12)
**Severidade:** Media
**Closed em:** Audit pos-1.4.9 — fix aplicado mesmo dia da descoberta
**Validacao:** Suite 351/351 passando — Hotmart/Kiwify/Eduzz adapter tests verdes (zero regressao em PII existente). capi/hashing test cobre `+14155551234` → `14155551234` (sem `55` prepended).

**Descricao:** `src/lib/security/hash.ts:52` (`normalizePhoneE164`) assumia codigo de pais BR (55) pra qualquer phone com 10-11 digitos sem prefix, ignorando o `+` original. `+14155551234` (US) virava `+5514155551234`. Afetava hashes de phone enviados pra Meta CAPI / Google EC em clientes US/EU/etc + Hotmart/Kiwify/Eduzz adapters.

**Fix aplicado:**

1. `security/hash.ts:normalizePhoneE164` adicionou deteccao de `+` original — preserva country code declarado quando presente
2. `capi/hashing.ts` removeu reimplementacao local `normalizePhoneE164Internal` e voltou a importar de `security/hash.ts`
3. Edge case adicional: input invalido (sem `+`, <10 digits) agora retorna null em `normalizePhoneMeta`/`normalizePhoneGoogle` (antes retornava digits truncados)

**Arquivos modificados:**

- `src/lib/security/hash.ts:52-78` — fix do normalizer
- `src/lib/services/capi/hashing.ts:139-160` — workaround removido, importa security/hash

**Historico:**

- 2026-05-12: bug descoberto via teste falhando na hashing.ts da 1.4.9; workaround aplicado, TD aberto
- 2026-05-12 (mesmo dia): audit pos-1.4.9 → fix unificado em security/hash.ts, workaround removido, suite verde

### TD-109 — Pure gateway fanout: Purchase sem browser session nao chega ao Meta

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit pos-1.4.9 (P1 #3)
**Gate:** Quando primeiro cliente sem script Criation instalado conectar gateway (Hotmart-only customer).
**Manifesta hoje?** Nao — beta inicial assume cliente cola script Criation.

**Descricao:** Cenario: buyer clica ad Meta → vai direto pro checkout Hotmart (sem passar pela landing instrumentada com script Criation) → compra. Gateway webhook chega → `gateway_events` criado → **zero `tracking_events`** → fanout Meta CAPI nunca dispara (pipeline 1.4.9 le de `tracking_events`).

Impacto: promessa CDP "substitui Pixel+GTM+Stape pra **todos** os eventos" vira parcial. Purchase de buyer sem browser trace nao chega ao Meta server-side. Cliente depende de Pixel deles na thank-you page Hotmart (se tiverem configurado) pra Meta ver a venda.

**Fix sugerido (TD futuro):** task adicional `fanout-gateway-only` enfileirada em `process-gateway-event` quando `matched_visitor_id IS NULL` apos passar pelo matcher 1.4.B. Cria payload sintético com `action_source='system_generated'` + `event_id` deterministico (TD `dedup.ts`) + `user_data` so com hashed PII (email + phone + document_hash). Sem fbp/fbc/IP/UA — EMQ ~6 (ainda melhor que zero).

**Arquivo:** novo `src/lib/services/capi/gateway-only-fanout.service.ts` + extensao em `src/lib/trigger/tasks/process-gateway-event.ts`

**Historico:**

- 2026-05-12: audit pos-1.4.9 — gap arquitetural flaggado pra Fase 2

### TD-110 — EMQ baseline populate via Dataset Quality API

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, audit pos-1.4.9 (P2 #9)
**Gate:** Fase 2.4.5 (audit Meta original sugeriu)
**Manifesta hoje?** Coluna `capi_events.eventMatchQuality` existe e fica NULL. UI `/configuracoes/meta/eventos` nao mostra EMQ.

**Descricao:** Meta retorna EMQ async via Dataset Quality API (`GET /{pixel_id}/dataset_quality`). Wizard prometia "EMQ baseline" mas dado nao existe sem job cron consumindo essa API.

**Fix sugerido:** Trigger.dev task daily que pra cada workspace + pixel ativo chama Dataset Quality API, popula `capi_events.eventMatchQuality` por `event_name` agregado. UI mostra EMQ por evento.

**Workaround atual:** Wizard `/configuracoes/meta/eventos` nao menciona EMQ — header foi atualizado removendo a promessa. 1.4.9.5 valida EMQ manualmente via Events Manager UI.

**Historico:**

- 2026-05-12: documentado pos-1.4.9; deferido pra 2.4.5 conforme audit Meta original

### TD-111 — CTWA payload validation com Meta CAPI specs completas

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-12, audit pos-1.4.9 (P2 #10)
**Gate:** Antes do primeiro cliente com CTWA (Click-to-WhatsApp) ativo — diferencial BR.
**Manifesta hoje?** Nao — sem cliente com CTWA testado contra Meta real.

**Descricao:** `capi/meta.adapter.ts:decideActionSource` retorna `business_messaging` quando `ctwa_clid` presente + seta `messaging_channel='whatsapp'`. Meta CAPI v25.0 docs sugerem campos adicionais pra `business_messaging` events (ex: `recipient_type`, `recipient_id`, custom data structure pra conversational events). Nao validado contra payload real.

**Risco:** primeiro evento CTWA enviado pode ser rejeitado por Meta com `events_received=0` (agora capturado pelo audit P0 #2 fix, vira `failed` retry=false). Cliente perde EMQ pra eventos CTWA.

**Fix sugerido:** spike de 2-3h em 1.4.9.5 ou apos: enviar evento CTWA real via Test Events code, ler response Meta, ajustar payload. Documentar em meta.adapter.ts os campos obrigatorios.

**Historico:**

- 2026-05-12: audit pos-1.4.9 — flag pra validar em 1.4.9.5 shadow validation

### TD-112 — getMetaFanoutStats single query com FILTER

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-12, audit pos-1.4.9 (P2 #12)
**Gate:** Quando wizard `/configuracoes/meta/eventos` p95 > 500ms ou dashboard `/tracking` afetar UX.
**Manifesta hoje?** Nao — workspace vazio retorna em <50ms.

**Descricao:** `getMetaFanoutStats` faz 3 queries paralelas + 1 sequencial (pending count em `tracking_events`). Pra workspace com 100k+ eventos/dia, latencia empilha (~200ms na page load). Otimizavel pra 1 query com `count() FILTER (WHERE status = 'sent')` etc.

**Fix sugerido:**

```sql
SELECT
  COUNT(*) FILTER (WHERE status='sent' AND event_time > now() - interval '24h') AS sent_24h,
  COUNT(*) FILTER (WHERE status='failed' AND event_time > now() - interval '24h') AS failed_24h,
  COUNT(*) FILTER (WHERE status='skipped' AND event_time > now() - interval '24h') AS skipped_24h,
  MAX(sent_at) AS last_sent_at
FROM capi_events
WHERE workspace_id = $1 AND provider = 'meta';
```

Pending count em tracking_events fica separado (tabela diferente).

**Historico:**

- 2026-05-12: documentado pos-1.4.9 — defer ate manifestar

### TD-113 — AddressIdentifier.streetAddress vs payload addressLine drift

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P2-1)
**Gate:** Quando adapter Google popular address (precisa TD-115 — gateway events nao tem address hoje).
**Manifesta hoje?** Nao — buildUserIdentifiers em google.adapter.ts so embute email+phone; address fica vazio.

**Descricao:** TypeScript interface `AddressIdentifier` declara `streetAddress?: string` (linha 158 de google.adapter.ts), mas REDACT_PATHS no logger.ts redact `events[*].userData.userIdentifiers[*].address.addressLine`. Quando adapter for popular address (TD futuro pra extrair de gateway), qualquer dos dois esta errado: se usar `streetAddress`, payload nao redacta; se usar `addressLine` (correto per Data Manager API spec), o type esta defasado.

**Fix sugerido:** Renomear `streetAddress -> addressLine` no AddressIdentifier interface. Per Data Manager API docs, o campo correto e `addressLine`. Adicionar smoke test em logger.test.ts cobrindo o caminho com address populado.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — defer ate adapter popular address

### TD-114 — persistSkippedCapiEvent Google nao preenche googleCustomerId

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P2-3)
**Gate:** Quando analytics/dashboard filtrar `capi_events.googleCustomerId IS NOT NULL` pra contar skipped por conta.
**Manifesta hoje?** Nao — UI nao usa esse filter ainda.

**Descricao:** Quando build do payload Google retorna `skip`, `persistSkippedCapiEvent` insere row em `capi_events` com apenas workspaceId/provider/eventName/eventId/eventTime/status='skipped'/responseData. Campos Google-specific (`googleCustomerId`, `googleProductDestinationId`) ficam null mesmo quando o caller ja resolveu o account/mapping. Skip-reasons como `missing_destination` ou `missing_user_signal` tem account conhecido — poderia popular.

**Fix sugerido:** Refactor pra passar `account: GoogleAdsAccount | null` em `persistSkippedCapiEvent`. Quando presente, popular `googleCustomerId = account.customerId`.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — defer

### TD-115 — refresh_token rotation Google nao persistida

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P2-6)
**Gate:** Quando Google rotacionar um refresh_token em response a security event — proxima refresh falha com `invalid_grant`.
**Manifesta hoje?** Latente — Google rotaciona raramente, mas quando rotaciona quebra.

**Descricao:** `parseTokenResponse` (google.service.ts:200-207) inclui `refreshToken` na resposta do refresh. Mas ambos paths (refresh inline em google.service e cron em token-refresh.service) ignoram esse valor e nunca atualizam `encryptedRefreshToken`. Google docs dizem que refresh tokens raramente rotacionam, MAS podem em response a security events (suspeita de comprometimento, password change, etc).

**Fix sugerido:** Apos receber `refreshed = await refreshAccessToken(...)`, se `refreshed.refreshToken && refreshed.refreshToken !== refreshTokenPlain`, encryptar e atualizar `encryptedRefreshToken` no mesmo UPDATE. Probabilidade baixa, custo de fix baixissimo.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — fix custo baixo, defer ate primeiro caso

### TD-116 — Race condition cron + inline refresh Google access_token

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P3-1)
**Gate:** Quando volume cobrar reuso de access (workspace muito ativo).
**Manifesta hoje?** Nao — MVP volume baixo. Quota Google de refresh tokens (50/cliente) tolera desperdicio.

**Descricao:** Dois paths podem refreshar o mesmo access_token em janela <1s: cron diario 03:30 UTC + fanout chegando pra workspace ativo. Nao ha lock. Ambos UPDATEs sucedem (last writer wins), mas tokens intermediarios sao desperdiçados.

**Fix sugerido:** Postgres advisory lock `SELECT pg_try_advisory_xact_lock(hashtext(connection.id))` na transacao de refresh. Skip refresh se outro processo ja segurou o lock.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — defer ate manifestar

### TD-117 — google_ads_accounts soft-deleted preservando is_default=true

**Status:** Open
**Severidade:** Baixa
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P3-3)
**Gate:** Quando user re-OAuth resuscitar account previamente soft-deleted que era default.
**Manifesta hoje?** Latente — flow de re-OAuth nao testado pos-soft-delete.

**Descricao:** `setDefaultGoogleAdsAccount` query filtra `isNull(deletedAt)` no UPDATE. Se um account soft-deleted tinha `is_default=true`, a flag permanece. Re-OAuth via `replaceGoogleAdsAccounts` pode ressuscitar a row, gerando 2 rows com `is_default=true`.

**Fix sugerido:** Remover filtro `isNull(deletedAt)` do UPDATE em `setDefaultGoogleAdsAccount` (UPDATE todas accounts, incluindo soft-deleted, garantindo flag falsa em soft-deleted). OU ao soft-deletar accounts em `replaceGoogleAdsAccounts`, set `is_default=false` explicitamente.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — defer

### TD-118 — CTA "Reconectar Google" no wizard quando expired/invalid_grant

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (P3-4)
**Gate:** Quando primeiro user (interno ou cliente) vir `status='expired'` na UI sem saber resolver.
**Manifesta hoje?** Sim em teoria — qualquer revoke OAuth chega no estado.

**Descricao:** StatusBlock do wizard `/configuracoes/google/conversoes` mostra label "Scopes incompletos" + badge `×` quando granted\_\*\_scope = false. Mas nao oferece CTA "Reconectar Google". Apos audit P1-3 fix, connection com `status='expired'` tambem nao aparece como "conectado" (fica como NotConnectedFallback), mas user fica perdido se vir scopes incompletos sem botao de fix.

**Fix sugerido:** Em StatusBlock, quando `!scopesOk || connection.status === 'expired' || connection.refreshTokenInvalidatedAt`, mostrar botao "Reconectar Google" linkando pra `/configuracoes/conexoes#google` ou disparando OAuth flow direto via Server Action.

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B — sera implementado quando 1.4.9.5 detectar caso real

### TD-119 — Notificacao email "sua conexao Google expirou"

**Status:** Open
**Severidade:** Media
**Descoberto:** 2026-05-15, audit pos-1.4.9.B (TD novo)
**Gate:** Quando cron `google-token-refresh` flippar primeiro workspace pra status='expired'.
**Manifesta hoje?** Latente — workspace afetado descobre so quando entra no wizard.

**Descricao:** Cron `google-token-refresh-cron` detecta `invalid_grant` e marca connection `status='expired'` — mas user nao recebe nenhuma notificacao. Workspace silencioso pode levar dias pra perceber. Comentario "TD futuro" ja existe em `google-token-refresh.ts:21`.

**Fix sugerido:** Quando outcome.reason === 'invalid_grant' || 'expired' E status_anterior === 'active', enfileirar email via Resend. Template: "Sua conexao Google Ads precisa ser reconectada. Clique aqui pra autorizar novamente."

**Historico:**

- 2026-05-15: documentado pos-1.4.9.B

### TD-108 — Retention 30d pra plain IP/UA em tracking_events + gateway_events

**Status:** Open
**Severidade:** Alta
**Descoberto:** 2026-05-12, mapeamento arquitetural 1.4.9 (opcao B do IP/UA gap)
**Gate:** **Antes do primeiro cliente real** — LGPD exige retention policy explicita pra PII.
**Manifesta hoje?** Nao — sem cliente real produzindo dado.

**Descricao:** Migration 0015 adicionou `client_ip_address inet` + `client_user_agent text` em `tracking_events` (browser) e `gateway_events` (webhook buyer). Plain IP/UA sao **PII LGPD-sensitive** — armazenamento indefinido cria risco regulatorio.

Decisao arquitetural (1.4.9): plain e necessario pra Meta CAPI EMQ ≥ 7. Hash HMAC fica como signal estavel pra dashboard analytics (longo prazo). Plain deve ter **retention 30 dias** — janela suficiente pro Meta dedupar evento via Pixel browser e propagar ROAS attribution.

**Fix sugerido:** Trigger.dev cron daily 03:30 UTC (logo apos `create-tracking-partition`):

```sql
-- Job: purge_plain_pii_capi
UPDATE tracking_events
SET client_ip_address = NULL, client_user_agent = NULL
WHERE event_ts < now() - interval '30 days'
  AND (client_ip_address IS NOT NULL OR client_user_agent IS NOT NULL);

UPDATE gateway_events
SET client_ip_address = NULL, client_user_agent = NULL
WHERE created_at < now() - interval '30 days'
  AND (client_ip_address IS NOT NULL OR client_user_agent IS NOT NULL);
```

Batches de 10k pra evitar lock contention. Logs em `audit_logs` com count purged.

**Documentacao paralela:**

- Privacy Policy: declarar "IP/UA do checkout armazenados por 30 dias pra otimizacao de campanhas publicitarias (Meta CAPI, Google EC)"
- DPIA: documentar legitimate interest (base legal LGPD art. 7º IX) — proporcional e necessario pra ROI publicitario, retention curto, hash mantido pra analytics

**Arquivo:** novo `src/lib/trigger/tasks/purge-plain-pii.ts` + entry em ROADMAP (Fase 2 ou pre-cliente)

**Historico:**

- 2026-05-12: documentado durante 1.4.9 opcao B (plain IP/UA pra CAPI EMQ)

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
