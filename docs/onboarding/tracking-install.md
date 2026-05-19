# Instalação do Tracking Criation

> Guia para o cliente Criation instalar o tracking script na sua landing page.
> Tempo estimado: **2 minutos**.

## O que o script faz

- **Captura UTMs** da URL e do referrer, persiste por 90 dias em cookie first-party
- **Identifica o visitante** com `visitor_id` UUID único (cookie `_cio_vid`, 90 dias)
- **Dispara `page_view` automaticamente** ao carregar a página e em navegações SPA
- **Captura cliques** em elementos com `data-criation-event`
- **Captura submits** de qualquer `<form>`
- **Captura scroll** em milestones (25%, 50%, 75%, 100%)
- **Enriquece links** de checkout (Hotmart, Kiwify, Eduzz, Monetizze, Ticto, Cakto, Greenn, Yampi) com as UTMs capturadas
- **Respeita Consent Mode v2** do Google (4 sinais: ad_storage, analytics_storage, ad_user_data, ad_personalization)

## Passo 1 — Copiar o snippet

No app da Criation, acesse **Tracking → Script de rastreio**. Você verá:

```html
<script
  async
  src="https://app.criation.io/criation-tracking.js"
  data-workspace="SEU-WORKSPACE-ID"
></script>
```

> O `data-workspace` já vem preenchido com o ID do seu workspace. **Não compartilhe esse snippet publicamente** — ele identifica seu workspace.

## Passo 2 — Colar no `<head>` da landing

Cole o snippet **antes do fechamento da tag `</head>`** em todas as páginas que recebem tráfego pago:

- Landing page principal
- Blog (se gerar leads/vendas)
- Qualquer página que linke para checkout

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Minha Landing</title>

    <!-- 👇 Cole aqui -->
    <script
      async
      src="https://app.criation.io/criation-tracking.js"
      data-workspace="SEU-WORKSPACE-ID"
    ></script>
  </head>
  <body>
    ...
  </body>
</html>
```

### Plataformas comuns

**WordPress (Elementor, etc):**

- Vá em `Aparência → Editor de tema → header.php`
- Cole antes de `</head>`
- Ou use plugin "Insert Headers and Footers" → cole na seção "Scripts in Header"

**Hotmart Pages / Cliengo / Landing builders:**

- Procure por "Scripts personalizados" ou "HTML no `<head>`" nas configurações
- Cole o snippet inteiro

**Site customizado (Next.js, React, Vue):**

- Coloque no `_document.tsx` (Next.js Pages Router) ou `layout.tsx` (App Router)
- Em React: use `react-helmet-async`

**Sem editor de tema (sites estáticos):**

- Edite o HTML direto
- Se usa template engine (Jekyll, Hugo, Astro), adicione ao layout base

## Passo 3 — Verificar instalação

Após colar o snippet:

1. **Abra sua landing page no navegador**
2. **Volte ao app Criation** em **Tracking → Script de rastreio**
3. Aguarde 5 segundos e atualize a página
4. O status deve mudar de **"Aguardando 1º evento"** (amarelo) para **"Recebendo eventos"** (verde)
5. A tabela "Eventos recentes" deve mostrar pelo menos 1 evento `page_view`

Se não aparecer, veja a seção **Troubleshooting** abaixo.

## Passo 4 — Configurar origens permitidas (recomendado)

Por 7 dias após a instalação, o endpoint aceita eventos de **qualquer domínio** (modo onboarding). Após esse período, você precisa configurar a lista de origens permitidas:

1. Em **Tracking → Script de rastreio**, seção **"Origens permitidas"**
2. Adicione cada domínio que vai postar eventos:
   - `app.cliente.com` — host exato
   - `cliente.com` — host + todos os subdomínios (www, app, etc)
   - `*.cliente.com` — apenas subdomínios (não a raiz)
3. Domínios não listados serão **bloqueados** com erro 403

## Eventos custom

Além dos automáticos, você pode disparar eventos custom:

### Via JavaScript

```js
// Tracking de cliques em CTA
document.querySelector('#cta-quero-comprar').addEventListener('click', () => {
  window.criation('track', 'cta_clicked', { position: 'hero', variant: 'A' })
})

// Tracking de visualização de seção
window.criation('track', 'pricing_viewed', { plan: 'pro' })

// Identificar o visitante quando ele preenche email (lead capture)
window.criation('identify', 'comprador@example.com')
```

### Via atributo HTML (sem código)

Adicione `data-criation-event` em qualquer elemento clicável:

```html
<button data-criation-event="cta_clicked" data-criation-position="hero">Quero começar</button>
```

Atributos adicionais `data-criation-*` viram propriedades do evento. No exemplo acima, o evento `cta_clicked` chega com `{ position: 'hero' }`.

## Checkout custom

Se seu checkout não está na lista (`Hotmart, Kiwify, Eduzz, ...`), adicione o atributo `data-criation-checkout` nos links:

```html
<a href="https://meucheckout.com.br/produto" data-criation-checkout> Comprar agora </a>
```

O script vai injetar automaticamente as UTMs capturadas nesse link.

## API debug

Em DevTools Console:

```js
// Estado atual
window.__cioTracking
// → { version: '2.0.0', visitorId: '...', workspaceId: '...', endpoint: '...' }

// UTMs capturadas
window.__cioTracking.getUtms()
// → { utm_source: 'fb', utm_campaign: 'oferta_x', fbclid: 'ABC123' }

// Modo debug — loga erros silenciosos
window.criation('debug', true)
```

## Troubleshooting

### Status fica "Aguardando 1º evento"

1. **Verifique se o script carregou:** DevTools → Network → filtra por `criation-tracking.js` → deve estar 200 OK.
2. **Verifique se o POST está saindo:** DevTools → Network → filtra por `v1/track` → deve haver pelo menos 1 request `204 No Content`.
3. **Erro 403 (origin_not_allowed):** Origens permitidas estão configuradas mas seu domínio não está na lista. Adicione ou aguarde grace period (7 dias).
4. **Erro 400 (invalid_payload):** Bug nosso. Reporte com print da request body.

### Adblockers bloqueiam o script

uBlock Origin e outros adblockers podem bloquear `/criation-tracking.js` por causa da palavra "tracking" no path. Em DevTools você vê `ERR_BLOCKED_BY_CLIENT`.

**Workaround atual:** clientes técnicos podem servir o script via proxy reverso no próprio domínio (ex: `cliente.com/_assets/c.js` → proxy → `app.criation.io/criation-tracking.js`).

**Solução planejada:** rename do path para neutralizar adblockers — em roadmap (TD-097).

### Performance

O script é **5.5KB gzipped, async** — não bloqueia render. Latência média do endpoint: **<100ms** em horário comercial (steady state).

## Privacidade & LGPD

- **Cookies first-party** — `_cio_vid` (UUID), `_cio_utms` (JSON com UTMs). 90 dias.
- **Nenhuma PII** sai do browser sem hash (email passa por SHA-256 server-side).
- **IP e User-Agent** são hasheados com salt server-side antes de persistir.
- **Consent Mode v2** é respeitado — se `ad_storage='denied'`, eventos ainda persistem mas o fanout server-side (Meta CAPI, Google EC) vai skipar.
- **Erasure**: workspace pode deletar todos os eventos de um visitor via endpoint `/api/v1/erasure` (em planejamento para 3.13.5).

## Próximos passos depois de instalar

1. **Conecte seu gateway** em **Integrações → Conexões** (Hotmart, Kiwify, Eduzz, ou outro via webhook genérico)
2. **Configure UTMs nas suas campanhas Meta** — use o padrão recomendado em **Tracking → Atribuição UTM**
3. **Veja o funil consolidado** em **Tracking → Visão geral** (em alguns minutos de tráfego)
