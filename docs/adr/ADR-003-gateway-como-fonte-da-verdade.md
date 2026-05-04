# ADR-003 — Gateway como Fonte da Verdade para Conversoes

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** O Criation.io precisa exibir metricas de ROAS e conversao. Ha duas fontes possiveis: Meta Ads (reporta conversoes via pixel/CAPI) e gateways de pagamento (Hotmart, Kiwify, etc). Ambas divergem significativamente apos iOS 14.5+.
**Drivers de decisao:** Precisao da atribuicao, impacto de bloqueadores/iOS, confiabilidade do dado financeiro, transparencia para o usuario.
**Opcoes consideradas:**
1. Confiar nos dados do Meta (padrao da industria) — simples mas subcontado
2. Confiar no gateway — preciso em receita, perde granularidade de campanha
3. Cruzar ambos via UTM Stitcher — complexo mas mais completo

**Decisao:** Gateway e fonte da verdade para receita e conversoes. Meta e fonte para investimento e topo de funil (impressoes, cliques, CPM). UTM Stitcher correlaciona eventos de gateway com campanhas via fbclid/UTMs em cascata de confianca.

**Consequencias:**
- Positivo: ROAS Real sempre preciso, imune a subcontagem iOS, transparencia total para usuario
- Negativo: complexidade do UTM Stitcher, vendas sem UTM vao para bucket "nao atribuidas", dependencia de padronizacao de UTMs pelo usuario
