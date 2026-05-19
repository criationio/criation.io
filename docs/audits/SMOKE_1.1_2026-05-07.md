# SMOKE — Sessao 1.1 (Auth) — 2026-05-07

Smoke manual da Sessao 1.1. Marcar `[x]` enquanto valida em ambiente de dev.

## Pré-requisitos

- [ ] `.env.local` populado com: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `HASH_SALT`, `RESEND_API_KEY` (ou ausente para fallback dev)
- [ ] Migration `0001_fine_excalibur.sql` aplicada no Supabase staging (`pnpm db:migrate`)
- [ ] RLS atualizado: rodar `src/lib/db/rls.sql` no SQL Editor do Supabase staging
- [ ] App rodando local: `pnpm dev` em `http://localhost:3000`

## Build & lint

- [ ] `pnpm tsc --noEmit` → 0 erros
- [ ] `pnpm lint` → 0 warnings
- [ ] `pnpm test` → 42+ testes verdes (5 arquivos)
- [ ] `pnpm audit:pii` → 0 hits

## Rate limit

- [ ] `curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"abcdef1234"}'` 4 vezes rápido com mesmo IP → 4ª retorna `429` com `error.code = RATE_LIMITED`

## Signup happy path

- [ ] Acessa `/signup`, preenche email novo + senha (`abcdef1234`)
- [ ] Submit redireciona para `/verificar-email`
- [ ] Email de verificação chega em `<30s` (caixa de entrada ou spam)
- [ ] Click no link do email → redireciona para `/bem-vindo`
- [ ] No banco:
  - [ ] `users.email_verified_at` → não-nulo
  - [ ] `credit_transactions` tem 1 row: `type='allocate'`, `source='signup_bonus'`, `amount=50`, `idempotency_key='signup_bonus_<userId>'`
  - [ ] `credit_balances` tem 1 row: `balance=50`, `signup_balance=50`, `signup_expires_at = NOW + 90d`
- [ ] `/bem-vindo` mostra "50 créditos" + dias até expirar
- [ ] Re-clicar o mesmo link de verificação → não duplica créditos (idempotência via idempotencyKey)

## Signup unhappy paths

- [ ] Mesmo email tenta segundo signup → erro inline "email já cadastrado"
- [ ] Senha curta (8 chars) → erro inline mostrando regra
- [ ] Senha sem dígito → erro inline
- [ ] Honeypot preenchido (DevTools: `document.querySelector('[name=honeypot]').value = 'bot'`) → submit fake-success redireciona para `/verificar-email` mas **nenhuma row criada** em `users` / `workspaces`

## Login

- [ ] Login email/senha errado → mensagem genérica "email ou senha incorretos"
- [ ] Login email/senha correto, email verificado → `/dashboard`
- [ ] Login email correto, **email não verificado** → mensagem específica "verifique seu email"
- [ ] Toggle "Link mágico" → submeter email → email recebido → click → cookie de sessão setado → redirect `/dashboard`

## Middleware gates

- [ ] Acessa `/dashboard` sem sessão → redirect para `/login`
- [ ] Acessa `/dashboard` com sessão mas email não verificado → redirect para `/verificar-email`
- [ ] Acessa `/estudio`, `/admin`, `/configuracoes`, `/bem-vindo` (não verificado) → redirect para `/verificar-email`
- [ ] Acessa `/login`, `/signup`, `/verificar-email` sempre permitido (não bloqueado)

## Reset de senha

- [ ] `/redefinir-senha` → submeter email existente → mensagem "se o email existir..."
- [ ] Email recebido → click → callback exchange code → redirect `/redefinir-senha/aplicar`
- [ ] Form aplicar: nova senha + confirma diferente → erro "senhas não coincidem"
- [ ] Form aplicar: nova senha válida → submit → redirect `/login?reset=ok` → banner verde
- [ ] Login com nova senha funciona

## Anti-fraude (D3)

- [ ] 4 signups consecutivos com mesmo IP em <1 min (curl ou DevTools)
- [ ] No banco: `audit_logs` tem 1 entry com `event_type='fraud_alert_signup_burst'`, `payload.count >= 3`, `ip_hash` igual ao hash do IP origem
- [ ] Os 4 signups completam normalmente (não bloqueia)

## Logout

- [ ] Logout → redirect `/login`
- [ ] Cookie de sessão removido (DevTools → Application → Cookies)
- [ ] Tentar `/dashboard` após logout → redirect `/login`

## Welcome email

- [ ] Após verificar email pela primeira vez, recebe email de boas-vindas
- [ ] Re-clicar link de verify (allocate retorna idempotent) → **não envia segundo email**

## Resultado

- Data: ******\_\_\_******
- Executor: ******\_\_\_******
- Status: ⬜ green / 🟡 yellow / 🔴 red
- Observacoes:
