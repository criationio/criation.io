# ADR-005 — UTM Stitcher em Cascata de 5 Niveis

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Correlacionar evento de gateway (venda confirmada) a uma campanha Meta para calcular ROAS Real. Nem todo clique tem fbclid, nem toda venda tem UTMs completos. Precisamos de fallbacks.
**Drivers de decisao:** Precisao da atribuicao, cobertura maxima (nenhuma venda "some"), transparencia do nivel de confianca.
**Opcoes consideradas:**
1. Match exato de UTMs apenas — perde vendas sem UTM padronizado
2. fbclid direto (click_id_store) — melhor precisao mas cobertura limitada
3. Match fuzzy com heuristicas — cobre mais mas menor confianca
4. Sem correlacao — exibe dados separados sem cruzamento

**Decisao:** Cascata de 5 niveis executada em ordem de confianca:
1. **Perfect match** (100%) — fbclid/gclid direto no click_id_store
2. **UTM exact** (90%) — todos os 5 parametros UTM batem com mapeamento
3. **UTM partial** (60-80%) — source + campaign batem, content/term ausentes
4. **Fuzzy** (40-60%) — heuristica temporal + produto + canal
5. **Unmatched** (0%) — vai para bucket "nao atribuidas"

Vendas nunca somem do sistema. Confidence score e visivel no dashboard.

**Consequencias:**
- Positivo: cobertura maxima, transparencia, metrica de UTM Health Score indica qualidade
- Negativo: complexidade de implementacao, necessidade de UI para match manual, possibilidade de falso positivo em fuzzy
