# ADR-011 — Auth pattern: @supabase/ssr + Server Actions

**Status:** Accepted
**Data:** 2026-05-07
**Sessao:** 1.1 — Autenticacao completa

## Contexto

Next.js 16 App Router (RSC default). Backend Supabase (DB + Auth + RLS via `workspace_id`). Session 1.1 introduz signup/login/reset/verify.

Precisamos:

- Session em Server Components, Server Actions e Route Handlers
- Cookie refresh transparente (sem useEffect/JS)
- Tipagem fim-a-fim
- Compatibilidade com 2FA TOTP (admin) e OAuth (Google) que entram em sessoes futuras

## Drivers de decisao

- Zero refactor quando entrar OAuth Google (1.x tech-debt) e 2FA TOTP (3.x admin)
- Compatibilidade com middleware existente (correlation-id, subdomain rewrite)
- Tipagem fim-a-fim sem `any`
- RLS workspace continua sendo applied via JWT do Supabase (nao mexer no contrato)

## Opcoes consideradas

1. **`@supabase/ssr` v0.10** — official SDK para Next.js SSR. Tres clients: browser, server, middleware. Suporta cookie helpers nativos, PKCE flow.
2. **Auth.js v5 (NextAuth)** — provider-agnostico. Custaria ~3 dias para criar custom Supabase adapter mantendo RLS workspace claim funcionando.
3. **Lucia v3** — DIY auth library. Mais controle, mas a equipe Lucia anunciou descontinuacao em mar/2024 — depreciado, nao recomendado.
4. **Custom JWT + cookies** — implementar do zero, apenas se houvesse motivos especificos. Nao temos.

## Decisao

Opcao 1 — `@supabase/ssr` v0.10.

Tres clients:

- `src/lib/supabase/client.ts` — `createBrowserClient` (Client Components)
- `src/lib/supabase/server.ts` — `createServerClient` async (RSC, Actions, Handlers) com `next/headers cookies()`. Tambem exporta `createServiceClient()` separado para uso narrowly-scoped (jobs, admin actions com audit).
- `src/lib/supabase/middleware.ts` — `updateSession(request)` helper retornando `{ response, user }` para o middleware raiz tomar decisoes de gate.

Server Actions para mutations (signup, login, reset, etc) com retorno discriminado `AuthOutcome<T>` — nunca redireciona dentro da action; o cliente faz `router.push` apos receber o result. Permite renderizar erros inline com `useActionState`.

## Consequencias

**Positivas:**

- Lock-in Supabase reforcado, mas ja tinhamos pelo DB+RLS — risco aceito
- Cookie refresh acontece transparente no middleware
- Tipagem fim-a-fim (Supabase types + Drizzle types + zod input schemas)
- Suporta PKCE OAuth flow (Google login na 1.x tech-debt entrara sem refactor)

**Negativas:**

- Cookies do Supabase sao opacos (nao conseguimos ler claims sem decodificar JWT manualmente)
- Migration para Auth.js no futuro custaria ~3 dias (custom Supabase adapter + reescrever Server Actions)

**Trade-offs aceitos:**

- Lock-in vs ergonomia (mantemos lock-in para shipping speed)
- service_role exposure narrowly-scoped via `createServiceClient()` separado de `createServerClient()` (que usa anon + cookies). ADR-009 reinforced.

## Implementacao

- 3 clients: `src/lib/supabase/`
- Server Actions: `src/lib/actions/auth.ts`
- Route Handlers: `src/app/api/auth/{signup,callback,callback/verify-email}/route.ts`
- Pages: `src/app/(auth)/{signup,login,redefinir-senha,redefinir-senha/aplicar,verificar-email,bem-vindo}/page.tsx`
- Middleware gate: `src/middleware.ts` redireciona nao-logado para `/login` e nao-verificado para `/verificar-email` em rotas protegidas
- Validators: `src/lib/validators/auth.ts`
- Service: `src/lib/services/auth.service.ts`
- Errors: `src/lib/errors/auth.ts` (`AuthOutcome<T>`, `AUTH_ERROR_CODES`)

## Migration paths futuros

- **OAuth Google (1.x tech-debt):** adicionar provider em `signInWithOAuth({ provider: 'google' })`. Sem refactor.
- **2FA TOTP admin (3.x):** Supabase Auth tem MFA built-in. Estender no admin shell sem reestruturar.
- **Auth.js (se algum dia):** ~3d. Manter `@supabase/supabase-js` no DB layer (Drizzle), substituir SSR layer.
