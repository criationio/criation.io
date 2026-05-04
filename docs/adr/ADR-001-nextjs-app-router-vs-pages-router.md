# ADR-001 — Next.js App Router vs Pages Router

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Escolha da arquitetura de roteamento do Next.js 15 para o Criation.io. O produto precisa de layouts complexos (sidebar fixa, paineis aninhados), streaming de respostas da Claude API, e performance otima em first-load.
**Drivers de decisao:** Performance de carregamento inicial, capacidade de streaming, reducao de JavaScript no cliente, complexidade de manutencao.
**Opcoes consideradas:**
1. App Router (React Server Components) — novo padrao, streaming nativo, layouts aninhados
2. Pages Router (legado estavel) — mais documentacao da comunidade, menos footguns

**Decisao:** App Router. Server Components por padrao reduzem bundle JS significativamente. Streaming nativo permite exibir resultados de analise Claude enquanto ainda estao sendo gerados. Layouts aninhados eliminam re-renders de sidebar/nav entre paginas. Server Actions substituem API Routes para mutacoes simples.

**Consequencias:**
- Positivo: bundle menor, streaming nativo, menos client-side JS, DX superior para data fetching
- Negativo: ecossistema de libraries ainda se adaptando, alguns patterns exigem workarounds (ex: cache invalidation manual), curva de aprendizado para devs acostumados com Pages Router
