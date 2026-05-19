# ADR-006 — Multi-tenancy com Workspaces e RLS

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Isolar dados de multiplos clientes na mesma base de dados. O produto e SaaS multi-tenant desde o dia 1. Precisamos balancear custo de infra com garantias de isolamento.
**Drivers de decisao:** Custo de infraestrutura, garantia de isolamento, complexidade operacional, escalabilidade.
**Opcoes consideradas:**
1. Schema-per-tenant — isolamento forte, operacao complexa (migrations em N schemas)
2. Banco-per-tenant — isolamento maximo, custo proibitivo em escala
3. Row-level com workspace_id + RLS — schema unico, isolamento via Postgres
4. user_id direto — simples mas nao suporta times/agencias

**Decisao:** Row-level multi-tenancy com `workspace_id` em todas as tabelas de dados de cliente + RLS always-on no Postgres (Supabase). Workspace como unidade de isolamento permite multiplos usuarios por conta (owner, admin, analyst).

**Consequencias:**
- Positivo: custo minimo (1 banco), migrations simples, RLS no Postgres e enforcement real (nao depende de codigo app), futuro suporte a agencias com multiplos workspaces
- Negativo: toda query deve filtrar por workspace_id (enforced por RLS mas devs devem estar cientes), risco de performance em tabelas muito grandes (mitigado com indices compostos)
