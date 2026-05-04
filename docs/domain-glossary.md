# Glossario de Dominio — Criation.io

---

## Midia Paga

**Hook Rate** — Percentual de pessoas que param de fazer scroll e assistem pelo menos 3 segundos de um video. Hook Rate baixo indica criativo ou thumbnail fracos.

**Hold Rate (ThruPlay Rate)** — Percentual de espectadores que assistem ao video ate o fim (ou 15s para videos mais longos). Hold Rate alto com Hook Rate baixo indica criativo bom mas distribuicao ruim.

**ROAS (Return on Ad Spend)** — Receita gerada dividida pelo valor investido em anuncios. ROAS 3.0 = R$3 de receita para cada R$1 investido.

**ROAS Real vs ROAS Estimado** — ROAS Real usa receita do gateway (fonte da verdade). ROAS Estimado usa conversoes reportadas pelo Meta (sujeito a subcontagem por iOS/bloqueadores). O Criation.io sempre exibe ROAS Real quando gateway esta conectado.

**CPM (Cost per Mille)** — Custo para cada 1.000 impressoes. CPM alto pode indicar audiencia muito disputada ou score de relevancia baixo.

**CTR (Click-Through Rate)** — Percentual de impressoes que resultam em clique. CTR de link (cliques para a landing) e mais relevante que CTR total (inclui cliques no perfil, etc).

**CPA (Cost per Acquisition)** — Custo por conversao. No contexto do Criation.io, CPA Real = investimento total / vendas confirmadas pelo gateway.

**fbclid** — Parametro automatico adicionado pelo Facebook a URLs de anuncios. Identifica o clique e permite match direto com eventos de conversao no CAPI.

**gclid** — Equivalente do fbclid para Google Ads. Gerado automaticamente com Auto-tagging ativo.

**AEM (Aggregated Event Measurement)** — Modelo de mensuracao do Meta para iOS 14+. Limita o numero de eventos rastreaveis e atrasa reports em ate 3 dias. Por isso gateway e fonte da verdade.

**EMQ (Event Match Quality)** — Score do Meta de 0-10 indicando a qualidade dos parametros enviados via CAPI (email, telefone, fbp, fbc, etc). EMQ > 7 e bom. EMQ < 5 degrada a otimizacao de campanhas.

**CAPI (Conversions API)** — API server-side do Meta para enviar eventos de conversao diretamente dos servidores, sem depender de pixel (contorna bloqueadores e iOS). Complementa, nao substitui, o pixel.

**Enhanced Conversions (Google)** — Equivalente do CAPI para Google Ads. Envia dados de conversao hashed server-side para melhorar match e otimizacao de campanhas.

**LDU (Limited Data Use)** — Flag do Meta para restringir uso de dados para otimizacao de anuncios. Obrigatorio em algumas regulacoes. O Criation.io aplica LDU baseado em consent_mode do usuario.

---

## Gateway e Atribuicao

**Gateway** — Plataforma de pagamento que processa e confirma transacoes (ex: Hotmart, Kirvano, Eduzz, Kiwify, Monetizze, PerfectPay). No Criation.io, gateway e a fonte da verdade para conversoes e receita.

**Postback** — Notificacao HTTP enviada pelo gateway ao Criation.io quando um evento ocorre (venda confirmada, reembolso, abandono de checkout). Alternativa ao webhook — mesmo conceito, terminologia diferente nos gateways brasileiros.

**Webhook** — Notificacao HTTP enviada por uma plataforma (Meta, Stripe, Asaas) para o Criation.io quando um evento ocorre. Processado de forma idempotente (tabela `processed_webhook_events`).

**OAuth Flow** — Fluxo de autorizacao usado para conectar contas Meta Ads e Google Ads. Usuario autoriza o Criation.io via redirect, recebemos `access_token` e `refresh_token` que sao armazenados encriptados.

**UTM Parameters** — Tags adicionadas a URLs de anuncios para rastrear origem de trafego. Os 5 padroes: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.

**UTM Stitcher** — Servico interno do Criation.io que correlaciona eventos de gateway com campanhas Meta via UTMs. Usa cascata de 5 niveis de confianca.

**Match Confidence** — Score de confianca de 0-100 do UTM Stitcher indicando quao certa e a atribuicao de uma venda a uma campanha. Perfect match = 100, fuzzy = 40-70, nao atribuido = 0.

**UTM Health Score** — Score 0-100 indicando a qualidade da padronizacao de UTMs do workspace. Score < 85 ativa banner de alerta no dashboard. Score < 50 significa que > 50% das vendas sao nao atribuidas.

---

## SaaS e Negocio

**MRR (Monthly Recurring Revenue)** — Receita recorrente mensal das assinaturas ativas. Principal metrica de saude do negocio.

**Churn** — Cancelamento de assinaturas. Churn MRR = receita perdida por cancelamentos no mes. Churn Rate = churn MRR / MRR inicio do mes.

**LTV (Lifetime Value)** — Receita total esperada de um cliente ao longo da relacao. Calculado como ARPU / Churn Rate mensal.

**CAC (Customer Acquisition Cost)** — Custo para adquirir um novo cliente pagante. Inclui marketing + vendas + onboarding.

**Cohort Retention** — Analise de quais % de clientes de um mesmo periodo (coorte) permanecem ativos nos meses seguintes. Sinal de saude do produto.

**ARPU (Average Revenue Per User)** — MRR dividido pelo numero de clientes ativos. Util para comparar planos.

---

## Produto Criation.io

**Pipeline** — Sequencia de etapas de analise com IA. Cada pipeline tem nome, custo em creditos e tipo de output. Exemplos: Quick (1 cred), Deep (7 cred), Modelar Sales Page (8 cred).

**Gargalo (Bottleneck)** — Etapa do funil com a maior queda percentual de conversao relativa. Classificado em 4 tipos com cores sagradas: Criativo (violeta), Landing (laranja), Audiencia (azul), Oferta (vermelho).

**Bloco de Transicao** — Conceito de copywriting: a frase ou paragrafo que conecta duas partes do copy mantendo o leitor engajado. O produto identifica automaticamente blocos de transicao fracos.

**Signal Score** — Score composto que combina multiplos sinais de aprendizado (feedback explicito, outcomes medidos, padroes de uso) para avaliar a qualidade de uma copy gerada. Usado pelo sistema de aprendizado continuo.

**Workspace** — Unidade de isolamento de dados. Cada conta do Criation.io tem um workspace. Futuro: multiplos workspaces por conta (feature de agencias).

**Credito** — Unidade de consumo do produto. Cada pipeline consome X creditos. Planos incluem creditos mensais + possibilidade de compra de packs avulsos.
