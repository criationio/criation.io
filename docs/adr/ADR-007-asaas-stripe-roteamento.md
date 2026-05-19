# ADR-007 — Roteamento Asaas + Stripe por Pais

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** Aceitar pagamentos de clientes brasileiros (maioria) e internacionais. Pix e boleto sao essenciais para conversao no Brasil. Cartao internacional precisa de gateway global.
**Drivers de decisao:** Conversao de checkout (Pix e critico no BR), custo de transacao, experiencia do usuario, complexidade de integracao.
**Opcoes consideradas:**
1. So Stripe — suporta BR mas Pix via terceiro, taxas maiores para cartao nacional
2. So Asaas — excelente para BR (Pix nativo, boleto), nao aceita cartao internacional
3. Stripe com Pix via intermediario — complexidade extra, latencia
4. Asaas + Stripe com roteamento por pais — duas integracoes, cobertura completa

**Decisao:** Asaas para Brasil (Pix, boleto, cartao nacional) e Stripe para internacional. Roteamento automatico por `country_code` do workspace. Lock de provedor apos primeira cobranca bem-sucedida para evitar fragmentacao de historico de pagamento.

**Consequencias:**
- Positivo: conversao maxima (Pix nativo), taxas otimizadas por mercado, experiencia localizada
- Negativo: duas integracoes para manter, webhook handlers distintos, reconciliacao em dois provedores, billing service mais complexo
