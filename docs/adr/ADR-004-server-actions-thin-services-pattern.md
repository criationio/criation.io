# ADR-004 — Server Actions Thin + Services Pattern

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Definir onde colocar logica de negocio numa arquitetura Next.js 15 App Router. Sem padrao claro, logica tende a se espalhar entre actions, componentes e API routes.
**Drivers de decisao:** Testabilidade da logica de negocio, separacao de concerns, reutilizacao entre contextos (action, job, webhook handler).
**Opcoes consideradas:**
1. Tudo na Server Action — simples mas inviavel de testar isoladamente
2. Tudo em API Routes — duplica infra de validacao, perde beneficios de Server Actions
3. Camada de services separada — mais arquivos, mas testavel e reutilizavel

**Decisao:** Server Actions como thin controllers (validacao Zod + chamada de service + retorno Result) + Services como dominio puro (logica de negocio, regras, orquestracao) + Queries isoladas em `lib/db/queries/` (acesso a dados tipado).

**Consequencias:**
- Positivo: services testaveis com mocks simples, reutilizaveis em jobs Trigger.dev e webhook handlers, action com max ~30 linhas
- Negativo: mais boilerplate por feature (action + service + query), curva de aprendizado inicial para novos devs
