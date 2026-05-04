# ADR-009 — Politica de Uso da service_role_key

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** A `service_role_key` do Supabase bypassa todas as politicas RLS. Seu uso indiscriminado anula a protecao multi-tenant. Precisamos de uma politica clara e auditavel.
**Drivers de decisao:** Seguranca multi-tenant, necessidade operacional (jobs precisam acessar dados cross-workspace), auditabilidade, principio do menor privilegio.
**Opcoes consideradas:**
1. Usar service_role sempre — simples mas anula o proposito do RLS
2. Nunca usar service_role — impossivel operar (jobs e admin precisam)
3. Politica explicita com audit log obrigatorio — equilibrio seguranca/operacao

**Decisao:** service_role exclusivamente em:
- Jobs Trigger.dev backend (sync Meta, processamento de webhooks, analises)
- Admin actions com INSERT obrigatorio em `admin_audit_log`

Todo uso fora desses contextos e bloqueado em code review. Novo contexto que precise de service_role exige PR de ADR justificando. Em runtime, o logger registra toda chamada com service_role incluindo correlation_id e user_id do admin.

**Consequencias:**
- Positivo: RLS efetivo para 99% das queries, audit trail completo, revisores tem regra clara
- Negativo: jobs precisam de cuidado extra para nao vazar dados entre workspaces, admin actions tem boilerplate de audit
