/*!
 * Criation.io tracking script v2.1 (Sessao 1.4.A / 1.4.9 / ADR-014)
 *
 * 1 tag, captura completa: visitor_id first-party, UTMs/click IDs, page_view
 * automatico, scroll milestones, click/form auto-track, identify, checkout
 * link enrichment, SPA support, Consent Mode v2 read-only.
 *
 * Instalacao (cliente cola no <head>):
 *   <script async src="https://app.criation.io/criation-tracking.js"
 *           data-workspace="WORKSPACE_UUID"></script>
 *
 * API publica:
 *   criation('track', 'video_view', { value: 197 })
 *   criation('identify', 'buyer@example.com')
 *
 * Cookies first-party (90d):
 *   _cio_vid  — visitor_id UUIDv4
 *   _cio_utms — last-seen UTMs + click IDs (retrocompat 1.4.8)
 *   _fbp      — Meta browser ID (gerado se Pixel ausente, sessao 1.4.9)
 *   _fbc      — Meta click ID (gerado se Pixel ausente + fbclid presente)
 */
;(function () {
  'use strict'

  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__cioTrackingLoaded) return
  window.__cioTrackingLoaded = true

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------

  var SCRIPT_VERSION = '2.1.0'
  var COOKIE_VID = '_cio_vid'
  var COOKIE_UTMS = '_cio_utms'
  var COOKIE_FBP = '_fbp'
  var COOKIE_FBC = '_fbc'
  var COOKIE_DAYS = 90

  // Detecta script tag para ler data-attributes. Fallback (B3 audit fix):
  // cliente pode definir window.__cioWorkspaceId antes do script carregar
  // (util pra bundlers que removem data-attrs ou scripts inline).
  var scriptTag = document.currentScript || findOwnScript()
  var WORKSPACE_ID =
    (scriptTag && scriptTag.getAttribute('data-workspace')) ||
    (typeof window.__cioWorkspaceId === 'string' ? window.__cioWorkspaceId : null)
  var ENDPOINT =
    (scriptTag && scriptTag.getAttribute('data-endpoint')) ||
    (typeof window.__cioEndpoint === 'string' ? window.__cioEndpoint : null) ||
    deriveEndpoint(scriptTag)

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

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
  var CLICK_ID_KEYS = ['fbclid', 'gclid', 'ttclid', 'msclkid', 'ctwa_clid', 'wbraid', 'gbraid']

  var SCROLL_MILESTONES = [25, 50, 75, 100]
  var scrollFired = {}

  // -------------------------------------------------------------------------
  // Utils
  // -------------------------------------------------------------------------

  function findOwnScript() {
    var scripts = document.getElementsByTagName('script')
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || ''
      if (src.indexOf('criation-tracking') !== -1) return scripts[i]
    }
    return null
  }

  function deriveEndpoint(tag) {
    if (!tag || !tag.src) return 'https://app.criation.io/api/v1/track'
    try {
      var u = new URL(tag.src)
      return u.protocol + '//' + u.host + '/api/v1/track'
    } catch (e) {
      return 'https://app.criation.io/api/v1/track'
    }
  }

  function uuidv4() {
    var arr = new Array(16)
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var typed = new Uint8Array(16)
      window.crypto.getRandomValues(typed)
      for (var i = 0; i < 16; i++) arr[i] = typed[i]
    } else {
      for (var j = 0; j < 16; j++) arr[j] = Math.floor(Math.random() * 256)
    }
    arr[6] = (arr[6] & 0x0f) | 0x40
    arr[8] = (arr[8] & 0x3f) | 0x80
    var hex = []
    for (var k = 0; k < 16; k++) {
      var h = arr[k].toString(16)
      hex.push(h.length === 1 ? '0' + h : h)
    }
    return (
      hex.slice(0, 4).join('') +
      '-' +
      hex.slice(4, 6).join('') +
      '-' +
      hex.slice(6, 8).join('') +
      '-' +
      hex.slice(8, 10).join('') +
      '-' +
      hex.slice(10, 16).join('')
    )
  }

  function readCookieRaw(name) {
    var match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'))
    return match ? decodeURIComponent(match[2]) : null
  }

  function readCookieJson(name) {
    var raw = readCookieRaw(name)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (e) {
      return null
    }
  }

  function writeCookie(name, value, days) {
    var expires = new Date()
    expires.setTime(expires.getTime() + (days || COOKIE_DAYS) * 24 * 60 * 60 * 1000)
    var serialized = typeof value === 'string' ? value : JSON.stringify(value)
    document.cookie =
      name +
      '=' +
      encodeURIComponent(serialized) +
      '; expires=' +
      expires.toUTCString() +
      '; path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '')
  }

  function getOrCreateVisitorId() {
    var existing = readCookieRaw(COOKIE_VID)
    if (existing) return existing
    var id = uuidv4()
    writeCookie(COOKIE_VID, id, COOKIE_DAYS)
    return id
  }

  // -------------------------------------------------------------------------
  // Meta _fbp / _fbc generation (Sessao 1.4.9 — pre-fanout CAPI)
  //
  // Pixel Meta tradicional gera estes cookies. Quando cliente NAO tem Pixel
  // instalado (cenario CDP puro), cookies ficam vazios e EMQ degrada — fbp
  // sozinho elevaria de ~5 pra ~7. Geramos defensivamente. Quando Pixel
  // coexiste, ele setou primeiro e readCookieRaw aqui detecta — no-op.
  //
  // Formato Meta: fb.{subdomain_index}.{ts_ms}.{value}
  // subdomain_index=1 indica top-level domain (convencao Pixel).

  function ensureFbpCookie() {
    if (readCookieRaw(COOKIE_FBP)) return
    // Random 10-digit garantido via offset (evita leading zeros).
    var rnd = Math.floor(Math.random() * 9000000000) + 1000000000
    writeCookie(COOKIE_FBP, 'fb.1.' + Date.now() + '.' + rnd, COOKIE_DAYS)
  }

  function ensureFbcCookie(fbclid) {
    if (readCookieRaw(COOKIE_FBC)) return
    if (!fbclid) return
    // Timestamp ideal seria do click original. Sem isso usamos Date.now()
    // como aproximacao — Meta aceita; EMQ levemente abaixo do ideal mas
    // muito melhor que sem fbc. SPA: nao atualizamos se fbclid muda em
    // route-change (first-touch wins). TD aberto se return-visitor com
    // novo ad precisar overwrite.
    writeCookie(COOKIE_FBC, 'fb.1.' + Date.now() + '.' + fbclid, COOKIE_DAYS)
  }

  // -------------------------------------------------------------------------
  // UTM capture (URL + referrer + cookie) — retrocompat 1.4.8
  // -------------------------------------------------------------------------

  function captureUtms() {
    var urlParams = new URLSearchParams(location.search)
    var referrerParams = new URLSearchParams(
      (document.referrer && document.referrer.split('?')[1]) || ''
    )
    var cookieUtms = readCookieJson(COOKIE_UTMS) || {}
    var captured = {}

    var keys = UTM_KEYS.concat(CLICK_ID_KEYS)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      var value = urlParams.get(key) || referrerParams.get(key) || cookieUtms[key] || null
      if (value) captured[key] = value
    }

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

    // Persiste se chegou UTM novo na URL
    var hasNewFromUrl = false
    for (var n = 0; n < keys.length; n++) {
      if (urlParams.get(keys[n]) != null) {
        hasNewFromUrl = true
        break
      }
    }
    if (hasNewFromUrl) writeCookie(COOKIE_UTMS, captured)
    return captured
  }

  // -------------------------------------------------------------------------
  // Consent Mode v2 (read-only)
  // -------------------------------------------------------------------------

  function readConsent() {
    // Le ultimas chamadas window.dataLayer para gtag('consent', 'default'|'update', {...})
    var dl = window.dataLayer || []
    var state = {}
    for (var i = 0; i < dl.length; i++) {
      var entry = dl[i]
      if (!entry || entry.length < 3) continue
      var cmd = entry[0]
      var action = entry[1]
      var settings = entry[2]
      if (cmd === 'consent' && (action === 'default' || action === 'update') && settings) {
        for (var k in settings) {
          if (Object.prototype.hasOwnProperty.call(settings, k)) state[k] = settings[k]
        }
      }
    }
    return Object.keys(state).length > 0 ? state : null
  }

  // -------------------------------------------------------------------------
  // Link enrichment (retrocompat 1.4.8) — checkout domains + opt-in attribute
  // -------------------------------------------------------------------------

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
        if (!Object.prototype.hasOwnProperty.call(utms, key)) continue
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
    // B5 audit fix: dedup via data attribute. Anchors ja enriquecidos com o
    // mesmo set de UTMs sao ignorados — evita re-processar 1000+ anchors em
    // cada navegacao SPA. Marker reseta quando UTMs mudam (querystring nova).
    var marker = JSON.stringify(utms)
    var anchors = document.querySelectorAll('a[href]:not([data-criation-enriched="' + marker + '"])')
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i]
      if (!isCheckoutLink(a)) continue
      try {
        var enriched = enrichUrl(a.href, utms)
        if (enriched !== a.href) a.href = enriched
        a.setAttribute('data-criation-enriched', marker)
      } catch (e) {
        // ignore
      }
    }
  }

  // -------------------------------------------------------------------------
  // Beacon dispatch
  // -------------------------------------------------------------------------

  function sendEvent(eventName, properties) {
    safely(function () {
      sendEventInner(eventName, properties)
    }, 'sendEvent:' + eventName)
  }

  function sendEventInner(eventName, properties) {
    if (!WORKSPACE_ID) {
      // Sem workspace nao tem pra onde enviar. Loga em modo debug.
      if (window.__cioDebug) console.warn('[criation] missing data-workspace, event dropped:', eventName)
      return
    }

    var utms = captureUtms()
    var consent = readConsent()
    var payload = {
      workspace_id: WORKSPACE_ID,
      visitor_id: VISITOR_ID,
      event_id: uuidv4(),
      event_name: eventName,
      event_ts: Date.now(),
      page_url: location.href,
      page_title: document.title,
      referrer: document.referrer || undefined,
      utms: {
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
      },
      fbclid: utms.fbclid,
      gclid: utms.gclid,
      ttclid: utms.ttclid,
      msclkid: utms.msclkid,
      ctwa_clid: utms.ctwa_clid,
      wbraid: utms.wbraid,
      gbraid: utms.gbraid,
      fbp: readCookieRaw(COOKIE_FBP) || undefined,
      fbc: readCookieRaw(COOKIE_FBC) || undefined,
      consent: consent || undefined,
      identify_email: properties && properties.identify_email,
      custom_data: properties && properties.custom_data,
    }

    var body = JSON.stringify(payload)

    // sendBeacon com text/plain — simple request (sem CORS preflight),
    // mais resiliente em unload e mais leve em ad blockers que filtram
    // application/json.
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
        var ok = navigator.sendBeacon(ENDPOINT, blob)
        if (ok) return
      } catch (e) {
        // fallthrough
      }
    }

    // Fallback fetch keepalive
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        body: body,
        headers: { 'Content-Type': 'text/plain' },
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      }).catch(function () {
        /* swallow */
      })
    } catch (e) {
      // swallow
    }
  }

  // -------------------------------------------------------------------------
  // Auto events
  // -------------------------------------------------------------------------

  function firePageView() {
    sendEvent('page_view')
  }

  function setupScrollMilestones() {
    function onScroll() {
      var doc = document.documentElement
      var body = document.body
      var scrollTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)
      var scrollHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        doc.clientHeight,
        doc.scrollHeight,
        doc.offsetHeight
      )
      var winHeight = window.innerHeight || doc.clientHeight
      var maxScroll = Math.max(1, scrollHeight - winHeight)
      var pct = Math.min(100, Math.round((scrollTop / maxScroll) * 100))
      for (var i = 0; i < SCROLL_MILESTONES.length; i++) {
        var m = SCROLL_MILESTONES[i]
        if (pct >= m && !scrollFired[m]) {
          scrollFired[m] = true
          sendEvent('scroll', { custom_data: { milestone: m } })
        }
      }
    }
    var throttled = throttle(onScroll, 200)
    window.addEventListener('scroll', throttled, { passive: true })
  }

  function throttle(fn, ms) {
    var last = 0
    var timer = null
    return function () {
      var now = Date.now()
      var remaining = ms - (now - last)
      if (remaining <= 0) {
        last = now
        fn()
      } else if (!timer) {
        timer = setTimeout(function () {
          last = Date.now()
          timer = null
          fn()
        }, remaining)
      }
    }
  }

  function setupClickAndFormCapture() {
    document.addEventListener(
      'click',
      function (ev) {
        var target = ev.target
        while (target && target !== document.body) {
          if (target.hasAttribute && target.hasAttribute('data-criation-event')) {
            var name = target.getAttribute('data-criation-event') || 'click'
            sendEvent(name, {
              custom_data: extractDataAttrs(target),
            })
            return
          }
          target = target.parentNode
        }
      },
      true
    )

    document.addEventListener(
      'submit',
      function (ev) {
        var form = ev.target
        if (!form || form.tagName !== 'FORM') return
        var name = (form.getAttribute && form.getAttribute('data-criation-event')) || 'form_submit'
        sendEvent(name, {
          custom_data: {
            form_id: form.id || undefined,
            form_name: form.getAttribute('name') || undefined,
            form_action: form.action || undefined,
          },
        })
      },
      true
    )
  }

  function extractDataAttrs(el) {
    var attrs = el.attributes || []
    var data = {}
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i]
      if (!a.name) continue
      // captura tudo data-criation-* exceto a chave do evento
      if (a.name.indexOf('data-criation-') === 0 && a.name !== 'data-criation-event') {
        data[a.name.slice('data-criation-'.length)] = a.value
      }
    }
    return Object.keys(data).length > 0 ? data : undefined
  }

  // -------------------------------------------------------------------------
  // Public API: criation('track'|'identify', ...)
  // -------------------------------------------------------------------------

  function publicApi(command) {
    var args = Array.prototype.slice.call(arguments, 1)
    if (command === 'track') {
      var eventName = args[0]
      var properties = args[1] || {}
      sendEvent(eventName, { custom_data: properties })
    } else if (command === 'identify') {
      var email = args[0]
      if (!email || typeof email !== 'string') return
      sendEvent('identify', { identify_email: email })
    } else if (command === 'pageview') {
      firePageView()
    } else if (command === 'debug') {
      window.__cioDebug = !!args[0]
    }
  }

  // Drena fila pre-init (estilo gtag): se cliente chamou criation('track', ...)
  // ANTES do script carregar, persistimos o array no window.criation.q.
  function drainQueue() {
    var existing = window.criation
    if (existing && existing.q && existing.q.length) {
      for (var i = 0; i < existing.q.length; i++) {
        try {
          publicApi.apply(null, existing.q[i])
        } catch (e) {
          /* swallow */
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Boot + SPA support
  // -------------------------------------------------------------------------

  var VISITOR_ID = getOrCreateVisitorId()

  // B4 audit fix: wrapper silencioso. Falha de tracking nunca pode quebrar
  // a pagina do cliente. Em modo debug (window.__cioDebug=true) loga; em
  // prod swallow.
  function safely(fn, label) {
    try {
      return fn()
    } catch (e) {
      if (window.__cioDebug) {
        try {
          console.warn('[criation] ' + label + ' failed:', e)
        } catch (_) {
          /* swallow */
        }
      }
      return null
    }
  }

  function boot() {
    safely(function () {
      var utms = captureUtms()
      ensureFbpCookie()
      ensureFbcCookie(utms.fbclid)
      enrichAllLinks(utms)
      firePageView()
      setupScrollMilestones()
      setupClickAndFormCapture()
      drainQueue()
    }, 'boot')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  // SPA: re-roda enrichment + page_view ao mudar route. Wrap silencioso.
  function onRouteChange() {
    safely(function () {
      scrollFired = {}
      var u = captureUtms()
      enrichAllLinks(u)
      firePageView()
    }, 'route-change')
  }

  var origPushState = history.pushState
  history.pushState = function () {
    origPushState.apply(this, arguments)
    setTimeout(onRouteChange, 50)
  }
  window.addEventListener('popstate', function () {
    setTimeout(onRouteChange, 50)
  })

  // Expor API publica + debug
  window.criation = publicApi
  window.__cioTracking = {
    version: SCRIPT_VERSION,
    visitorId: VISITOR_ID,
    workspaceId: WORKSPACE_ID,
    endpoint: ENDPOINT,
    getUtms: function () {
      return readCookieJson(COOKIE_UTMS) || {}
    },
    track: function (name, props) {
      sendEvent(name, { custom_data: props })
    },
    identify: function (email) {
      publicApi('identify', email)
    },
  }
})()
