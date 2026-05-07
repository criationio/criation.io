# scripts/research

Scripts exploratorios e de calibracao. Nao fazem parte do build, nao sao chamados em runtime, nao tem contrato estavel. Cada arquivo aqui e um experimento isolado — leia o cabecalho de cada um para o proposito especifico.

## validate-pipeline-costs.js

**Status:** arquivado após validação informal pelo dono do projeto em ~02 maio 2026. Os custos reais medidos ficaram bem próximos das estimativas em pipeline_costs (dentro do limite de ±30% que o roadmap pede). Recalibração não foi necessária para a Fase 1. Output da rodada não foi salvo — informação preservada apenas na memória do dono.

**Origem:** rascunho de 2026-05-02 anterior a Sessao 0.4.

### O que faz

1. Para cada pipeline critico (`analisar.video_ad`, `analisar.deep`, `modelar.youtube`), dispara uma chamada simulada com prompt representativo.
2. Mede tokens reais consumidos (input + output) via response da SDK.
3. Calcula custo em USD aplicando os precos da Anthropic API (Claude Sonnet 4.6 — atualize o `PRICING` no topo do arquivo se a tabela mudou).
4. Converte para BRL usando `USD_TO_BRL` (atualize antes de rodar).
5. Compara com as estimativas de `V06_ESTIMATES_BRL` e os valores em creditos de `V06_CREDITS`.
6. Imprime relatorio com sugestao de ajuste por pipeline.

### Pre-requisitos

- `ANTHROPIC_API_KEY` exportado no shell.
- `@anthropic-ai/sdk` instalado (atualmente nao esta no `package.json` — adicionar como devDependency temporaria, ou instalar global apenas para esta execucao).
- Custo estimado de uma rodada completa: ~USD 0.20–0.50 dependendo dos pipelines ativos.

## Última calibração conhecida

- Data: ~02 maio 2026
- Executor: Vinicius (manual)
- Resultado: estimativas validadas, sem ajuste no seed
- Output salvo: não (gap a corrigir na próxima execução)

### Quando rodar

Antes da Fase 2 do sistema de creditos (Parte 4 do v0.6 da arquitetura), para recalibrar os valores de `pipeline_costs.cost_credits` com tokens reais medidos contra a Anthropic API em vez de confiar nas estimativas anteriores. Tambem rode novamente sempre que: (a) o modelo Claude default mudar de versao, (b) a Anthropic alterar os precos por mtok, ou (c) o conteudo dos prompts de algum pipeline mudar materialmente.

### Como rodar

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/research/validate-pipeline-costs.js > scripts/research/output/calibration-$(date +%Y-%m-%d).txt
```

Salve o output. Use os numeros para ajustar a seed de `pipeline_costs` na Fase 2.

### Quando deletar este script

Apos a Fase 2 ter rodado a calibracao, capturado o output, e populado `pipeline_costs` com os valores reais — este arquivo pode ser deletado. O conhecimento estara no banco e nos seeds. Mantenha o output da rodada como evidencia em `docs/audits/` ou ADR. Antes de deletar, garanta que o output da rodada foi salvo em `docs/audits/` ou ADR como evidencia permanente.
