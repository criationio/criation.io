#!/usr/bin/env node
/**
 * Criation.io — Validação de Custos de Pipeline
 *
 * Pré-requisito da Fase 0 (antes da Sessão 0.2)
 * Execute: ANTHROPIC_API_KEY=sk-... node validate-pipeline-costs.js
 *
 * O que faz:
 * 1. Simula chamadas reais para cada pipeline crítico
 * 2. Mede tokens reais consumidos
 * 3. Calcula custo em USD e BRL
 * 4. Compara com estimativas do v0.6 §4.3
 * 5. Gera relatório com sugestão de ajuste de cost_credits
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Preços Anthropic API (Claude Sonnet 4.6) — maio 2026
// Atualize se a Anthropic mudou os preços
const PRICING = {
  input_per_mtok: 3.00,   // USD por milhão de tokens de input
  output_per_mtok: 15.00, // USD por milhão de tokens de output
};

// Taxa de câmbio aproximada — ajuste antes de rodar
const USD_TO_BRL = 5.70;

// Estimativas do v0.6 §4.3 para comparação
const V06_ESTIMATES_BRL = {
  'analisar.video_ad':   0.30, // Quick
  'analisar.deep':       2.00, // Deep
  'modelar.youtube':     5.00, // Modelar YouTube (mais caro)
};

// Custo mínimo em créditos do v0.6 §4.3
const V06_CREDITS = {
  'analisar.video_ad': 1,
  'analisar.deep':     5,
  'modelar.youtube':  15,
};

// Custo alvo por crédito = R$0,40 (v0.6 §4.2)
const COST_PER_CREDIT_BRL = 0.40;

// ============================================================
// Simulações de prompt por pipeline
// ============================================================

const PIPELINES = {
  'analisar.video_ad': {
    name: 'Quick — analisar.video_ad',
    description: 'Análise rápida de um video ad. ~5K input + 3K output tokens esperados.',
    max_tokens: 4096,
    system: `Você é um especialista em análise de criativos de anúncios digitais.
Analise o criativo de video ad fornecido e retorne um diagnóstico estruturado com 8 seções:
hook (primeiros 3 segundos), retenção, copy principal, CTA, edição/ritmo, oferta, áudio, e recomendações prioritárias.
Seja específico e direto. Baseie a análise em princípios de performance de Meta Ads.`,
    messages: [{
      role: 'user',
      content: `Analise este video ad para um produto de nutrição voltado para mulheres de 34-58 anos:

TRANSCRIÇÃO DO VÍDEO (60 segundos):
"Olá! Você já tentou de tudo pra emagrecer e não conseguiu? Hoje eu vou te mostrar o segredo que
mais de 50 mil mulheres já usaram para perder de 8 a 15 quilos sem passar fome. Meu nome é Dra.
Ana Lima e eu desenvolvi o Protocolo de Sincronização Metabólica, um método que usa a ciência do
GLP-1 natural para reprogramar o metabolismo feminino. Não é dieta. Não é remédio. É um protocolo
nutricional que ativa os hormônios do emagrecimento do seu próprio corpo. Veja o que aconteceu com
a Maria, 52 anos, de São Paulo: ela perdeu 12 quilos em 90 dias sem academia. E com a Joana, 47 anos:
ela perdeu o barrigão que carregava há 10 anos. Se você tem mais de 35 anos e sente que seu corpo
não responde mais como antes, isso não é falta de força de vontade. É seu metabolismo pedindo socorro.
Clique no botão abaixo e acesse o Manual Secreto da Caneta gratuitamente. São apenas 200 unidades
disponíveis hoje. Clique agora antes que acabe."

MÉTRICAS DO ANÚNCIO (últimos 7 dias):
- Impressões: 245.000
- Hook Rate (3s view): 34%
- Hold Rate (15s): 28%
- Hold Rate (30s): 19%
- CTR: 1.2%
- CPC: R$3.40
- CPL: R$28.50
- ROAS estimado Meta: 2.1x

CONTEXTO:
- Produto: Manual Secreto da Caneta (tripwire R$27)
- Funil: VSL → Checkout → Order bumps → Upsell
- Plataforma: Meta Ads (Feed + Reels)
- Público: Mulheres 34-58, interesse em saúde, emagrecimento`
    }]
  },

  'analisar.deep': {
    name: 'Deep — analisar.deep',
    description: 'Análise profunda multi-pipeline. ~20K input + 8K output tokens esperados.',
    max_tokens: 16384,
    system: `Você é um especialista sênior em performance de marketing digital e copywriting de alta conversão.
Faça uma análise PROFUNDA e COMPLETA do criativo fornecido.
Cubra: (1) Análise de hook e retenção segundo a ciência da atenção, (2) Arquitetura da argumentação de venda,
(3) Análise de copy linha por linha com sugestões de melhoria específicas, (4) Análise do mecanismo único e
diferenciação, (5) Análise de provas e credibilidade, (6) Otimização de CTA e urgência, (7) Compatibilidade
com algoritmo Meta/Google, (8) 3 variações de hook alternativas prontas para teste A/B,
(9) Script de VSL otimizado baseado nos problemas identificados, (10) Plano de testes para os próximos 30 dias.
Seja extremamente específico. Cada sugestão deve ser acionável imediatamente.`,
    messages: [{
      role: 'user',
      content: `ANÁLISE PROFUNDA SOLICITADA:

CONTEXTO COMPLETO DO NEGÓCIO:
Infoprodutor: nutrição e emagrecimento feminino
Mecanismo único: "Protocolo de Sincronização Metabólica" (baseado em GLP-1 natural)
Produto tripwire: Manual Secreto da Caneta (R$27)
Order bump 1: Cardápio das 21h (R$47) - conversão atual 34%
Order bump 2: Acelerador Metabólico (R$67) - conversão atual 19%
Upsell 1: Programa Completo 90 dias (R$197) - conversão atual 8%
Continuidade: Clube do Protocolo (R$47/mês) - conversão atual 12%
Ticket médio atual: R$89
LTV 90 dias: R$143

PÚBLICO-ALVO DETALHADO:
- Mulheres 34-58 anos
- Tentou mais de 3 dietas sem sucesso
- Sente que "metabolismo travou depois dos 40"
- Usa Meta e Instagram diariamente
- Poder aquisitivo: classe C e B2
- Maior dor: não conseguir emagrecer apesar de tentar
- Maior medo: envelhecer acima do peso, problemas de saúde
- Maior sonho: voltar ao peso dos 30 anos, ter energia

CRIATIVO ATUAL (VSL 8 minutos — transcrição completa):
[Hook 0-30s]: "Para toda mulher que já tentou de tudo e não conseguiu emagrecer: você não é fraca. Seu metabolismo está bloqueado. E eu vou provar isso em 3 minutos."

[Problema 30s-2min]: "Depois dos 35, o corpo feminino passa por uma mudança hormonal silenciosa. O estrogênio começa a cair. O cortisol sobe. E o GLP-1 — o hormônio natural do emagrecimento que as injeções tentam imitar — para de funcionar corretamente. É por isso que a dieta que sua amiga fez não funciona pra você. Não é questão de força de vontade. É bioquímica."

[Mecanismo 2min-4min]: "O Protocolo de Sincronização Metabólica usa 3 alimentos comuns que quando combinados na sequência certa ativam a produção natural de GLP-1 no seu corpo. Sem injeção. Sem remédio. Sem efeito colateral. Nós chamamos de sequência CER: Cromo + Ervas específicas + Refeição noturna estratégica."

[Prova 4min-6min]: "Maria, 52 anos, professora de Campinas: perdeu 12kg em 90 dias. Joana, 47 anos, dona de casa do Rio: perdeu 9kg e normalizou a pressão. Ana Paula, 55 anos, empresária de Porto Alegre: perdeu 15kg e saiu de pré-diabetes. Mais de 50.000 mulheres já transformaram o corpo com esse protocolo."

[Oferta 6min-8min]: "Hoje você pode acessar o Manual Secreto da Caneta — o guia de 47 páginas com o protocolo completo, a sequência CER detalhada, e o cardápio das primeiras 3 semanas — por apenas R$27. Isso é menos do que uma pizza. E vem com 30 dias de garantia total. Se não funcionar, devolvo cada centavo. Mas precisa ser agora: restam apenas 200 unidades desta edição."

MÉTRICAS DETALHADAS (últimos 30 dias):
CPM: R$18,40
CTR landing: 2.8%
Taxa conversão checkout: 3.2% (de visitantes únicos)
Taxa conversão pagamento: 78% (de quem iniciou checkout)
Abandono checkout: 22%
Chargeback rate: 1.8%
Reembolso rate: 4.2%
CPA atual: R$68
ROAS: 1.31x (abaixo do break-even de 1.8x)

CONCORRÊNCIA:
3 players principais com VSLs similares. Um deles convertendo melhor com hook de "antes e depois" mostrando número na balança. Outro usando prova social de médicos endossando.

O que precisa melhorar urgentemente? O ROAS está abaixo do break-even.`
    }]
  },

  'modelar.youtube': {
    name: 'Modelar YouTube — modelar.youtube',
    description: 'Modelar criativo baseado em análise de vídeo YouTube. ~35K input + 12K output tokens esperados.',
    max_tokens: 16384,
    system: `Você é um especialista em criação de criativos de alto desempenho para Meta Ads e Google Ads.
Sua função é analisar um vídeo de referência do YouTube e criar variações de criativos otimizadas.
Processo: (1) Analise profundamente o vídeo de referência — estrutura, hooks, argumentação, mecanismos, provas, CTAs;
(2) Identifique o que está funcionando e por quê (princípios transferíveis);
(3) Adapte os princípios para o produto/nicho do cliente;
(4) Gere: 5 scripts de video ad completos (30-60s cada), 3 scripts de VSL longa (5-8 min),
10 variações de hook isolado, 5 variações de CTA, 3 angulações de argumento principal.
Cada entrega deve ser copy pronta para gravar, não sugestões genéricas.`,
    messages: [{
      role: 'user',
      content: `MODELAR COM REFERÊNCIA DO YOUTUBE:

VÍDEO DE REFERÊNCIA ANALISADO:
Título: "Eu perdi 23kg sem academia com esse método simples"
Canal: Vida Saudável Brasil (2.3M inscritos)
Visualizações: 4.2 milhões
Data: 8 meses atrás
Duração: 12 minutos

TRANSCRIÇÃO RESUMIDA DO VÍDEO DE REFERÊNCIA:
Hook (0-45s): Apresentadora mostra foto "antes" extremamente impactante. Fala olhando diretamente para câmera: "Essa era eu há 14 meses. 98 quilos. Pré-diabética. Joelhos doendo. Vergonha de aparecer em foto. Hoje eu peso 75 quilos e vou te contar exatamente o que mudou — não foi academia, não foi remédio, foi uma coisa que aprendi numa consulta com minha endocrinologista que ninguém fala nas redes sociais."

Problema (45s-3min): Descreve em detalhes a resistência insulínica como raiz do problema. Usa metáfora de "células com ouvido tampado". Cita estudos (sem mostrar fonte). Conecta com experiência emocional: "Não é gula. Não é preguiça. É seu corpo sabotando você."

Mecanismo (3min-6min): Explica protocolo de "janela metabólica de 11 minutos". 3 alimentos específicos. Horário estratégico. Mostra diário pessoal. Humaniza bastante — erros, recaídas, processo.

Prova (6min-9min): Mostra 12 fotos de "clientes" com antes/depois. Depoimentos em vídeo de 3 mulheres. Números específicos. Uma médica aparece endossando (30 segundos).

Oferta (9min-12min): Curso completo R$197. Bônus: 3 livros digitais, comunidade privada, consultoria em grupo. Urgência por vagas. Garantia 30 dias. "Investe menos do que um plano de academia de um mês."

PRODUTO DO CLIENTE (para adaptar):
Mesmo nicho (emagrecimento feminino 35-58 anos)
Produto tripwire: Manual Secreto da Caneta (R$27)
Mecanismo único: Protocolo de Sincronização Metabólica / GLP-1 natural
Diferencial vs referência: preço de entrada muito mais baixo (R$27 vs R$197)
Tom de voz: mais científico, menos emocional que o vídeo de referência

MÉTRICAS DO PRODUTO DO CLIENTE (contexto):
Melhor ad atual: Hook Rate 34%, Hold Rate 28%, CTR 1.2%, CPA R$68
Meta: CPA ≤ R$45, ROAS ≥ 2.5x

ENTREGÁVEIS ESPERADOS:
1. Análise detalhada do que está funcionando no vídeo de referência (princípios transferíveis)
2. 5 scripts de video ad completos (30-60s) adaptados para o produto do cliente
3. 1 script de VSL completo (8-10 min) inspirado na estrutura da referência
4. 10 variações de hook para teste A/B
5. Recomendações de formato e produção
6. Plano de testes para os primeiros 14 dias`
    }]
  }
};

// ============================================================
// Executar um pipeline e medir custo
// ============================================================
async function measurePipeline(pipelineId, pipeline) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testando: ${pipeline.name}`);
  console.log(`${'─'.repeat(60)}`);

  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: pipeline.max_tokens || 8192,
      system: pipeline.system,
      messages: pipeline.messages,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const inputTokens  = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens  = inputTokens + outputTokens;

    // Custo em USD
    const costUSD = (
      (inputTokens  / 1_000_000) * PRICING.input_per_mtok +
      (outputTokens / 1_000_000) * PRICING.output_per_mtok
    );

    // Custo em BRL
    const costBRL = costUSD * USD_TO_BRL;

    // Comparação com estimativa do v0.6
    const estimateBRL = V06_ESTIMATES_BRL[pipelineId];
    const diffPct     = ((costBRL - estimateBRL) / estimateBRL * 100).toFixed(1);
    const diffOk      = Math.abs(parseFloat(diffPct)) <= 30;

    // Créditos recomendados
    const creditsNeeded      = Math.ceil(costBRL / COST_PER_CREDIT_BRL);
    const creditsV06         = V06_CREDITS[pipelineId];
    const creditsAdjustNeeded = creditsNeeded !== creditsV06;

    console.log(`\nTokens:`);
    console.log(`  Input:  ${inputTokens.toLocaleString()}`);
    console.log(`  Output: ${outputTokens.toLocaleString()}`);
    console.log(`  Total:  ${totalTokens.toLocaleString()}`);
    console.log(`  Tempo:  ${elapsed}s`);
    console.log(`\nCusto:`);
    console.log(`  USD:    $${costUSD.toFixed(4)}`);
    console.log(`  BRL:    R$${costBRL.toFixed(4)}`);
    console.log(`\nComparação com v0.6 §4.3:`);
    console.log(`  Estimativa v0.6: R$${estimateBRL.toFixed(2)}`);
    console.log(`  Real medido:     R$${costBRL.toFixed(2)}`);
    console.log(`  Diferença:       ${diffPct > 0 ? '+' : ''}${diffPct}%  ${diffOk ? '✅ dentro de ±30%' : '⚠️  FORA DE ±30% — CALIBRAR'}`);
    console.log(`\nCréditos:`);
    console.log(`  Custo por crédito alvo: R$${COST_PER_CREDIT_BRL}`);
    console.log(`  Créditos necessários:   ${creditsNeeded} (ceil(${costBRL.toFixed(4)} / ${COST_PER_CREDIT_BRL}))`);
    console.log(`  Créditos no v0.6:       ${creditsV06}`);
    if (creditsAdjustNeeded) {
      console.log(`  ⚠️  AJUSTAR pipeline_costs.cost_credits para ${creditsNeeded}`);
    } else {
      console.log(`  ✅ Créditos corretos — não precisa ajustar`);
    }

    return {
      pipelineId,
      inputTokens,
      outputTokens,
      costUSD,
      costBRL,
      estimateBRL,
      diffPct: parseFloat(diffPct),
      diffOk,
      creditsNeeded,
      creditsV06,
      creditsAdjustNeeded,
    };

  } catch (err) {
    console.error(`  ERRO: ${err.message}`);
    return null;
  }
}

// ============================================================
// Main
// ============================================================
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌  ANTHROPIC_API_KEY não definida.');
    console.error('   Execute: ANTHROPIC_API_KEY=sk-... node validate-pipeline-costs.js');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Criation.io — Validação de Custos de Pipeline      ║');
  console.log('║   Pré-requisito Fase 0 (antes da Sessão 0.2)         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nModelo:           claude-sonnet-4-6`);
  console.log(`Câmbio usado:     1 USD = R$${USD_TO_BRL}`);
  console.log(`Custo/crédito:    R$${COST_PER_CREDIT_BRL}`);
  console.log(`Tolerância:       ±30% vs estimativa v0.6`);
  console.log(`\nAtenção: esta execução vai custar ~$0.05-0.30 USD em API calls.`);

  const results = [];

  for (const [id, pipeline] of Object.entries(PIPELINES)) {
    const result = await measurePipeline(id, pipeline);
    if (result) results.push(result);
    // Pequena pausa entre chamadas para evitar rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  // ============================================================
  // Relatório final
  // ============================================================
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                  RELATÓRIO FINAL                     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const needsAdjustment = results.filter(r => r.creditsAdjustNeeded || !r.diffOk);

  if (needsAdjustment.length === 0) {
    console.log('✅  Todos os pipelines dentro da tolerância de ±30%.');
    console.log('   Use os valores padrão do v0.6 §4.3 no seed da Sessão 0.2.\n');
  } else {
    console.log('⚠️  Ajustes necessários no seed da pipeline_costs (Sessão 0.2):\n');
    needsAdjustment.forEach(r => {
      const sign = r.diffPct > 0 ? '+' : '';
      console.log(`   ${r.pipelineId}:`);
      console.log(`     Real: R$${r.costBRL.toFixed(4)} (${sign}${r.diffPct}% vs estimativa)`);
      console.log(`     Alterar cost_credits: ${r.creditsV06} → ${r.creditsNeeded}\n`);
    });
  }

  console.log('Seed atualizado para pipeline_costs (copie para a Sessão 0.2):');
  console.log('─'.repeat(60));
  console.log("INSERT INTO pipeline_costs (pipeline_id, cost_credits, estimated_real_cost_brl, description) VALUES");
  const allPipelines = [
    { id: 'analisar.video_ad',   desc: 'Quick — análise rápida de video ad' },
    { id: 'comparar.analyses',   desc: 'Comparar análises A×B', manual_credits: 2,  manual_cost: 0.80 },
    { id: 'variar.video_ad',     desc: 'Variar — gerar variações', manual_credits: 3,  manual_cost: 1.20 },
    { id: 'analisar.deep',       desc: 'Deep — análise multi-pipeline' },
    { id: 'modelar.sales_page',  desc: 'Modelar com sales page', manual_credits: 8,  manual_cost: 2.80 },
    { id: 'analisar.sales_page', desc: 'Sales page deep (full)', manual_credits: 10, manual_cost: 3.50 },
    { id: 'modelar.youtube',     desc: 'Modelar com vídeo YouTube' },
  ];

  allPipelines.forEach((p, i) => {
    const measured = results.find(r => r.pipelineId === p.id);
    const credits  = measured ? measured.creditsNeeded : p.manual_credits;
    const cost     = measured ? measured.costBRL.toFixed(2) : p.manual_cost.toFixed(2);
    const comma    = i < allPipelines.length - 1 ? ',' : ';';
    console.log(`  ('${p.id}', ${credits}, ${cost}, '${p.desc}')${comma}`);
  });

  console.log('─'.repeat(60));
  console.log('\nNota: pipelines não testados (comparar, variar, modelar.sales_page,');
  console.log('analisar.sales_page) usam estimativas do v0.6. Meça após Fase 1.');
}

main().catch(console.error);
