# ADR-012 — Tabela `audit_logs` para eventos de sistema

**Status:** Accepted
**Data:** 2026-05-07
**Sessao:** 1.1 — Autenticacao completa

## Contexto

A Sessao 1.1 introduz anti-fraude no signup (D3): se 3+ signups do mesmo `signup_ip_hash` em 24h, registrar um alerta `fraud_alert_signup_burst` para investigacao posterior. O signup nao bloqueia; o alerta serve como sinal observavel.

O schema existente tem `admin_audit_log`, mas semanticamente:

- `admin_audit_log.admin_user_id` e `NOT NULL` — exige que um admin tenha realizado a acao
- O escopo e "acoes deliberadas de admin no painel" (impersonation, mudanca de prompt, recalibracao de pipeline_costs)

Eventos de sistema gerados durante signup nao tem admin envolvido. Um usuario novo se registrando, sistema detectando padrao suspeito, sem qualquer interacao de admin.

Forcar `admin_user_id` com sentinel UUID (`00000000-...`) seria um hack que polui a auditoria de admin e mistura dois dominios distintos.

## Drivers de decisao

- Manter `admin_audit_log` como dominio puro de "acao deliberada por admin no painel"
- Suportar eventos de sistema sem actor humano (fraude detectada, password reset suspeito, alertas automaticos)
- Manter RLS estrita (auditoria nao deve vazar para users comuns)
- Schema generico o suficiente para reutilizacao em sessoes futuras (1.5 anti-bot onboarding, 2.x rate limit alerts, etc)
- Migracao aditiva, zero downtime (Regra 16)

## Opcoes consideradas

1. **Criar tabela `audit_logs` generica** — schema flexivel, RLS service-role, dominio separado de admin_audit_log. Custo: 1 migration aditiva pequena.
2. **Hackear `admin_audit_log` com sentinel** — zero schema change, mas semantica errada. Polui auditoria de admin e dificulta filtros futuros.
3. **Adiar D3 para tech-debt** — captura dos hashes (`signup_ip_hash` etc) ja existe, so o INSERT do alerta ficaria adiado. Custo: protecao desligada ate sessao futura. Risco: signups em escala antes do MVP fechar podem nao ter sinal de detecao.
4. **Estender `admin_audit_log` tornando `admin_user_id` nullable** — viola assumption original da tabela (todo registro tem admin actor). Caro semanticamente.

## Decisao

Opcao 1 — criar tabela `audit_logs` generica.

Schema:

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),  -- nullable (system events)
  actor_user_id uuid REFERENCES users(id),       -- nullable (system events sem actor)
  event_type text NOT NULL,                      -- 'fraud_alert_signup_burst', etc
  payload jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Indices: `event_type`, `workspace_id`, `created_at`.

RLS: `audit_logs_service_only` — `FOR ALL USING (auth.role() = 'service_role')`. Inserts e leitura via `createServiceClient()` apenas. Investigacoes admin acontecem via `/admin` (Sessao 3.x) com query direta.

## Consequencias

**Positivas:**

- Dominio claro: `admin_audit_log` para acoes admin, `audit_logs` para eventos sistema
- Reutilizavel: 1.5 onboarding, 2.x rate limit, 3.x admin alerts vao usar a mesma tabela
- Generico: novo `event_type` nao exige migracao
- RLS estrita: auditoria fica protegida

**Negativas:**

- Mais uma tabela para indexar e fazer backup (custo trivial em escala atual)
- `event_type` como text aberto pode levar a strings inconsistentes — mitigar com `EVENT_TYPES` constante exportada de `src/lib/constants/audit-events.ts` (criar quando primeiro consumer entrar)
- payload `jsonb` aberto exige documentacao por event_type (acrescentar nos comentarios de quem chamar `auditLogService.log()`)

**Trade-offs aceitos:**

- Tabela generica > tabela especifica por tipo (signup_alerts, password_alerts, etc) — preferimos abstracao agora a ter 5 tabelas similares depois.
- RLS service-only > RLS por workspace — auditoria de fraude nao deve ser visivel ao workspace alvo (alvo da fraude pode ser o workspace; vazar o sinal pode tipoff).

## Implementacao

- Schema: `src/lib/db/schema/audit.ts`
- Migration aditiva: `src/lib/db/migrations/0001_fine_excalibur.sql`
- RLS: `src/lib/db/rls.sql` (linhas adicionadas no fim)
- Servico (Sessao 1.1): `src/lib/services/audit.service.ts` — `logEvent(type, payload, ctx)` usando `createServiceClient()`
