# Criation.io

**Análise de criativos com IA para infoprodutores**

## Stack

Next.js 15 App Router, TypeScript strict, Tailwind CSS, shadcn/ui,
Drizzle ORM, Supabase, TanStack Query v5, Zustand, Zod, neverthrow,
Trigger.dev v3, pnpm, Vitest

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Preencha as variáveis no .env.local
pnpm dev
```

## Arquitetura

3 subdomínios com route groups no Next.js App Router:

| Subdomínio        | Route Group | Descrição                       |
| ----------------- | ----------- | ------------------------------- |
| `criation.io`     | `(public)`  | Landing page, preços, demo      |
| `app.criation.io` | `(app)`     | Portal do cliente (autenticado) |
| `adm.criation.io` | `(admin)`   | Painel administrativo           |

**Health check:** `GET /api/health`

## Documentação

Veja [`docs/`](./docs/) para a documentação completa da arquitetura.
