# ADR-008 — Trigger.dev v3 para Jobs Assincronos

**Status:** Aceito
**Data:** 2025-04 (retroativo)
**Contexto:** O produto precisa executar tarefas de longa duracao: analises Claude (10-60s), sync de contas Meta Ads (minutos), processamento de webhooks com retry, envio de emails em batch.
**Drivers de decisao:** Observabilidade, retry com backoff, duracao de execucao (Vercel tem limite de 10s em Serverless), debugging em producao, custo.
**Opcoes consideradas:**
1. BullMQ + Redis proprio — controle total, custo de operacao alto
2. Vercel Cron — simples mas sem retry, sem duracao longa, sem observabilidade
3. Trigger.dev v3 — managed, steps com checkpoint, dashboard de debugging
4. Inngest — similar ao Trigger, menos maduro em retry granular

**Decisao:** Trigger.dev v3. Steps com checkpoint permitem retomar execucao sem reprocessar etapas anteriores (critico para pipelines Claude multi-step). Dashboard nativo mostra cada step, latencia, e erros. Retry com backoff exponencial configuravel por task. Integracao nativa com Vercel (deploy junto com o app).

**Consequencias:**
- Positivo: observabilidade excelente, retry granular, steps com checkpoint, sem infra propria, logs por execucao
- Negativo: vendor lock-in, custo por execucao em escala, latencia de cold start em tasks infrequentes
