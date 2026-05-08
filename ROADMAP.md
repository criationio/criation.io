# Criation.io — ROADMAP de Execução

> Plano de voo do desenvolvimento, do zero ao launch.
> Documento companheiro de [`criation-io-arquitetura-v06.html`](./docs/criation-io-arquitetura-v06.html), `CLAUDE.md` e `AGENTS.md`.

---

## Como usar este documento

1. **Vive no repo, na raiz**, ao lado de `CLAUDE.md` e `AGENTS.md`. Claude Code lê automaticamente.
2. **Cada sessão tem checkbox**. Marque `[x]` quando o PR for merged em develop.
3. **Referências `[v0.6 §X]`** apontam para a seção correspondente em `docs/criation-io-arquitetura-v06.html` — onde estão os comandos reais para Claude Code.
4. **Modelo de negócio = v0.6 Parte 4.** Toda dúvida sobre créditos, margem, planos, pacotes, trial, `signup_bonus`, expirações ou refunds: vai pra Parte 4 do v0.6. Este roadmap só _referencia_; a especificação completa está lá.
5. **Marcos de validação** são **gates**, não sugestões. Se um marco não foi atingido, **não avance de fase** — algo está quebrado e vai custar 5x mais consertar depois.
6. **Cada fase tem seu próprio "definição de pronto"**. Use como checklist de fechamento antes de declarar fase completa.
7. **Atualize o `## Status atual`** semanalmente. Te força a olhar honestamente para onde está.

---

## Status atual

**Última atualização:** 2026-05-08
**Fase ativa:** Fase 1 — Core Value
**Próxima sessão:** 1.2 — Shell do app (sidebar + topbar + command palette)
**Bloqueios:** _nenhum_

| Fase                     | Status          | Início     | Fim        | Notas                        |
| ------------------------ | --------------- | ---------- | ---------- | ---------------------------- |
| Fase 0 — Pré-dev         | ✅ Concluído    | 2026-04    | 2026-05-07 | 4 sessões + correção pós-0.5 |
| Fase 1 — Core Value      | 🟡 Em andamento | 2026-05-07 | —          | 1.1 fechada                  |
| Fase 2 — Consistência    | ⬜ Não iniciado | —          | —          | —                            |
| Fase 3 — Retenção        | ⬜ Não iniciado | —          | —          | —                            |
| Fase 4 — Polish + Launch | ⬜ Não iniciado | —          | —          | —                            |

Legenda: ⬜ não iniciado · 🟡 em andamento · ✅ pronto · 🔴 bloqueado

---

## Visão geral

| Fase                      | Duração            | Sessões | Marco final                                               |
| ------------------------- | ------------------ | ------- | --------------------------------------------------------- |
| **0** Pré-desenvolvimento | ~1 semana          | 4       | Repo + auth + design system rodando                       |
| **1** Core Value          | ~5-6 semanas       | 20      | 1º cliente pagante completou ciclo end-to-end             |
| **2** Consistência        | ~6 semanas         | 16      | 10-15 pagantes ativos, NPS positivo                       |
| **3** Retenção            | ~6 semanas         | 17      | 30-50 pagantes, margem positiva, loop de aprendizado vivo |
| **4** Polish + Launch     | ~2-3 semanas       | 10      | Product Hunt live                                         |
| **Total**                 | **~21-23 semanas** | **67**  | **Launch público**                                        |

**Filosofia de timeline:** estes números pressupõem desenvolvimento focado com Claude Code (Antigravity IDE), 4-6h produtivas/dia, sem grandes desvios para clientes da agência. Multiplique por 1.5x se mantiver carga paralela da AGC.

---

## Princípios não-negociáveis

Antes de tocar código, internalize estes 8 princípios. Eles previnem 80% dos erros comuns em SaaS multi-tenant.

1. **Multi-tenant desde o dia 1.** Toda tabela tem `workspace_id`. RLS habilitada de cara. Refactor depois custa semanas.
2. **CAPI Fase 1, não Fase 3.** Vendemos para infoprodutores que gastam R$10k-100k/mês em ads. Tracking server-side abaixo do que Stape oferece desqualifica o produto. [v0.6 §3.2 Sessão 1.4.9]
3. **Compliance Fase 1, não Fase 4.** Consent Mode v2 + LDU + PII redaction antes do launch. ANPD pode multar; Google bloqueia bidding sem consent. [v0.6 §3.2 Sessão 1.14.5]
4. **Hardening proativo, não reativo.** Threat model + CSP enforce + rate limit universal antes da Fase 3 trazer admin. [v0.6 §3.3 Sessão 2.15.5]
5. **Cost modeling antes de escalar.** Sem dashboard de custo infra, você só descobre que perde dinheiro quando o investidor pergunta. [v0.6 §3.4 Sessão 3.11.5]
6. **MVP é UM pipeline, mas com sistema de créditos rodando.** Estúdio Quick com `analisar.video_ad` na Fase 1 (1 crédito). Os outros 11 pipelines do Estúdio ficam para Fase 2. Mas o sistema de créditos (allocate, consume, paywall) é Fase 1 obrigatória — sem ele o billing não fecha. Ver Parte 4 do v0.6.

7. **Cobrar pela capacidade real consumida.** Pipelines têm custos 15x diferentes (R$0,30 a R$5). Modelo flat "X análises" quebra a margem com power users. Sistema de créditos garante margem 70% mínima em qualquer cenário. Custos editáveis via /admin/pipelines sem deploy. Recalibração trimestral obrigatória. Detalhamento em v0.6 §4.16.

8. **Estratégia antes de copy.** Quando precisar escrever VSL, copy de email, prompt — primeiro o argumento, depois o texto. Mesmo princípio que aplicamos no negócio digital.

---

## Decisões de stack que diferem do v0.5

O v0.5 foi escrito antes de algumas ferramentas amadurecerem e antes de validarmos o modelo de negócio. Estas decisões substituem o que está no documento de arquitetura — quando houver conflito, este roadmap prevalece. **A versão atualizada da arquitetura é o `criation-io-arquitetura-v06.html`** que incorpora todas estas mudanças.

1. **Modelo de negócio: sistema de créditos (Parte 4 do v0.6).** O v0.5 implicava modelo flat "X análises por mês" que quebra com pipelines de custos 15x diferentes (Quick R$0,30 vs Modelar YouTube R$5). v0.6 formaliza sistema de créditos: cliente compra capacidade computacional, pipeline consome proporcional ao custo real. Margem 70% garantida em qualquer cenário de uso. Planos: Starter R$197 (150 créd), Pro R$497 (375 créd), Agency R$997 (750 créd). Trial: 50 créditos no signup, válidos 90 dias. Pacotes overage: 100/300/700 créditos.

2. **Background jobs: Trigger.dev v3, não Inngest.** Trigger.dev v3 (lançado fim de 2024) roda jobs em compute dedicado long-lived sem timeout serverless, é open-source (Apache 2.0) self-hostável, e custa $10/mês contra $75/mês do Inngest. Crítico para análises Claude longas, processamento de áudio, e `step.sleep 14d` da Sessão 3.1. SDK: `@trigger.dev/sdk`. Local dev server: `npx trigger.dev@latest dev`.

3. **Web analytics: só PostHog na Fase 1, Plausible adiado para Fase 4.** PostHog tem web analytics cookieless built-in desde 2024 — Plausible vira redundância de $9/mês. Reavaliar na Fase 4 só se houver razão concreta (ex: dashboard público de tráfego para parceiro/investidor, ou se o script PostHog impactar Lighthouse na landing apesar de lazy-load).

4. **FFmpeg: avaliar job no Trigger.dev v3 antes de Railway worker (Sessão 2.1).** Como Trigger.dev v3 roda em compute dedicado long-lived, FFmpeg pode rodar nativamente como task — eliminando o worker no Railway e simplificando a stack. Decisão final na 2.1 após validar limites de CPU/memória contra carga real (vídeos típicos de 60-180s em 1080p).

5. **Better Stack** (renomeado de Better Uptime em 2022) é o nome atual da ferramenta de uptime monitoring. URL: `betterstack.com/uptime`.

---

## Fase 0 — Pré-desenvolvimento

> _"O zero é onde o produto se ganha ou se perde. Atalho aqui custa 100x depois."_

**Duração:** ~1 semana (16-20h)
**Sessões:** 0.1 → 0.4
**Detalhe completo:** [v0.6 §3.1](./docs/criation-io-arquitetura-v06.html#p3-1)

### Objetivo

Ambiente pronto para desenvolvimento. Repositório com CI/CD, schema completo com RLS, auth setup, design system com tokens, e CLAUDE.md/AGENTS.md operacionais.

### Pré-requisitos (antes da Sessão 0.1)

- [ ] Contas criadas: GitHub, Vercel, Supabase, Anthropic API, Asaas, Stripe, Resend, Sentry, PostHog, Better Stack, Trigger.dev, Upstash, Browserless, Deepgram (lista completa no v0.6 §3.1)
- [ ] Domínio comprado e DNS apontado
- [ ] Antigravity IDE instalado e Claude Code CLI configurado
- [ ] MCPs configurados: Supabase, GitHub, Vercel ([v0.6 §3.6])
- [ ] Skill `frontend-design` ativa no Claude Code
- [ ] Cartão corporativo conectado (vai gastar ~R$200-400/mês de infra ao longo do desenvolvimento)
- [ ] **Validação manual de custos de pipeline** (antes da Sessão 0.2). Testar 1-2 análises reais de cada pipeline crítico (Quick, Deep, Modelar YouTube) via Anthropic API direto, medir custo real em USD, converter para BRL, comparar com a tabela de v0.6 §4.3. Se diff > 30%, ajustar `pipeline_costs.cost_credits` no seed da Sessão 0.2 antes de aplicar. Sem isso, a margem 70% começa errada.

### Definição de pronto

- [ ] `pnpm dev` roda local sem erro
- [ ] Deploy vazio em Vercel funciona, domínio resolve com SSL
- [ ] Migrations aplicadas no Supabase, RLS habilitada
- [ ] **5 tabelas de créditos criadas** com RLS e seed inicial: `credit_balances`, `credit_transactions`, `pipeline_costs` (com 7 pipelines), `credit_packages` (com 3 packs), `pack_purchases` (especificação em v0.6 §4.9)
- [ ] **3 colunas adicionadas** em tabelas existentes: `subscriptions.credits_per_cycle/current_cycle_*`, `analyses.pipeline_id/credits_consumed/credit_transaction_id`, `users.signup_ip_hash/user_agent_hash/fingerprint` (anti-fraude trial)
- [ ] Componentes base do design system renderizam em /design-system (rota interna)
- [ ] CI/CD: push → tests → build → deploy automático
- [ ] CLAUDE.md, AGENTS.md, README.md commitados
- [ ] Coverage threshold (70%) configurado no CI
- [ ] Logger estruturado com PII redaction funcionando
- [ ] Correlation ID via AsyncLocalStorage propagando

### Marco de validação

**Nenhum.** Fase técnica, sem usuário envolvido. Mas dois ganchos críticos: se a 0.4 deixou tokens "razoáveis mas não bonitos", pare e revise (design system é base para tudo na Fase 4 — economia de 2h aqui custa 20h depois). E confirme que `SELECT * FROM pipeline_costs` retorna os 7 pipelines com `cost_credits` calibrados (não os defaults se você descobriu na validação manual que estavam errados).

### Sessões

- [ ] **0.1** — Inicialização do repositório e deploy vazio (~4h) — [v0.6 §3.1]
- [ ] **0.2** — Schema inicial, RLS e auth setup (~6-8h) — [v0.6 §3.1]
- [ ] **0.3** — CLAUDE.md completo + AGENTS.md + Skills Bible (~3h) — [v0.6 §3.1]
- [ ] **0.4** — Design system e tokens (~3h) — [v0.6 §3.1]

### Riscos

- **Subestimar a 0.2.** Schema completo com RLS multi-tenant + envelope encryption + 30+ tabelas (incluindo as 5 novas de créditos) pode levar 8-10h, não 6. Não pule edge cases de RLS — bug de RLS = vazamento de dados entre tenants.
- **Pular validação manual de custos antes da 0.2.** Custo: 1-2h gastando ~R$10 em testes da API Anthropic. Benefício: descobrir AGORA se Modelar YouTube custa R$5 ou R$8 (50% de diferença). Custo de descobrir depois do launch: cliente Agency em margem negativa, repricing emergencial, churn por mudança de regras.
- **Pular CLAUDE.md (0.3) achando que é cosmético.** É o documento que ensina o Claude Code como NÃO alucinar arquitetura nas 60+ sessões seguintes. Sem ele, retrabalho garantido. Inclua na Sessão 0.3 a referência ao v0.6 (especialmente Parte 4 sobre créditos) — sem isso, o Claude Code vai gerar código com modelo flat antigo.
- **Tokens "ok" no 0.4.** Bonito agora vira premium na Fase 4. Feio agora vira refactor doloroso.

---

## Fase 1 — Core Value

> _"Um cliente paga R$197 e tem na mão o que veio buscar. Tudo que não contribui pra esse caminho não existe na Fase 1."_

**Duração:** ~5-6 semanas (~90-110h)
**Sessões:** 1.1 → 1.15 (20 sessões, incluindo intermediárias 1.4.5-1.4.9, 1.7.5, 1.14.5)
**Detalhe completo:** [v0.6 §3.2](./docs/criation-io-arquitetura-v06.html#p3-2)

### Objetivo

Um cliente pagante completa o ciclo: signup → conectar Meta + Hotmart → ver dashboard real → rodar primeira análise → ver resultado.

Cada palavra desse parágrafo é gate. Se signup tem fricção, voltamos. Se Meta OAuth quebra, voltamos. Se análise demora 2 minutos, voltamos.

### Pré-requisito

Fase 0 com todos os checkboxes marcados.

### Definição de pronto

**Auth e Shell**

- [ ] Signup com email + password, verificação por email, password reset
- [ ] Sessão persiste, logout funciona, cookie banner LGPD-compliant ativo (substituído por Consent Mode v2 na 1.14.5)
- [ ] Shell: sidebar accordion v5, topbar, command palette `Cmd+K` com 10+ ações

**Conexão de dados**

- [ ] OAuth Meta Ads conecta e mantém token vivo (refresh automático)
- [ ] sync-campaigns.job roda a cada hora, atualiza campanhas/ad sets/ads/insights
- [ ] Hotmart conecta via webhook, eventos de sale chegam validados (HMAC)
- [ ] Kiwify, Eduzz, Monetizze, Ticto adapters funcionam (mesmo padrão do Hotmart)
- [ ] UTM Stitcher: 3 estratégias (manual, fuzzy match, AI suggestion) operando, mapeamentos persistem

**Tracking server-side (CAPI)**

- [ ] Meta CAPI dispara Purchase com EMQ ≥ 7.0
- [ ] Google Enhanced Conversions disparado em paralelo
- [ ] Click IDs (fbclid, gclid, ttclid, msclkid) capturados em cookie first-party 90d
- [ ] Event ID dedup funcionando (sem dupla contagem com pixel client-side)
- [ ] AEM priority order configurado para Meta
- [ ] Domain verification ativa no Meta Business

**Onboarding**

- [ ] Wizard 7 passos completa em <5 min: criar workspace → conectar Meta → conectar gateway → mapear UTMs base → configurar CAPI → primeira campanha sincronizada → tour rápido

**Dashboard e Campanhas**

- [ ] Dashboard funil 8 etapas: impressão → click → checkout iniciado → checkout abandonado → checkout completo → pagamento confirmado → reembolso → assinatura ativa
- [ ] /campanhas: lista paginada, filtros (período, status, ad network)
- [ ] /campanhas/[id]: detalhe com criativos + comparativo A×B

**Estúdio Quick**

- [ ] `analisar.video_ad` (1 pipeline = 1 crédito) gera análise completa em <30s
- [ ] Preview de custo obrigatório antes do botão "Analisar": "Esta análise vai consumir 1 crédito. Saldo: 49 → 48"
- [ ] Botão "Analisar" bloqueia automaticamente se `creditService.checkBalance` retorna ok=false
- [ ] Página de resultado com 8 seções: hook, retenção, copy, CTA, edição, oferta, áudio, recomendações
- [ ] Footer da página de resultado: "Esta análise consumiu 1 crédito · Saldo restante: 48"
- [ ] Typewriter effect durante streaming
- [ ] Polling otimizado (2s queued/running, evento real quando pronto)
- [ ] Refund automático em caso de pipeline failure (créditos voltam pro balde original)

**Cobrança e sistema de créditos**

- [ ] `creditService` implementado: `checkBalance`, `consume`, `allocate`, `refund`, `expireBatch`, `getHistory` (v0.6 §4.10)
- [ ] Atomicidade comprovada: teste de race condition (múltiplas análises paralelas com saldo limítrofe não causam saldo negativo)
- [ ] billing.service abstrato funciona com Asaas (BR) e Stripe (internacional)
- [ ] Webhook idempotency (processed_webhook_events) impede duplo processamento
- [ ] Webhook de pagamento aciona `creditService.allocate` para subscription/pack com idempotency_key correta
- [ ] Checkout: Starter R$197 (150 créd), Pro R$497 (375 créd), Agency R$997 (750 créd) com upgrade in-product e prorate automático
- [ ] /comprar-creditos com 3 packs (100/300/700 créditos) funcionando — Asaas one-time charge ou Stripe charge
- [ ] Trial: signup aloca 50 créditos com validade 90 dias automaticamente
- [ ] Anti-fraude: captura de IP hash, user agent hash, fingerprint no signup; alerta se 3+ signups do mesmo IP em 24h
- [ ] Topbar do app sempre visível com saldo atualizado via Realtime ou SSE
- [ ] Modal de paywall ao tentar análise com saldo insuficiente, com lógica de recomendação (pack vs upgrade conforme uso projetado)
- [ ] Página /configuracoes/billing/historico com lista paginada de credit_transactions
- [ ] `credit-expiration.task` rodando diário em Trigger.dev v3 (renova ciclos de subscription, expira signup_bonus e packs)

**Compliance e qualidade**

- [ ] Consent Mode v2 ativo: 4 parâmetros granulares, LDU enforcement automático
- [ ] PII redaction validado em produção: `pnpm audit:pii` retorna zero hits
- [ ] consent_logs imutável para auditoria ANPD
- [ ] 3 fluxos E2E críticos passam no CI: signup→primeira análise, webhook→dashboard update, checkout→plan upgrade

### Marco de validação (gate para Fase 2)

**Antes de iniciar a Fase 2, valide:**

- [ ] **3 betas convidados** — você + 2 founders/infoprodutores conhecidos. Não use pesquisa fria; use rede pessoal pra ter feedback honesto.
- [ ] **Cada beta completou o ciclo end-to-end pelo menos 1x.** Se algum não conseguiu, debugue antes de seguir.
- [ ] **Pelo menos 1 análise por beta com retorno qualitativo positivo.** Pergunta direta: "Isso te ajudou a melhorar algo? O quê?"
- [ ] **Pelo menos 1 cliente pagante.** Pode ser você mesmo com cartão real assinando o Starter — força você a passar pelo checkout, paywall, billing real.
- [ ] **Tempo médio do ciclo ≤ 15 min.** Se demora mais, há fricção a remover.
- [ ] **Zero crash em produção nos últimos 7 dias.** Sentry como verdade.
- [ ] **Custo real do pipeline Quick medido** após 50+ execuções reais. Diff vs estimativa em pipeline_costs deve ser ≤ 30%. Se &gt; 30%, recalibrar `cost_credits` antes de Fase 2 (porque Fase 2 traz 11 pipelines a mais e o erro escala).
- [ ] **Saldo de créditos zerado pelo paywall ao menos 1 vez** (você ou um beta). Confirma que o circuit breaker funciona.

⚠️ **Se algum desses falhar, NÃO avance.** Algo no core value está quebrado. Volte e corrija.

### Sessões

#### Semana 1 — Foundation

- [x] **1.1** — Autenticação completa (~5h) — [v0.6 §3.2]
- [ ] **1.2** — Shell do app: sidebar + topbar + command palette (~4h)
- [ ] **1.3** — Conexão OAuth Meta Ads (~3h)
- [ ] **1.4** — sync-campaigns.job (~4h)

#### Semanas 1-2 — Tracking & Atribuição

- [ ] **1.4.5** — Gateway adapter base + Hotmart integration (~5h)
- [ ] **1.4.6** — Kiwify adapter (~3h)
- [ ] **1.4.7** — Eduzz + Monetizze + Ticto adapters (~4h)
- [ ] **1.4.8** — UTM Stitcher service [cérebro da atribuição] (~5-8h)
- [ ] **1.4.9** — CAPI sender (Meta + Google Enhanced Conversions) (~6h) ⚠️ **crítico**
- [ ] **1.5** — Onboarding wizard 7 passos + alocação de 50 créditos signup_bonus (~4h)

#### Semana 2 — Dashboard & Campanhas

- [ ] **1.6** — Dashboard funil 8 etapas + topbar com saldo de créditos (~5h)
- [ ] **1.7** — /campanhas listagem + detalhe (~4h)
- [ ] **1.7.5** — `creditService` implementação completa: checkBalance, consume, allocate, refund, expireBatch, getHistory + atomicidade FOR UPDATE + ordem de consumo (~5h) ⚠️ **base do billing — não pule**

#### Semanas 2-3 — Estúdio Quick

- [ ] **1.8** — claude.service + bloco de transição + integração com creditService (pré-flight + consume on success) (~4h)
- [ ] **1.9** — `analisar.video_ad` (Quick) + fluxo /estudio/analisar/nova com preview de custo (~5h)
- [ ] **1.10** — Typewriter effect e polling otimizado (~2h)
- [ ] **1.11** — Página de resultado: 8 seções completas + footer com saldo após consumo (~4h)

#### Semana 3 — Billing

- [ ] **1.12** — billing.service abstrato (Asaas + Stripe) + integração com creditService.allocate em webhooks (~5h) ⚠️ **complexidade adicional**
- [ ] **1.13** — Checkout (planos + packs), paywalls com lógica de recomendação, upgrade in-product (~4h) ⚠️ **complexidade adicional**
- [ ] **1.14** — credit-expiration.task (Trigger.dev v3 daily) + alerts.job MVP (~3h)

#### Semana 4 — Compliance e fechamento

- [ ] **1.14.5** — Consent Mode v2 + LDU + PII redaction audit (~4h) ⚠️ **pré-requisito legal pro launch**
- [ ] **1.15** — Fechamento da Fase 1 (polish + smoke tests) (~3h)

### Riscos

- **Subestimar a 1.4.8 (UTM Stitcher).** É o cérebro da atribuição. Edge cases de UTM bagunçada (caracteres especiais, encoding errado, valores duplicados com case diferente) tomam horas. Reserve 8h, não 5h.
- **Pular 1.7.5 (creditService completo)** achando que dá pra "fazer só o consume na 1.8 e o resto depois". Não dá. allocate, refund, expireBatch, ordem de consumo precisam estar prontos antes de webhooks de pagamento (1.12) e do credit-expiration.task (1.14). Sessão dedicada de 5h economiza 15h de retrabalho.
- **Race condition na atomicidade do `consume`.** Sem `SELECT FOR UPDATE` no balance row, 2 análises paralelas podem deduzir simultaneamente e gerar saldo negativo. Teste explícito de race condition é obrigatório (v0.6 §4.11).
- **Pular 1.14.5 (Consent Mode v2)** pensando que dá pra fazer "depois do launch". Não dá. Custo agora: 4h. Custo após auditoria ANPD ou bloqueio Google: dezenas de horas + risco financeiro real.
- **Tentar incluir 12 pipelines do Estúdio na Fase 1.** O escopo do MVP é UM pipeline (`analisar.video_ad`). Os outros 11 vão na Fase 2. Não negocie isso com você mesmo.
- **Custos de pipeline divergentes da estimativa.** Se você não validou na pré-Fase 0 (1-2h gastando R$10), prepare-se para descobrir agora que Modelar YouTube custa R$8 e não R$5. Recalibre `pipeline_costs.cost_credits` via /admin/pipelines (Sessão 3.15) **antes** de Fase 2 trazer os outros pipelines com mesmo erro.
- **Beta com estranhos.** Convide 2-3 pessoas que vão te dar feedback honesto, não estranhos da internet que somem após o primeiro erro.
- **Pular smoke tests da 1.15.** Achar que "passou nos E2E" é suficiente. Smoke manual com clique a clique pega coisas que E2E não pega. Inclua: signup → trial 50 créditos alocados → análise → saldo cai → paywall ao zerar.

---

## Fase 2 — Consistência

> _"Funciona pra um caso" → "Funciona pra qualquer combinação razoável de gateway + plataforma + ad network"._

**Duração:** ~6 semanas (~80-100h)
**Sessões:** 2.1 → 2.15.5 (16 sessões)
**Detalhe completo:** [v0.6 §3.3](./docs/criation-io-arquitetura-v06.html#p3-3)

### Objetivo

O produto entrega valor consistente para diferentes tipos de operação. Estúdio completo (12 pipelines + 4 modos), alertas automáticos, Google Ads ao lado de Meta, colaboradores, transações de email confiáveis, hardening de segurança proativo.

### Pré-requisito

Fase 1 com **marco de validação atingido** (3 betas + 1 pagante real). Sem isso, Fase 2 é castelo de areia.

### Definição de pronto

- [ ] Processamento de áudio (FFmpeg) funcionando — via task Trigger.dev v3 ou worker Railway, decidido na 2.1; extrai áudio em <60s
- [ ] Deepgram transcreve com diarização e timestamps
- [ ] **Os 12 pipelines do Estúdio funcionam** em 4 modos: Analisar, Modelar, Variar, Comparar
- [ ] **Cada um dos 11 pipelines novos tem `cost_credits` calibrado** em pipeline_costs com base em medições reais (não defaults)
- [ ] **Preview de custo em créditos obrigatório** em todo botão "Analisar" / "Modelar" / "Variar" / "Comparar"
- [ ] Browserless extrai sales pages corretamente (HTML + screenshots full-page)
- [ ] /admin/capi-observability mostra EMQ por evento, alerta se cair abaixo de 7.0
- [ ] tracking.service centralizado (formaliza o stub da 1.4.9)
- [ ] /referencias funcional como biblioteca curada (não marketplace)
- [ ] alerts.job dispara 11 tipos: queda CTR, custo subindo, conversão caindo, criativo fadigando, etc.
- [ ] **Alertas de créditos ativos**: `credits_running_low`, `credits_expiring_soon`, `pack_repurchase_pattern` (sugere upgrade) — v0.6 §4.16
- [ ] Push PWA funciona em iOS 16.4+ e Android
- [ ] **SSE streaming real** durante análises (não polling)
- [ ] Google Ads conectado via OAuth, sync de campanhas funciona em paralelo ao Meta
- [ ] Colaboradores: 3 roles (owner, admin, analyst), convites por email
- [ ] **17 emails transacionais** com domínio autenticado (SPF, DKIM, DMARC), templates revisados
- [ ] /produtos com mapeamento manual completo (gateway product → product no app)
- [ ] Segmentação do funil por escopo (campaign, adset, ad, creative)
- [ ] **Threat model STRIDE** documentado em `docs/threat-model.md`
- [ ] CSP em modo enforce (não Report-Only) sem violations em prod
- [ ] **Rate limit universal** em todos endpoints sensíveis
- [ ] CSRF protection completa em Route Handlers mutantes

### Marco de validação (gate para Fase 3)

- [ ] **10-15 clientes pagantes ativos** (não trials, pagantes mensais recorrentes)
- [ ] **Pelo menos 5 em planos Pro ou Agency** (não só Starter — Starter sozinho não paga infra)
- [ ] **NPS ≥ 30** (escala -100 a +100; 30+ é "produto serve")
- [ ] **Pelo menos 3 retornos orgânicos:** clientes que voltaram numa segunda semana sem você empurrar
- [ ] **Tempo médio de análise ≤ 2 min** (incluindo upload de vídeo até resultado renderizado)
- [ ] **Zero incidentes P1** nos últimos 14 dias
- [ ] **Margem agregada por plano ≥ 65%** (medida via `/admin/financeiro` planejado pra Fase 3, ou planilha temporária com dados de credit_transactions). Se algum plano cair abaixo, recalibrar `cost_credits` antes de Fase 3 (v0.6 §4.16).
- [ ] **Custos reais por pipeline calibrados** com dados reais (não mais estimativa). Diff de cada pipeline vs estimativa em `pipeline_costs.estimated_real_cost_brl` ≤ 15%. Aceitável até 30%, mas obrigatório recalibrar antes da Fase 3.
- [ ] **Pelo menos 1 cliente comprou pack** de overage (valida que o fluxo funciona em produção, não só em testes).

### Sessões

#### Semanas 5-6 — Áudio + pipelines completos

- [ ] **2.1** — Processamento de áudio (FFmpeg): decidir Trigger.dev v3 task vs Railway worker e implementar (~4-5h)
- [ ] **2.2** — Deepgram integration (~3h)
- [ ] **2.3** — Estúdio Deep + restante dos 12 pipelines (~6h)
- [ ] **2.4** — Browserless.io integration (~3h)
- [ ] **2.4.5** — /admin/capi-observability + tracking.service centralizado (~4h)
- [ ] **2.5** — Otimização pipelines sales_page (caching + paralelização) (~3h)

#### Semanas 7-8 — Referências + Alertas + Streaming

- [ ] **2.6** — Análise de referências (4 tipos) (~4h)
- [ ] **2.7** — alerts.job completo (11 tipos) (~3h)
- [ ] **2.8** — /alertas central completa + push PWA (~4h)
- [ ] **2.9** — SSE streaming real das análises (~3h)
- [ ] **2.10** — Google Ads integration (~4h)

#### Semanas 9-10 — Colaboração + Email + Closing

- [ ] **2.11** — Colaboradores com 3 roles (~3h)
- [ ] **2.12** — 17 emails transacionais completos (~4h)
- [ ] **2.13** — /produtos completo + mapeamento (~3h)
- [ ] **2.14** — Segmentação do funil por escopo (~2h)
- [ ] **2.15** — Fechamento Fase 2 — auditoria + polish (~3h)
- [ ] **2.15.5** — Threat model + CSP enforce + rate limit universal (~5h) ⚠️ **hardening pré-escala**

### Riscos

- **Pular a 2.15.5 (hardening).** É a sessão menos divertida da Fase 2 e a mais importante. Depois que /admin entra no ar na Fase 3, retrofit de threat model + CSP enforce custa o triplo. Faça agora.
- **SSE com mock ao invés de stream real.** Vai parecer que funciona. Quando abrir 50 análises simultâneas em produção, latência percebida explode.
- **Escopo creep em /referencias (2.6).** É **biblioteca curada**, não marketplace de criativos da galera. Cada hora gasta em "feature legal" aqui é hora não gasta no loop de aprendizado da Fase 3, que é o diferencial real.
- **Os 12 pipelines em massa.** Implemente em ondas: primeiro Analisar (4 pipelines), depois Modelar (4), depois Variar+Comparar (4). Cada onda revisada e mergeada antes da próxima começar.
- **Email transacional sem autenticação de domínio.** Mandar email do `criation.io` sem SPF/DKIM/DMARC = 30%+ vai pra spam. Configure no início da 2.12, não no final.

---

## Fase 3 — Retenção

> _"O produto fica mais inteligente quanto mais é usado, e o admin opera o negócio sem SQL ad-hoc."_

**Duração:** ~6 semanas (~90-110h)
**Sessões:** 3.1 → 3.16 (17 sessões)
**Detalhe completo:** [v0.6 §3.4](./docs/criation-io-arquitetura-v06.html#p3-4)

### Objetivo

Pegar o **diferencial único** do Criation que ninguém mais tem: o **loop de aprendizado** (measure outcome → match copy → aggregate → improve prompts) e construir o admin operacional para escalar para 100+ clientes sem você queimar gasolina manualmente.

### Pré-requisito

Fase 2 com marco de validação atingido (10-15 pagantes, NPS ≥ 30).

### Definição de pronto

**Loop de aprendizado**

- [ ] measure-outcome.job aguarda 14 dias (`step.sleep`) e mede performance real do criativo após análise
- [ ] Tela "Antes/Depois" em cada análise: usuário vê o que mudou e o impacto numérico
- [ ] learning_signals coleta todos eventos relevantes (analise gerada, recomendação aplicada, métrica subiu/desceu)
- [ ] match-copy.job semanal: identifica padrões em copies que performaram bem por nicho
- [ ] learning-aggregation.job + views: dados agregados alimentam prompts canary

**Admin operacional**

- [ ] Admin shell com role `super_admin`, controle de acesso, audit log
- [ ] /admin: dashboard de negócio (MRR, ARR, churn, LTV, CAC, NPS)
- [ ] /admin/usuarios: lista, busca, filtros, **impersonation com timeout de 30 min**, audit log de toda ação admin
- [ ] /admin/prompts: versioning semver, **canary deploy** (5% → 25% → 100%), rollback 1-clique
- [ ] /admin/claude: observability de toda request (latência, custo, output token, model)
- [ ] /admin/jobs: status Trigger.dev v3, retry manual, dead letter queue

**Cost & Operations**

- [ ] **/admin/financeiro completo** (v0.6 §4.16): MRR/ARR por plano, margem agregada por plano, margem por crédito vendido, % clientes em margem negativa, custo médio por análise/pipeline, burn rate Anthropic API
- [ ] **Drill-down por cliente** com sugestões automáticas (contactar, sugerir upgrade, marcar VIP)
- [ ] **5 alertas automáticos de margem** ativos: margem agregada < 65%, cliente individual em margem negativa por 30 dias, pipeline 30%+ acima do estimado, mudança preço Anthropic > 15%, burn rate > 2x média
- [ ] **Relatório financeiro mensal** automatizado (gerado dia 1 do mês, distribuído via email + Slack)
- [ ] **Recalibração trimestral** documentada como processo (mesmo que primeira execução não tenha mudanças)
- [ ] **DR runbook** em `docs/disaster-recovery.md` testado em staging (restore de backup funciona)
- [ ] **Feature flags operacionais** (não mais stub) — ligar/desligar features sem deploy
- [ ] /admin/saude com SLOs em tempo real

**CAPI premium**

- [ ] Eventos completos: Lead, CompleteRegistration, AddToCart, ViewContent (além de Purchase, IC já implementados)
- [ ] Predicted LTV via modelo simples por cohort
- [ ] Customer Match sync para Agency (lista de clientes de alto valor para lookalike)
- [ ] Attribution settings configuráveis pelo usuário (1d/7d/28d click, 1d view)

**Compliance e ops**

- [ ] DPIA LGPD assinado em `docs/dpia-lgpd.md`
- [ ] Runbooks operacionais em `docs/runbooks/` (incidentes comuns)
- [ ] Diagramas de arquitetura atualizados em `docs/architecture/`
- [ ] Exportações PDF/CSV/XLS/JSON robustas com queue e download seguro
- [ ] Programa de afiliados completo (links únicos, rastreio, comissões, payout)
- [ ] PWA instalável (manifest, service worker, offline shell, push notifications)
- [ ] /admin/pipelines: configurar prompts, modelos, parâmetros sem deploy
- [ ] /admin/pipelines: **editar `cost_credits` de cada pipeline** com preview de impacto ("Mudar Modelar YouTube de 15 para 17 afeta 12% dos usuários ativos. Margem agregada de Agency vai de 74% para 76%"). Histórico em `pipeline_costs_history`. v0.6 §4.3.

### Marco de validação (gate para Fase 4)

- [ ] **30-50 clientes pagantes** ativos
- [ ] **Margem agregada por plano ≥ 70%** em Pro e Agency, ≥ 50% no Starter (Starter pode ser quase break-even em escala baixa). Medida via /admin/financeiro do v0.6 §4.16.
- [ ] **% de clientes em margem negativa < 2%** (idealmente 0). Se há cliente em margem negativa, decisão consciente de admin (cliente VIP, custo de aquisição já amortizado).
- [ ] **Burn rate Anthropic API ≤ 30% da receita total** (custo direto de Claude API não pode passar de 30% pra deixar espaço pra outros custos + lucro).
- [ ] **Pelo menos 1 caso documentado** de "usuário melhorou ROAS após análise" — confirmado pelo measure-outcome.job, não auto-relato.
- [ ] **Loop de aprendizado deu ao menos 1 ciclo completo:** insights da agregação semanal foram aplicados em prompt canary, ROI das análises subiu mensuravelmente.
- [ ] **Zero downtime > 30 min** no último mês.
- [ ] **Churn mensal ≤ 8%** (saudável para SaaS B2B; >12% sinaliza problema de produto).
- [ ] **NPS ≥ 50** (subiu desde a Fase 2).
- [ ] **Recalibração trimestral de pipeline_costs executada** ao menos 1 vez (mesmo que sem mudanças). Provoca o hábito.

### Sessões

#### Semanas 11-12 — Loop de aprendizado

- [ ] **3.1** — measure-outcome.job (`step.sleep` 14d) (~4h)
- [ ] **3.2** — Tela "Antes/Depois" em análises (~3h)
- [ ] **3.3** — learning_signals coleta completa (~3h)
- [ ] **3.4** — match-copy.job (weekly) (~3h)
- [ ] **3.5** — learning-aggregation.job + views (~4h)

#### Semanas 13-14 — Programa de afiliados + Admin

- [ ] **3.6** — Programa de afiliados completo (~4h)
- [ ] **3.7** — Admin shell + controle de acesso (~3h)
- [ ] **3.8** — /admin dashboard de negócio (~4h)
- [ ] **3.9** — /admin/usuarios + impersonation (~4h)
- [ ] **3.10** — /admin/prompts com versioning + canary (~4h)
- [ ] **3.11** — /admin/claude + /admin/jobs observability (~3h)
- [ ] **3.11.5** — /admin/financeiro completo (margem agregada por plano, % clientes negativos, custo por pipeline real vs estimado, burn rate Anthropic) + DR runbook + Feature flags + alertas automáticos de margem (~6h) ⚠️ **operações sustentáveis · v0.6 §4.16**

#### Semanas 15-16 — CAPI premium + Compliance + Polish

- [ ] **3.12** — CAPI expansion: eventos completos + predicted LTV + Customer Match (~6h)
- [ ] **3.13** — Exportação robusta (PDF/CSV/XLS/JSON) (~3h)
- [ ] **3.13.5** — DPIA LGPD + runbooks + diagramas (~5h)
- [ ] **3.14** — PWA completo (~3h)
- [ ] **3.15** — Pipeline Configuration admin (~5h)
- [ ] **3.16** — Fechamento Fase 3 (~3h)

### Riscos

- **Subestimar a 3.11.5 (cost modeling).** Você está prestes a queimar margem. Sem dashboard de custo infra, você só descobre que perde dinheiro quando alguém pergunta. Implemente.
- **Admin "meia bomba".** Se vai ter /admin/prompts, **tem que ter canary deploy**. Backdoor admin sem proteção = chance de quebrar produção em 100 clientes ao mesmo tempo. Faça completo ou não faça.
- **Pular DPIA LGPD (3.13.5).** Relatório de impacto é obrigatório para SaaS B2B sério. Cliente Agency vai pedir auditoria — não ter DPIA = perder contrato grande.
- **Loop de aprendizado sem dados suficientes.** Com 30 clientes, agregações podem ter ruído alto. Aceite que os primeiros ciclos do learning serão diretivos (você revisa manualmente) antes de virar autônomo.
- **Programa de afiliados antes do produto reter.** Atrair via afiliação produto que ainda churna 20%/mês = jogar dinheiro fora. Se NPS está abaixo de 50 no início da Fase 3, considere atrasar a 3.6.

---

## Fase 4 — Polish + Launch

> _"O produto parece feito por uma empresa de 50 pessoas, não por um founder com Claude Code."_

**Duração:** ~2-3 semanas (~30-40h)
**Sessões:** 4.1 → 4.10 (10 sessões)
**Detalhe completo:** [v0.6 §3.5](./docs/criation-io-arquitetura-v06.html#p3-5)

### Objetivo

Cada toque, cada transição, cada empty state pensado. Performance verde no Lighthouse. Segurança auditada externamente. Acessibilidade WCAG AA. Launch público no Product Hunt.

### Pré-requisito

Fase 3 com marco de validação atingido (30-50 pagantes, margem positiva, loop de aprendizado vivo).

### Definição de pronto

**Polish visual**

- [ ] Design system auditado, refinos aplicados (espaçamento, tipografia, hierarquia)
- [ ] Micro-animações em transições, hover states, loading, empty states
- [ ] Landing page final com demo interativo (não só vídeo)
- [ ] **Página /precos final com créditos como unidade clara** ("Pro: R$497/mês — 375 créditos. Veja o que cabe: ~75 análises Deep, ou 25 Modelar YouTube") + tooltip "como funcionam os créditos"
- [ ] Onboarding polido + 100% empty states cobertos com mensagem útil
- [ ] **Empty state "Sem créditos suficientes" pulido** com CTAs claros (pack vs upgrade)
- [ ] Páginas de erro 404, 500, 503 customizadas e na voz do produto

**Unit economics confirmadas**

- [ ] **Margem agregada por plano ≥ 70% Pro/Agency, ≥ 50% Starter** nos últimos 30 dias antes do launch
- [ ] **Zero clientes em margem negativa** (ou todos os negativos com flag explícita "VIP/aceitável")
- [ ] **`pipeline_costs` calibrado** com dados reais dos últimos 90 dias, diff vs estimativa ≤ 15%
- [ ] **Cost dashboard estável** — métricas atualizam sem erro, alertas configurados

**Performance**

- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 90, Best Practices ≥ 95
- [ ] Core Web Vitals todos em verde (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Bundle size auditado, chunks lazy-loaded apropriadamente
- [ ] Imagens otimizadas (next/image), fonts com `font-display: swap`

**Qualidade**

- [ ] 3 fluxos E2E críticos com 0% flaky em 50 runs consecutivos
- [ ] Coverage ≥ 80% global, ≥ 90% em utils e services
- [ ] Zero erro JS no Sentry de severity error nos últimos 7 dias

**Segurança**

- [ ] OWASP Top 2021 auditado (já parcialmente coberto pela 2.15.5; aqui é validação final)
- [ ] Penetration test executado por consultor externo
- [ ] Bug bounty configurado (HackerOne ou alternativa)
- [ ] 2FA admin enforcement validado
- [ ] Logs sem PII confirmado em produção

**Acessibilidade**

- [ ] WCAG AA: contraste, navegação por teclado, screen reader compatibility
- [ ] axe-core CI passando sem violations em rotas principais

**Observability**

- [ ] SLOs definidos e monitorados:
  - 99.5% uptime mensal (budget de erro: 3.6h)
  - p95 latência dashboard < 500ms
  - p95 latência análise quick < 30s
  - error rate < 0.1%
- [ ] /admin/saude mostra SLOs em tempo real
- [ ] Better Stack monitorando todos endpoints críticos
- [ ] Sentry com sourcemaps em todas camadas
- [ ] Runbook de incident em `docs/incident-runbook.md`

**Launch**

- [ ] Domínio final com SSL
- [ ] Emails autenticados (SPF, DKIM, DMARC)
- [ ] Backup automático testado (restore em staging funciona)
- [ ] Status page pública (Better Stack)
- [ ] Email `suporte@criation.io` ativo
- [ ] Documentação para usuários completa em `/ajuda`
- [ ] 5 artigos de blog seed publicados
- [ ] Press kit: logo variações, screenshots, 1-pager, fundador bio
- [ ] Product Hunt assets: hunter engaged, gallery images, video demo 60s, comment 1º preparado
- [ ] Threads sociais drafted (Twitter, LinkedIn)
- [ ] Email para lista beta drafted

### Marco de launch

- [ ] **Product Hunt live** numa terça ou quarta (melhor performance histórica)
- [ ] **Mínimo 100 upvotes nas primeiras 4h** (validação básica de tração)
- [ ] **Status page mostra 100% uptime no dia**
- [ ] **Você em standby 8-10h no dia D** pra responder comentários e capturar feedback

### Sessões

- [ ] **4.1** — Design system final (audit + refinos) (~4h)
- [ ] **4.2** — Micro-animações e transições (~3h)
- [ ] **4.3** — Landing page final + demo interativo (~5h)
- [ ] **4.4** — Onboarding polido + empty states (~3h)
- [ ] **4.5** — Performance audit e otimização (~4h)
- [ ] **4.6** — Testes E2E completos dos 3 fluxos críticos (~3h)
- [ ] **4.7** — Security audit (OWASP) (~3h)
- [ ] **4.8** — Accessibility (WCAG AA) (~3h)
- [ ] **4.9** — Observability de produção + SLOs (~3h)
- [ ] **4.10** — Launch checklist + Product Hunt (~2h)

### Riscos

- **Polish sem fim.** Estabeleça budget de 3 semanas máx. Refinos infinitos não vendem mais; lançamento sim. Se a Fase 4 estourou 4 semanas, lance e refine pós-launch.
- **Subestimar o dia D.** Tenha 8-10h livres no dia, em standby. Não é hora de atender cliente da agência ou jantar fora.
- **Lançar sem 4.7 e 4.8.** "Faço depois" = nunca. Custo agora: 6h. Custo de descobrir vulnerabilidade pós-launch num cliente Agency: imensurável.
- **Product Hunt como única estratégia de launch.** PH dá um boost de 24-48h. Tenha thread Twitter, post LinkedIn, email beta, e 2-3 posts em comunidades relevantes (ex: comunidades de copy/perf no BR) prontos para o mesmo dia.

---

## Pós-launch — primeiras 4 semanas

Não é parte do roadmap formal, mas o que você faz aqui define se a tração inicial vira retenção real.

### Semana 1 (launch week)

- Monitoramento reforçado, equipe (você) em standby
- Responder cada comentário PH dentro de 30 min nas primeiras 8h
- Capturar feedback negativo em backlog priorizado
- Daily check-in com SLOs: tudo verde?

### Semana 2-4

- Bugs P1/P2 do feedback do launch resolvidos
- Onboarding refinado com base em telemetria PostHog (onde usuários abandonam?)
- Primeiro post-mortem público (em formato changelog/blog) sobre o launch — humildade gera conexão
- Iniciar planejamento da v0.6 com base em feedback estruturado

### Métricas para olhar

- DAU/MAU ratio (≥ 20% saudável)
- Time to first value (signup → primeira análise) — meta < 10 min
- Churn cohort do launch — semana 1, 2, 4 retention
- NPS pós-30-dias

---

## Filosofia de execução

Princípios que ficam de pé em qualquer fase. Quando estiver em dúvida, volte aqui.

1. **Estratégia antes de copy. Argumento antes de UI. Schema antes de tela.** Toda vez que pular essa ordem, vai fazer 2x.
2. **Multi-tenant é cultural, não técnico.** Toda nova feature: "como isso se comporta com 2 workspaces?". Esquecer disso = vazamento de dados depois.
3. **Compliance é Fase 1, não item de polish.** ANPD, LGPD, Consent Mode, PII redaction — tudo cedo. Tarde = caro.
4. **Não construa admin pela metade.** Half-done admin é backdoor. Faça completo ou não faça.
5. **Cost modeling é continuous, não event.** Olhe margem por usuário toda semana, não só quando estourar.
6. **Toda análise consome crédito calibrado pelo custo real.** Se um pipeline novo entra, custo em créditos é definido com base em medição real, não em achismo. Recalibração trimestral é hábito, não exceção.
7. **Margem é número público interno.** Todo founder check-in semanal: qual a margem agregada por plano? Se não sabe, /admin/financeiro está quebrado ou foi pulado.
8. **Validação com usuário real é gate, não checkbox.** Se 3 betas não terminam o ciclo, há problema real. Pare e descubra qual.
9. **CLAUDE.md é o prompt mais importante do projeto.** Atualize toda vez que descobrir um padrão ou regra novo. Documento vivo. **A referência ao v0.6 (especialmente Parte 4) precisa estar no CLAUDE.md desde a Sessão 0.3** — sem isso, Claude Code vai gerar código com modelo flat antigo.
10. **Cada feature nova com teste no mesmo PR.** Coverage não é número arbitrário; é prova que a próxima refatoração não vai quebrar o que existe.
11. **Logs sem PII. Sempre. Sem exceção.** Toda hora você roda `pnpm audit:pii` e zero hits ou refatora antes do merge.
12. **Quando o desenvolvimento se desviar, volte ao v0.6.** Cada seção é um contrato. Use como árbitro de discussões internas.

---

## Glossário rápido

- **AGC** — Agência Criation.io
- **CRT** — App Criation.io (este produto)
- **HWS** — App Hey Whispa (outro produto, fora do escopo)
- **CAPI** — Conversions API (server-side tracking para Meta/Google)
- **LDU** — Limited Data Use (Meta), enforcement automático quando consent revogado
- **EMQ** — Event Match Quality (score Meta de qualidade do evento CAPI)
- **DPIA** — Data Protection Impact Assessment (relatório de impacto LGPD)
- **STRIDE** — framework de threat modeling (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)
- **DR** — Disaster Recovery
- **SLO** — Service Level Objective
- **PII** — Personally Identifiable Information

---

## Referências

- [`docs/criation-io-arquitetura-v06.html`](./docs/criation-io-arquitetura-v06.html) — arquitetura completa, comandos para Claude Code por sessão
- [`docs/criation-io-arquitetura-v06.html#p4-0`](./docs/criation-io-arquitetura-v06.html#p4-0) — **Parte 4: Modelo de Negócio e Sistema de Créditos** (planos, custos, schema, fluxos, observabilidade)
- [`CLAUDE.md`](./CLAUDE.md) — contrato técnico para Claude Code (criado na Sessão 0.3)
- [`AGENTS.md`](./AGENTS.md) — agents especializados do projeto (criado na Sessão 0.3)
- [`docs/cost-model.md`](./docs/cost-model.md) — projeção de custo unitário por plano (criado na Sessão 3.11.5)
- [`docs/threat-model.md`](./docs/threat-model.md) — STRIDE por componente (criado na Sessão 2.15.5)
- [`docs/dpia-lgpd.md`](./docs/dpia-lgpd.md) — DPIA assinado (criado na Sessão 3.13.5)
- [`docs/disaster-recovery.md`](./docs/disaster-recovery.md) — DR runbook (criado na Sessão 3.11.5)
- [`docs/incident-runbook.md`](./docs/incident-runbook.md) — runbook de incidentes (criado na Sessão 4.9)

---

_Boa construção._
