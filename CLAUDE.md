# CLAUDE.md — Criation.io

---

## 1. Stack Tecnica

- **Framework:** Next.js 15 (App Router, React 19, Server Components por padrao)
- **Linguagem:** TypeScript strict (`"strict": true`, `"noUncheckedIndexedAccess": true`)
- **Banco de dados:** Supabase (PostgreSQL) via Drizzle ORM — Supavisor em transaction mode
- **Auth:** Supabase Auth (email/senha + magic link)
- **ORM:** Drizzle + drizzle-kit para migrations
- **UI:** Tailwind CSS + shadcn/ui + next-themes (dark mode)
- **State:** Zustand (client state global) + TanStack Query v5 (server state + cache)
- **Validacao:** Zod (schemas) + neverthrow (Result<T, E> em vez de throw)
- **Jobs assincronos:** Trigger.dev v3
- **AI:** Claude API — modelo `claude-sonnet-4-20250514`
- **Email transacional:** Resend
- **Pagamentos:** Asaas (Brasil) + Stripe (internacional) — roteamento por pais
- **Observabilidade:** Sentry (erros) + PostHog (analytics) + Better Stack (uptime)
- **Deploy:** Vercel, regiao `gru1` (Sao Paulo)
- **Package manager:** pnpm 9.x (obrigatorio — nunca npm ou yarn)
- **Node:** >=20.10 <21

---

## 2. Comandos Essenciais

```bash
# Desenvolvimento
pnpm dev              # servidor local com hot reload
pnpm build            # build de producao
pnpm start            # serve o build

# Qualidade
pnpm lint             # ESLint — deve retornar zero erros
pnpm tsc --noEmit     # typecheck — deve retornar zero erros
pnpm test             # Vitest (unit + integration)
pnpm test:e2e         # Playwright (E2E — requer app rodando)

# Banco de dados
pnpm db:generate      # gera migration a partir do schema Drizzle
pnpm db:migrate       # aplica migrations pendentes
pnpm db:push          # push direto (apenas dev/staging — nunca em prod)
pnpm db:studio        # Drizzle Studio local
pnpm db:seed          # popular seeds iniciais

# Utilitarios
pnpm audit:pii        # checa padroes de PII nos arquivos de log
```

---

## 3. Regras de Arquitetura (as 20 leis)

Estas regras sao inegociaveis. Qualquer codigo que viole uma delas deve ser refatorado antes do merge.

**1. Server Actions sao thin controllers.**
Validam input com Zod, chamam um service, retornam `Result<T, AppError>`. Nenhuma logica de negocio dentro da action. Maximo ~30 linhas por action.

**2. Services encapsulam logica de negocio.**
Um service por dominio: `analysis.service.ts`, `meta.service.ts`, `claude.service.ts`, `billing.service.ts`, etc. Services podem chamar outros services. Services nunca chamam Server Actions. Services nunca importam componentes React.

**3. Queries Drizzle ficam em `lib/db/queries/`.**
Nunca dentro de uma action, nunca dentro de um componente, nunca inline num service sem abstracao. Cada arquivo de query exporta funcoes tipadas e testaveis individualmente.

**4. RLS sempre ativa.**
`service_role_key` e usada exclusivamente em: jobs Trigger.dev backend, admin actions com audit log obrigatorio. Qualquer outro uso e bloqueado em code review. Se precisar de service_role num contexto novo, abra PR de ADR primeiro.

**5. Nunca `any`.**
Use `unknown` quando o tipo vem de fonte externa (API, webhook, formulario). Valide com Zod antes de usar. TypeScript strict detecta `any` implicito — corrija na hora, nao suprime.

**6. Nunca `console.log` em producao.**
Use `lib/logger.ts` (pino). Os loggers de dominio ja estao configurados: `authLogger`, `billingLogger`, `analysisLogger`, `capiLogger`, `dbLogger`. ESLint tem regra `no-console` — nao suprime.

**7. Erros tipados via `AppError`.**
`lib/errors/AppError.ts` define discriminated union com todos os tipos de erro do dominio. Server Actions retornam `Result<T, AppError>`, nunca throw. Client trata o discriminant. Jamais `catch (e: any)` ou `catch (e: unknown)` sem narrowing.

**8. Dates sempre UTC no banco.**
`TIMESTAMPTZ` no Postgres. Formatacao em timezone local acontece apenas na camada de view, usando `Intl.DateTimeFormat` ou `date-fns-tz`. Nunca salve datas formatadas como string no banco.

**9. Money sempre em cents (integer).**
`R$ 49,90` e armazenado como `4990`. Nunca float. Operacoes aritmeticas em cents. Formatacao para display em `lib/utils/currency.ts` (`formatBRL(cents: number): string`).

**10. IDs sempre UUIDs gerados pelo banco.**
`DEFAULT gen_random_uuid()`. Nunca IDs sequenciais expostos em URL. Nunca IDs gerados no cliente.

**11. Sem modais nested, sem scroll horizontal.**
Excecao: tabelas muito largas com `overflow-x: auto` em container explicito. Fluxos complexos usam Sheet ou pagina dedicada, nao modal sobre modal.

**12. Server Components sao o padrao.**
`"use client"` apenas quando necessario: interatividade com state local, hooks de browser, event handlers. Toda busca de dados acontece em Server Components via async/await direto. Nunca `useEffect` para fetch de dados do servidor.

**13. Imagens sempre via `next/image`.**
`<img>` puro e bloqueado por ESLint. Defina `sizes` apropriado. Use `priority` apenas para above-the-fold critico.

**14. Links externos com `rel="noopener noreferrer"`.**
Configurado via lint rule. Nao suprime.

**15. CSRF em forms criticos.**
Server Actions nativas do Next.js tem protecao built-in. Route Handlers mutantes (POST/PUT/DELETE) precisam de double-submit cookie + verificacao de `Origin` header.

**16. Migrations zero-downtime — obrigatorio.**
Toda mudanca de schema segue 3 PRs em sequencia:
- **(a) Aditivo** — adiciona coluna nullable, indice `CONCURRENTLY`, FK sem constraint
- **(b) Backfill** — popula dados existentes, codigo passa a escrever na nova coluna
- **(c) Constraint** — adiciona `NOT NULL`/`UNIQUE`/`CHECK` quando backfill >= 99%

**17. ADR para decisoes arquiteturais significativas.**
Se voce esta escolhendo entre 2+ abordagens com trade-offs reais, escreva um ADR em `docs/adr/` no mesmo PR. Use template MADR: status, context, decision drivers, considered options, decision outcome. ~200 palavras.

**18. Testing standards por camada.**
- Services: coverage > 80%
- Utils e funcoes puras: coverage > 90%
- Server Actions: happy path + minimo 1 error path por action
- E2E (Playwright): 3 fluxos criticos obrigatorios
- Coverage threshold no CI: 70% global

**19. Correlation ID em toda request.**
Middleware Next.js gera `x-correlation-id` (UUID v4). `lib/correlation.ts` (AsyncLocalStorage) propaga pelo stack. Logger inclui automaticamente. Trigger.dev tasks carregam no `metadata`.

**20. Hard cap de custo Claude API por workspace.**
`claude.service.ts` verifica antes de cada request: Plano Pro -> budget R$40/mes, Agency -> R$120/mes. Se excedido, retorna `AppError.BudgetExceeded` — nao dispara request.

---

## 4. Anti-padroes (nunca faca)

```
- Retornar null/undefined de Server Actions — sempre Result<T, AppError>
- useState para dados do servidor — sempre TanStack Query
- process.env no client — use NEXT_PUBLIC_ prefix ou env.ts
- Commitar console.log, debugger, ou codigo comentado
- Emojis em codigo ou UI (exceto pedido explicito do usuario)
- Utility functions "just in case" — so quando ha 2+ usos concretos
- Logica de negocio em componentes React
- Fetch direto em useEffect — sempre TanStack Query
- Migrations destrutivas sem sequencia zero-downtime
- service_role_key fora de jobs/admin sem ADR aprovado
```

---

## 5. Convencoes de Nomenclatura

| Tipo | Convencao | Exemplo |
|---|---|---|
| Componentes React | PascalCase | `FunnelPyramid`, `BottleneckPanel` |
| Arquivos de componente | PascalCase.tsx | `FunnelPyramid.tsx` |
| Services | camelCase | `analysis.service.ts` |
| Hooks | use-prefix | `useAnalysis.ts` |
| Server Actions | verboResource | `createAnalysis`, `getUserBilling` |
| Validators Zod | camelCase + Schema | `createAnalysisSchema` |
| Queries Drizzle | verboEntidade | `getAnalysisByWorkspace` |
| Colunas no banco | snake_case | `workspace_id`, `created_at` |
| Tabelas no banco | snake_case plural | `analyses`, `ad_insights` |
| Variaveis de ambiente | UPPER_SNAKE_CASE | `ANTHROPIC_API_KEY` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRIES` |

---

## 6. Padroes de Commit (Conventional Commits)

```
feat(scope): descricao curta no imperativo
fix(scope): descricao
refactor(scope): descricao
chore(scope): descricao
docs(scope): descricao
test(scope): descricao
perf(scope): descricao
```

`scope` = modulo afetado: `auth`, `dashboard`, `analysis`, `billing`, `meta`, `gateway`, `capi`, `ui`, `infra`, `db`.

Exemplos validos:
```
feat(analysis): add quick pipeline with Claude streaming
fix(billing): correct prorate calculation on plan downgrade
chore(db): add index on analyses.workspace_id
```

---

## 7. Padrao de Branches

```
main      -> producao (deploy automatico via Vercel)
develop   -> staging (deploy automatico via Vercel)
feature/* -> desenvolvimento de features
fix/*     -> hotfixes
```

Nunca commit direto em `main`. PR de `develop -> main` exige aprovacao manual. PRs de feature sempre vao para `develop` primeiro.
