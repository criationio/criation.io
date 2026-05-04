# ADR-002 — Drizzle ORM vs Prisma

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Escolha de ORM para queries type-safe com Supabase PostgreSQL. O projeto precisa de migrations controlaveis, bundle otimizado para Vercel, e tipagem forte sem code generation.
**Drivers de decisao:** Bundle size (Vercel tem limites), tipagem em tempo de compilacao, controle sobre SQL gerado, overhead de runtime.
**Opcoes consideradas:**
1. Drizzle ORM — zero runtime overhead, schema-as-code TypeScript
2. Prisma — maduro, grande ecossistema, mas runtime engine pesado
3. Kysely — query builder puro, sem schema management
4. Query builder manual — controle total, sem tipagem automatica

**Decisao:** Drizzle ORM. Schema definido em TypeScript puro (sem DSL ou code generation). Zero runtime overhead — compila para SQL direto. Migrations geradas a partir do schema diff sao SQL puro auditavel. Bundle ~10x menor que Prisma para Vercel Edge/Serverless.

**Consequencias:**
- Positivo: bundle minimo, tipagem excelente, migrations SQL auditaveis, funciona perfeitamente com Supabase pooler
- Negativo: ecossistema menor que Prisma, documentacao menos extensa, menos middleware/plugins disponiveis
