import { type NextRequest, NextResponse } from 'next/server'

import { trackingLogger } from '@/lib/logger'
import { trackingIngestLimiter } from '@/lib/rate-limit/upstash'
import { extractClientIp, ingestEvent, validateOrigin } from '@/lib/services/tracking.service'
import { triggerProcessTrackingEvent } from '@/lib/trigger/client'
import { ingestEventSchema } from '@/lib/validators/tracking'

/**
 * Endpoint publico de ingestion CDP (Sessao 1.4.A / ADR-014).
 *
 * - Aceita JSON e form-data (sendBeacon nem sempre envia application/json).
 * - CORS preflight + headers liberados — endpoint cross-origin por design.
 * - Auth implicita: `workspace_id` no payload + origin allowlist (validateOrigin).
 *   Em grace mode (sem connection CDP) aceita qualquer origin pra onboarding.
 * - Rate limit 600 events/min por workspace.
 * - Persist sync (event + visitor upsert via service). Trigger.dev async
 *   pra enriquecimento futuro (1.4.B matching, 1.4.9 fanout) — fail-soft.
 * - Resposta 204 No Content sempre que sucesso (browser ignora body de
 *   beacon; minimiza payload).
 *
 * NAO faz:
 * - CSRF protection (nao age sobre sessao; cliente nao autentica via cookie).
 * - Body limit explicito (Next.js limita por padrao a 4MB pra route handlers).
 */

const CORS_HEADERS = {
  // Origin allowlist e enforcado server-side via validateOrigin. CORS aqui e
  // permissivo (qualquer origem manda preflight ok) porque a defesa real e a
  // validacao do payload + workspace+origin combinacao.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now()
  let workspaceId: string | null = null

  try {
    const body = await readBody(req)
    if (!body) {
      return jsonError(400, 'invalid_body')
    }

    const parsed = ingestEventSchema.safeParse(body)
    if (!parsed.success) {
      trackingLogger.warn({ issues: parsed.error.issues.slice(0, 5) }, 'ingest: invalid payload')
      return jsonError(400, 'invalid_payload')
    }

    workspaceId = parsed.data.workspace_id

    // Rate limit por workspace
    const rl = await trackingIngestLimiter.limit(workspaceId)
    if (!rl.success) {
      trackingLogger.warn({ workspaceId }, 'ingest: rate limited')
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, CORS_HEADERS)
    }

    // Origin allowlist
    const origin = req.headers.get('origin')
    const originCheck = await validateOrigin(workspaceId, origin)
    if (!originCheck.ok) {
      trackingLogger.warn(
        { workspaceId, origin, reason: originCheck.reason },
        'ingest: origin rejected'
      )
      return jsonError(403, originCheck.reason)
    }

    // Persist sync (event + visitor upsert)
    const result = await ingestEvent(parsed.data, {
      clientIp: extractClientIp(req.headers),
      userAgent: req.headers.get('user-agent'),
      origin,
    })

    // Enfileira async: visitor upsert + futuros enrichments (1.4.B/1.4.9). Fail-soft.
    if (result.created && result.eventDbId) {
      void triggerProcessTrackingEvent({
        eventDbId: result.eventDbId,
        eventTs: result.eventTs.toISOString(),
        workspaceId,
        visitorId: parsed.data.visitor_id,
        eventName: parsed.data.event_name,
      }).catch((err: unknown) => {
        trackingLogger.error(
          { eventDbId: result.eventDbId, err: (err as Error).message },
          'ingest: trigger.dev enqueue failed'
        )
      })
    }

    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    trackingLogger.error(
      { workspaceId, err: errorMessage, durationMs: Date.now() - startedAt },
      'ingest: unexpected error'
    )
    return jsonError(500, 'internal_error')
  }
}

// ---------------------------------------------------------------------------

async function readBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? ''
  // sendBeacon enviado com Blob({type:'application/json'}) chega como JSON.
  // sendBeacon enviado com FormData chega como multipart — coletamos campo 'data'.
  try {
    if (contentType.includes('application/json') || contentType === '') {
      const text = await req.text()
      if (!text) return null
      return JSON.parse(text) as unknown
    }
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const dataField = form.get('data')
      if (typeof dataField !== 'string') return null
      return JSON.parse(dataField) as unknown
    }
    if (contentType.includes('text/plain')) {
      // sendBeacon fallback — body veio como text/plain (default do sendBeacon)
      const text = await req.text()
      if (!text) return null
      return JSON.parse(text) as unknown
    }
    return null
  } catch {
    return null
  }
}

function jsonError(status: number, error: string): NextResponse {
  return jsonResponse(status, { ok: false, error }, CORS_HEADERS)
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string>
): NextResponse {
  return NextResponse.json(body, { status, headers })
}
