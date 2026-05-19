import crypto from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'

import { env } from '@/env'
import { db } from '@/lib/db'
import { metaDataDeletionRequests } from '@/lib/db/schema/connections'
import { authLogger } from '@/lib/logger'

/**
 * Data Deletion Callback do Meta — webhook obrigatorio (App Review).
 * Recebe `signed_request` HMAC-SHA256 com app_scoped_user_id, valida,
 * persiste em meta_data_deletion_requests, retorna confirmation_code
 * + URL pra usuario consultar status.
 *
 * Esta sessao 1.3 implementa o stub (validacao + INSERT).
 * Processamento real (purge de PII por app_scoped_user_id) entra em 3.13.5.
 *
 * Spec Meta: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

interface SignedRequestPayload {
  algorithm: string
  user_id?: string
  app_scoped_user_id?: string
  expires?: number
  issued_at?: number
  // outros campos podem vir
  [key: string]: unknown
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + padding, 'base64')
}

function parseSignedRequest(signedRequest: string): SignedRequestPayload | null {
  const parts = signedRequest.split('.')
  if (parts.length !== 2) return null
  const [signatureB64, payloadB64] = parts as [string, string]

  const expectedSig = crypto.createHmac('sha256', env.META_APP_SECRET).update(payloadB64).digest()

  const receivedSig = base64UrlDecode(signatureB64)

  if (
    expectedSig.length !== receivedSig.length ||
    !crypto.timingSafeEqual(expectedSig, receivedSig)
  ) {
    return null
  }

  try {
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8')
    const parsed = JSON.parse(payloadJson) as SignedRequestPayload
    if (parsed.algorithm !== 'HMAC-SHA256') return null
    return parsed
  } catch {
    return null
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let signedRequest: string | null = null

  // Meta envia x-www-form-urlencoded com campo `signed_request`
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await req.formData()
    const sr = body.get('signed_request')
    if (typeof sr === 'string') signedRequest = sr
  } else if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { signed_request?: string } | null
    signedRequest = body?.signed_request ?? null
  }

  if (!signedRequest) {
    authLogger.warn({ contentType }, 'meta data-deletion: signed_request ausente')
    return NextResponse.json({ error: 'missing_signed_request' }, { status: 400 })
  }

  const payload = parseSignedRequest(signedRequest)
  if (!payload) {
    authLogger.warn({}, 'meta data-deletion: signed_request invalido')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  const appScopedUserId = payload.user_id ?? payload.app_scoped_user_id
  if (!appScopedUserId) {
    authLogger.warn({}, 'meta data-deletion: payload sem user_id')
    return NextResponse.json({ error: 'missing_user_id' }, { status: 400 })
  }

  const confirmationCode = crypto.randomBytes(16).toString('hex')

  try {
    await db.insert(metaDataDeletionRequests).values({
      appScopedUserId,
      signedRequestPayload: payload as unknown as Record<string, unknown>,
      confirmationCode,
      status: 'pending',
    })
  } catch (err) {
    authLogger.error({ err }, 'meta data-deletion: falha ao persistir request')
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  authLogger.info({ appScopedUserId }, 'meta data-deletion: request registrada')

  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  return NextResponse.json({
    url: `${baseUrl.replace(/\/$/, '')}/api/meta/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}
