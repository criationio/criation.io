/*!
 * Criation.io tracking script — UTM persistence + checkout link enrichment
 * Versão: 1.0 (2026-05-10) — sessão 1.4.8 / ADR-020
 *
 * O que faz:
 *  1. Captura UTMs (utm_source/medium/campaign/content/term + click IDs) da
 *     URL atual e do document.referrer.
 *  2. Persiste em cookie first-party `_cio_utms` por 90 dias — sobrevive a
 *     navegação interna e visitas posteriores sem UTM.
 *  3. Enriquece automaticamente links <a> que apontam pra domínios de
 *     checkout conhecidos (Hotmart, Kiwify, Eduzz, Monetizze, Ticto, Cakto,
 *     Greenn, Yampi). Sem poluir links externos não-checkout.
 *  4. Detecta SPA via history.pushState — re-roda enrichment ao navegar.
 *  5. Aceita atributo `data-criation-checkout` em <a> pra forçar enrichment
 *     em checkouts custom (ex: cliente próprio).
 *
 * O que NÃO faz (vem em 1.4.A — Criation CDP completo):
 *  - Não dispara pageview/click pra ingestion endpoint
 *  - Não cria visitor_id first-party persistente
 *  - Não captura consent (LGPD) — usuário deve gatear via cookie banner
 *
 * Como instalar: copiar 1 linha no <head> de cada página de origem (landing
 * page, blog, etc):
 *   <script async src="https://app.criation.io/criation-tracking.js"></script>
 */
;(function () {
  'use strict'

  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__cioTrackingLoaded) return
  window.__cioTrackingLoaded = true

  var COOKIE_NAME = '_cio_utms'
  var COOKIE_DAYS = 90

  // Domínios de checkout conhecidos — link enrichment automático nesses + qualquer
  // link com data-criation-checkout. Outros links permanecem intocados.
  var CHECKOUT_DOMAINS = [
    'hotmart.com',
    'kiwify.com',
    'kiwify.com.br',
    'eduzz.com',
    'sun.eduzz.com',
    'monetizze.com.br',
    'ticto.com.br',
    'cakto.com.br',
    'greenn.com.br',
    'yampi.com.br',
    'app.yampi.com.br',
  ]

  var UTM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
    'ttclid',
    'msclkid',
  ]

  // ---------------------------------------------------------------------------
  // Cookie helpers
  // ---------------------------------------------------------------------------

  function readCookie(name) {
    var match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'))
    if (!match) return null
    try {
      return JSON.parse(decodeURIComponent(match[2]))
    } catch (e) {
      return null
    }
  }

  function writeCookie(name, value) {
    var expires = new Date()
    expires.setTime(expires.getTime() + COOKIE_DAYS * 24 * 60 * 60 * 1000)
    var serialized = encodeURIComponent(JSON.stringify(value))
    document.cookie =
      name +
      '=' +
      serialized +
      '; expires=' +
      expires.toUTCString() +
      '; path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '')
  }

  // ---------------------------------------------------------------------------
  // UTM capture (URL + referrer + cookie)
  // ---------------------------------------------------------------------------

  function captureUtms() {
    var urlParams = new URLSearchParams(location.search)
    var referrerParams = new URLSearchParams(
      (document.referrer && document.referrer.split('?')[1]) || ''
    )
    var cookieUtms = readCookie(COOKIE_NAME) || {}
    var captured = {}

    for (var i = 0; i < UTM_KEYS.length; i++) {
      var key = UTM_KEYS[i]
      var value = urlParams.get(key) || referrerParams.get(key) || cookieUtms[key] || null
      if (value) captured[key] = value
    }

    // Fallback pra utm_source: hostname do referrer ou "direto"
    if (!captured.utm_source) {
      if (document.referrer) {
        try {
          captured.utm_source = new URL(document.referrer).hostname
        } catch (e) {
          captured.utm_source = 'direto'
        }
      } else {
        captured.utm_source = 'direto'
      }
    }

    // Persiste se mudou (priorize URL atual sobre cookie)
    var hasNewFromUrl = UTM_KEYS.some(function (k) {
      return urlParams.get(k) != null
    })
    if (hasNewFromUrl) {
      writeCookie(COOKIE_NAME, captured)
    }

    return captured
  }

  // ---------------------------------------------------------------------------
  // Link enrichment
  // ---------------------------------------------------------------------------

  function isCheckoutLink(anchor) {
    if (anchor.hasAttribute('data-criation-checkout')) return true
    var hostname = ''
    try {
      hostname = new URL(anchor.href).hostname.toLowerCase()
    } catch (e) {
      return false
    }
    for (var i = 0; i < CHECKOUT_DOMAINS.length; i++) {
      var domain = CHECKOUT_DOMAINS[i]
      if (hostname === domain || hostname.endsWith('.' + domain)) return true
    }
    return false
  }

  function enrichUrl(originalHref, utms) {
    try {
      var url = new URL(originalHref)
      var params = new URLSearchParams(url.search)
      var modified = false
      for (var key in utms) {
        if (!utms.hasOwnProperty(key)) continue
        if (!params.has(key) && utms[key]) {
          params.append(key, utms[key])
          modified = true
        }
      }
      if (!modified) return originalHref
      url.search = params.toString()
      return url.toString()
    } catch (e) {
      return originalHref
    }
  }

  function enrichAllLinks(utms) {
    var anchors = document.querySelectorAll('a[href]')
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i]
      if (!isCheckoutLink(a)) continue
      try {
        var enriched = enrichUrl(a.href, utms)
        if (enriched !== a.href) a.href = enriched
      } catch (e) {
        // ignore individual link failures
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Boot + SPA support
  // ---------------------------------------------------------------------------

  function run() {
    var utms = captureUtms()
    enrichAllLinks(utms)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    run()
  }

  // SPA: re-roda enrichment quando route mudar via pushState/popstate
  var origPushState = history.pushState
  history.pushState = function () {
    origPushState.apply(this, arguments)
    setTimeout(run, 50)
  }
  window.addEventListener('popstate', function () {
    setTimeout(run, 50)
  })

  // Expor pra debug
  window.__cioTracking = {
    version: '1.0.0',
    getUtms: function () {
      return readCookie(COOKIE_NAME) || {}
    },
    refresh: run,
  }
})()
